/**
 * The subset of JSON Schema (draft 2020-12) that the builder emits.
 * Kept deliberately narrow so the output is predictable and easy to test.
 */
export type JsonSchemaType =
  "string" | "number" | "integer" | "boolean" | "array" | "object"

export interface JsonSchema {
  $schema?: string
  title?: string
  description?: string
  type?: JsonSchemaType
  properties?: Record<string, JsonSchema>
  required?: string[]
  additionalProperties?: boolean
  format?: string
  minLength?: number
  maxLength?: number
  pattern?: string
  minimum?: number
  maximum?: number
  multipleOf?: number
  default?: unknown
  const?: unknown
  oneOf?: JsonSchema[]
  items?: JsonSchema
  uniqueItems?: boolean
  minItems?: number
  maxItems?: number
}

/**
 * Presentation hints that JSON Schema cannot express (e.g. radio vs dropdown).
 * Follows the react-jsonschema-form (RJSF) `uiSchema` conventions so the output
 * can be rendered directly by RJSF, but the keys are simple enough to consume
 * from any renderer.
 */
export interface UiFieldSchema {
  "ui:widget"?:
    "textarea" | "radio" | "checkboxes" | "select" | "date" | "email"
  "ui:placeholder"?: string
  "ui:options"?: Record<string, unknown>
}

export type UiSchema = { "ui:order": string[] } & {
  [propertyKey: string]: UiFieldSchema | string[]
}

export interface GeneratedSchema {
  schema: JsonSchema
  uiSchema: UiSchema
}
