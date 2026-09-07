import type { FieldTypeRegistry } from "../model/registry"
import type { FormDefinition } from "../model/types"
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
  const order: string[] = []
  const uiSchema: UiSchema = { "ui:order": [] }

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
    if (field.required) required.push(field.key)

    const ui = definition.toUiSchema?.(field)
    if (ui && Object.keys(ui).length > 0) uiSchema[field.key] = ui
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
  }

  return { schema, uiSchema }
}
