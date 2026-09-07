import { arrayMove } from "@dnd-kit/sortable"
import { createField, type FieldTypeDefinition } from "../model/fieldType"
import { newId, slugifyKey, uniqueKey } from "../model/keys"
import type { FieldTypeRegistry } from "../model/registry"
import type {
  FieldOption,
  FieldProps,
  FormDefinition,
  FormField,
} from "../model/types"

export interface BuilderState {
  form: FormDefinition
  selectedId: string | null
}

/**
 * A change to one field. Generic settings are set directly; `props` is merged
 * into the field's existing props, and a prop set to `undefined` is removed.
 * Setting `key` switches the field to a manual key; setting `label` re-derives
 * the key while it is still automatic. Locked aspects are silently ignored.
 */
export interface FieldPatch {
  label?: string
  description?: string
  required?: boolean
  key?: string
  autoKey?: boolean
  props?: Partial<FieldProps>
}

export type BuilderAction =
  | { type: "addField"; fieldType: string; index?: number }
  | { type: "removeField"; id: string }
  | { type: "duplicateField"; id: string }
  | { type: "moveField"; from: number; to: number }
  | { type: "updateField"; id: string; patch: FieldPatch }
  | {
      type: "updateForm"
      patch: Partial<Pick<FormDefinition, "title" | "description">>
    }
  | { type: "selectField"; id: string | null }
  | { type: "replaceForm"; form: FormDefinition }
  | { type: "clearForm" }

export type BuilderReducer = (
  state: BuilderState,
  action: BuilderAction,
) => BuilderState

export function emptyForm(): FormDefinition {
  return { title: "Untitled form", description: "", fields: [] }
}

export function initialState(form: FormDefinition = emptyForm()): BuilderState {
  return { form, selectedId: null }
}

/** Whether another field of `type` may be added, honouring `maxInstances`. */
export function canAddField(
  registry: FieldTypeRegistry,
  form: FormDefinition,
  type: string,
): boolean {
  const definition = registry.get(type)
  if (!definition) return false
  if (definition.maxInstances === undefined) return true
  const count = form.fields.filter((f) => f.type === type).length
  return count < definition.maxInstances
}

/**
 * Builds the reducer for a given registry. The registry is needed to create
 * fields with the right defaults and to enforce per-type rules.
 */
export function createBuilderReducer(
  registry: FieldTypeRegistry,
): BuilderReducer {
  return function builderReducer(state, action): BuilderState {
    switch (action.type) {
      case "addField": {
        const definition = registry.get(action.fieldType)
        if (
          !definition ||
          !canAddField(registry, state.form, action.fieldType)
        ) {
          return state
        }
        const { fields } = state.form
        const key = definition.dataless
          ? ""
          : uniqueKey(slugifyKey(definition.label), takenKeys(fields))
        const field = createField(definition, key)
        const index = clampIndex(action.index ?? fields.length, fields.length)
        const next = [...fields.slice(0, index), field, ...fields.slice(index)]
        return { form: { ...state.form, fields: next }, selectedId: field.id }
      }

      case "removeField": {
        const field = state.form.fields.find((f) => f.id === action.id)
        if (!field || field.locks?.remove) return state
        const fields = state.form.fields.filter((f) => f.id !== action.id)
        return {
          form: { ...state.form, fields },
          selectedId: state.selectedId === action.id ? null : state.selectedId,
        }
      }

      case "duplicateField": {
        const index = state.form.fields.findIndex((f) => f.id === action.id)
        if (index === -1) return state
        const source = state.form.fields[index]
        if (!canAddField(registry, state.form, source.type)) return state

        const definition = registry.resolve(source.type)
        const { locks, ...rest } = source
        void locks // a copy is a new field; it inherits no host locks
        const copy: FormField = {
          ...rest,
          id: newId(),
          key: definition.dataless
            ? ""
            : uniqueKey(source.key, takenKeys(state.form.fields)),
          props: withFreshOptionIds(definition, source.props),
        }
        const fields = [...state.form.fields]
        fields.splice(index + 1, 0, copy)
        return { form: { ...state.form, fields }, selectedId: copy.id }
      }

      case "moveField": {
        const { fields } = state.form
        const from = clampIndex(action.from, fields.length - 1)
        const to = clampIndex(action.to, fields.length - 1)
        if (from === to || fields.length === 0) return state
        return {
          ...state,
          form: { ...state.form, fields: arrayMove(fields, from, to) },
        }
      }

      case "updateField": {
        const fields = state.form.fields.map((field) =>
          field.id === action.id
            ? applyPatch(field, action.patch, state.form.fields, registry)
            : field,
        )
        return { ...state, form: { ...state.form, fields } }
      }

      case "updateForm":
        return { ...state, form: { ...state.form, ...action.patch } }

      case "selectField":
        return state.selectedId === action.id
          ? state
          : { ...state, selectedId: action.id }

      case "replaceForm":
        return { form: action.form, selectedId: null }

      case "clearForm": {
        // Locked fields survive a clear; everything else goes.
        const fields = state.form.fields.filter((f) => f.locks?.remove)
        return { form: { ...state.form, fields }, selectedId: null }
      }
    }
  }
}

function applyPatch(
  field: FormField,
  patch: FieldPatch,
  allFields: FormField[],
  registry: FieldTypeRegistry,
): FormField {
  const definition = registry.resolve(field.type)
  const locks = field.locks ?? {}
  const next: FormField = { ...field }

  if (patch.label !== undefined) next.label = patch.label

  if (patch.description !== undefined) {
    next.description = patch.description === "" ? undefined : patch.description
  }

  if (patch.required !== undefined && !locks.required && !definition.dataless) {
    next.required = patch.required
  }

  const keyEditable = !locks.key && !definition.dataless
  if (patch.key !== undefined && keyEditable) {
    next.key = patch.key
    next.autoKey = patch.autoKey ?? false
  } else if (patch.label !== undefined && keyEditable && field.autoKey) {
    const others = allFields.filter((f) => f.id !== field.id).map((f) => f.key)
    next.key = uniqueKey(slugifyKey(patch.label), others)
  }

  if (patch.props && !locks.props) {
    next.props = mergeProps(field.props, patch.props)
  }

  return next
}

function mergeProps(base: FieldProps, patch: Partial<FieldProps>): FieldProps {
  const merged: FieldProps = { ...base }
  for (const [name, value] of Object.entries(patch)) {
    if (value === undefined) delete merged[name]
    else merged[name] = value
  }
  return merged
}

/** Options carry ids used as React keys; a duplicate needs its own. */
function withFreshOptionIds(
  definition: FieldTypeDefinition,
  props: FieldProps,
): FieldProps {
  const optionSpecs = (definition.properties ?? []).filter(
    (spec) => spec.kind === "options",
  )
  if (optionSpecs.length === 0) return structuredClone(props)

  const next: FieldProps = structuredClone(props)
  for (const spec of optionSpecs) {
    const options = next[spec.name]
    if (Array.isArray(options)) {
      next[spec.name] = (options as FieldOption[]).map((o) => ({
        ...o,
        id: newId("o"),
      }))
    }
  }
  return next
}

function takenKeys(fields: FormField[]): string[] {
  return fields.map((f) => f.key).filter(Boolean)
}

function clampIndex(index: number, max: number): number {
  return Math.max(0, Math.min(index, Math.max(0, max)))
}
