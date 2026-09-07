import type { FieldOption, FormDefinition, FormField } from "../model/types"
import type {
  GeneratedSchema,
  JsonSchema,
  UiFieldSchema,
  UiSchema,
} from "./jsonSchemaTypes"

export const JSON_SCHEMA_DIALECT =
  "https://json-schema.org/draft/2020-12/schema"

/**
 * Converts a builder form definition into a JSON Schema document plus a
 * UI schema describing presentation (widget choice, placeholders, rows).
 *
 * Rules worth knowing:
 * - Each field becomes a property keyed by `field.key`; if two fields share a
 *   key the later one wins (the builder flags this as a validation issue).
 * - Choice fields use `oneOf: [{ const, title }]` so option labels survive.
 * - A required checkbox group means "at least one selected" (`minItems: 1`).
 * - A required single checkbox only requires the property to be present.
 */
export function toJsonSchema(form: FormDefinition): GeneratedSchema {
  const properties: Record<string, JsonSchema> = {}
  const required: string[] = []
  const uiSchema: UiSchema = { "ui:order": [] }

  for (const field of form.fields) {
    properties[field.key] = fieldToSchema(field)
    if (field.required) required.push(field.key)

    const ui = fieldToUiSchema(field)
    if (ui) uiSchema[field.key] = ui
  }

  uiSchema["ui:order"] = form.fields.map((f) => f.key)

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

export function fieldToSchema(field: FormField): JsonSchema {
  const common: JsonSchema = {
    ...nonEmpty("title", field.label),
    ...nonEmpty("description", field.description),
  }

  switch (field.type) {
    case "text":
      return {
        ...common,
        type: "string",
        ...defined("minLength", field.minLength),
        ...defined("maxLength", field.maxLength),
        ...validPattern(field.pattern),
      }
    case "email":
      return { ...common, type: "string", format: "email" }
    case "textarea":
      return {
        ...common,
        type: "string",
        ...defined("maxLength", field.maxLength),
      }
    case "number":
      return {
        ...common,
        type: field.integer ? "integer" : "number",
        ...defined("minimum", field.min),
        ...defined("maximum", field.max),
        ...(field.step !== undefined && field.step > 0
          ? { multipleOf: field.step }
          : {}),
      }
    case "date":
      return { ...common, type: "string", format: "date" }
    case "checkbox":
      return {
        ...common,
        type: "boolean",
        ...(field.defaultChecked ? { default: true } : {}),
      }
    case "radio":
    case "select":
      return { ...common, type: "string", ...oneOfOptions(field.options) }
    case "checkboxGroup": {
      const minItems = field.minSelected ?? (field.required ? 1 : undefined)
      return {
        ...common,
        type: "array",
        items: { type: "string", ...oneOfOptions(field.options) },
        uniqueItems: true,
        ...defined("minItems", minItems),
        ...defined("maxItems", field.maxSelected),
      }
    }
  }
}

export function fieldToUiSchema(field: FormField): UiFieldSchema | undefined {
  let ui: UiFieldSchema = {}

  switch (field.type) {
    case "text":
    case "email":
    case "number":
    case "select":
      ui = { ...nonEmpty("ui:placeholder", field.placeholder) }
      break
    case "textarea":
      ui = {
        "ui:widget": "textarea",
        ...nonEmpty("ui:placeholder", field.placeholder),
        "ui:options": { rows: field.rows },
      }
      break
    case "radio":
      ui = { "ui:widget": "radio" }
      break
    case "checkboxGroup":
      ui = { "ui:widget": "checkboxes" }
      break
    case "checkbox":
    case "date":
      break
  }

  return Object.keys(ui).length > 0 ? ui : undefined
}

/**
 * Builds `oneOf: [{ const, title }]` from options, dropping duplicate values
 * (a value matching two `oneOf` branches would make the schema unsatisfiable).
 * Returns an empty object when there are no options so the schema stays valid.
 */
function oneOfOptions(options: FieldOption[]): Pick<JsonSchema, "oneOf"> {
  const seen = new Set<string>()
  const oneOf: JsonSchema[] = []
  for (const option of options) {
    if (seen.has(option.value)) continue
    seen.add(option.value)
    oneOf.push({ const: option.value, title: option.label })
  }
  return oneOf.length > 0 ? { oneOf } : {}
}

function validPattern(
  pattern: string | undefined,
): Pick<JsonSchema, "pattern"> {
  if (!pattern) return {}
  try {
    new RegExp(pattern)
    return { pattern }
  } catch {
    return {}
  }
}

/** Spread helper: `{ key: value }` only when value is a non-empty string. */
function nonEmpty<K extends string>(
  key: K,
  value: string | undefined,
): Partial<Record<K, string>> {
  const trimmed = value?.trim()
  return trimmed ? ({ [key]: trimmed } as Record<K, string>) : {}
}

/** Spread helper: `{ key: value }` only when value is defined. */
function defined<K extends string, V>(
  key: K,
  value: V | undefined,
): Partial<Record<K, V>> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V>)
}
