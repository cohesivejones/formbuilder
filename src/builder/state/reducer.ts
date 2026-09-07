import { arrayMove } from "@dnd-kit/sortable"
import type {
  CheckboxField,
  CheckboxGroupField,
  DateField,
  EmailField,
  FieldOption,
  FieldType,
  FormDefinition,
  FormField,
  NumberField,
  RadioField,
  SelectField,
  TextField,
  TextareaField,
} from "../model/types"
import { hasOptions } from "../model/types"
import { createField } from "../model/fieldRegistry"
import { newId, slugifyKey, uniqueKey } from "../model/keys"

export interface BuilderState {
  form: FormDefinition
  selectedId: string | null
}

/** A field's editable properties: everything except its identity and type. */
type Editable<T> = Omit<T, "id" | "type">

/**
 * Any subset of properties from any field type. `id` and `type` are fixed for
 * the life of a field. Setting `key` switches the field to a manual key;
 * setting `label` re-derives the key while it is still automatic.
 */
export type FieldPatch = Partial<
  Editable<TextField> &
    Editable<EmailField> &
    Editable<NumberField> &
    Editable<TextareaField> &
    Editable<CheckboxField> &
    Editable<CheckboxGroupField> &
    Editable<RadioField> &
    Editable<SelectField> &
    Editable<DateField>
>

export type BuilderAction =
  | { type: "addField"; fieldType: FieldType; index?: number }
  | { type: "removeField"; id: string }
  | { type: "duplicateField"; id: string }
  | { type: "moveField"; from: number; to: number }
  | { type: "updateField"; id: string; patch: FieldPatch }
  | { type: "setOptions"; id: string; options: FieldOption[] }
  | {
      type: "updateForm"
      patch: Partial<Pick<FormDefinition, "title" | "description">>
    }
  | { type: "selectField"; id: string | null }
  | { type: "replaceForm"; form: FormDefinition }
  | { type: "clearForm" }

export function emptyForm(): FormDefinition {
  return { title: "Untitled form", description: "", fields: [] }
}

export function initialState(form: FormDefinition = emptyForm()): BuilderState {
  return { form, selectedId: null }
}

export function builderReducer(
  state: BuilderState,
  action: BuilderAction,
): BuilderState {
  switch (action.type) {
    case "addField": {
      const { fields } = state.form
      const key = uniqueKey(
        slugifyKey(createField(action.fieldType, "").label),
        fields.map((f) => f.key),
      )
      const field = createField(action.fieldType, key)
      const index = clampIndex(action.index ?? fields.length, fields.length)
      const next = [...fields.slice(0, index), field, ...fields.slice(index)]
      return {
        form: { ...state.form, fields: next },
        selectedId: field.id,
      }
    }

    case "removeField": {
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
      const copy: FormField = {
        ...source,
        id: newId(),
        key: uniqueKey(
          source.key,
          state.form.fields.map((f) => f.key),
        ),
        ...(hasOptions(source)
          ? { options: source.options.map((o) => ({ ...o, id: newId("o") })) }
          : {}),
      } as FormField
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
      const fields = state.form.fields.map((field) => {
        if (field.id !== action.id) return field
        return applyPatch(field, action.patch, state.form.fields)
      })
      return { ...state, form: { ...state.form, fields } }
    }

    case "setOptions": {
      const fields = state.form.fields.map((field) => {
        if (field.id !== action.id || !hasOptions(field)) return field
        return { ...field, options: action.options }
      })
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

    case "clearForm":
      return { form: { ...state.form, fields: [] }, selectedId: null }
  }
}

function applyPatch(
  field: FormField,
  patch: FieldPatch,
  allFields: FormField[],
): FormField {
  const next = { ...field, ...patch } as FormField

  if (patch.key !== undefined) {
    // User typed a key by hand: keep it and stop deriving from the label.
    next.autoKey = patch.autoKey ?? false
  } else if (patch.label !== undefined && field.autoKey) {
    const others = allFields.filter((f) => f.id !== field.id).map((f) => f.key)
    next.key = uniqueKey(slugifyKey(patch.label), others)
  }

  return next
}

function clampIndex(index: number, max: number): number {
  return Math.max(0, Math.min(index, Math.max(0, max)))
}
