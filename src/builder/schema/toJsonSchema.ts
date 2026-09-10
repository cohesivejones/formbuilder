import type { Condition } from "../conditions/model"
import { conditionWithKeys } from "../conditions/print"
import {
  conditionToSchema,
  type ConditionSchemaContext,
} from "../conditions/toSchema"
import type { FieldTypeRegistry } from "../model/registry"
import type { FormDefinition, FormField } from "../model/types"
import { nonEmpty } from "./helpers"
import type { GeneratedSchema, JsonSchema, UiSchema } from "./jsonSchemaTypes"

export const JSON_SCHEMA_DIALECT =
  "https://json-schema.org/draft/2020-12/schema"

/**
 * Converts a form definition into a JSON Schema document plus a UI schema of
 * presentation hints. Each field's type definition supplies the type-specific
 * part; this function adds the common `title`/`description`, the `required`
 * list and the object wrapper.
 *
 * Fields whose type is dataless, unregistered, or has no `toJsonSchema` are
 * skipped (validation flags the unregistered ones). If two fields share a key
 * the later one wins; validation flags that too.
 */
export function toJsonSchema(
  form: FormDefinition,
  registry: FieldTypeRegistry,
): GeneratedSchema {
  const properties: Record<string, JsonSchema> = {}
  const required: string[] = []
  const conditional: JsonSchema[] = []
  const order: string[] = []
  const uiSchema: UiSchema = { "ui:order": [] }

  const conditionContext: ConditionSchemaContext = {
    keyOf: (id) => {
      const target = form.fields.find((f) => f.id === id)
      return target?.key || undefined
    },
    isArrayField: (id) => {
      const target = form.fields.find((f) => f.id === id)
      if (!target) return false
      return (
        registry.resolve(target.type).toJsonSchema?.(target)?.type === "array"
      )
    },
  }

  for (const field of form.fields) {
    const definition = registry.resolve(field.type)
    if (definition.dataless || !definition.toJsonSchema) continue

    const specific = definition.toJsonSchema(field)
    if (!specific) continue

    properties[field.key] = {
      ...nonEmpty("title", field.label),
      ...nonEmpty("description", field.description),
      ...specific,
    }
    order.push(field.key)

    // A requirement only binds while the field is on show: an answer that the
    // form itself withheld cannot be demanded. So any requiredness on a
    // conditionally visible field, and any requiredWhen, compiles to an
    // if/then folding the visibility in, and only the unconditional case
    // lands in the plain required list.
    const requiredUnder = requiredCondition(field)
    if (field.required && !field.visibleWhen) {
      required.push(field.key)
    } else if (requiredUnder) {
      conditional.push({
        if: conditionToSchema(requiredUnder, conditionContext),
        // The stub carries no constraint; Ajv's strictest mode wants every
        // required name declared beside it.
        then: { properties: { [field.key]: {} }, required: [field.key] },
      })
    }

    const ui = definition.toUiSchema?.(field) ?? {}
    if (field.visibleWhen) {
      ui["ui:visibleWhen"] = conditionWithKeys(field.visibleWhen, form.fields)
    }
    if (Object.keys(ui).length > 0) uiSchema[field.key] = ui
  }

  uiSchema["ui:order"] = order

  const schema: JsonSchema = {
    $schema: JSON_SCHEMA_DIALECT,
    ...nonEmpty("title", form.title),
    ...nonEmpty("description", form.description),
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
    additionalProperties: false,
    ...(conditional.length > 0 ? { allOf: conditional } : {}),
  }

  return { schema, uiSchema }
}

/** The condition under which the field's answer is compulsory, if any. */
function requiredCondition(field: FormField): Condition | undefined {
  if (field.required) return field.visibleWhen
  if (!field.requiredWhen) return undefined
  if (!field.visibleWhen) return field.requiredWhen
  return { op: "and", conditions: [field.requiredWhen, field.visibleWhen] }
}
