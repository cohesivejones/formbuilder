import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020"
import addFormats from "ajv-formats"
import type { JsonSchema } from "../schema/jsonSchemaTypes"

export type SubmissionData = Record<string, unknown>
/** Error messages by field key. */
export type SubmissionErrors = Record<string, string>

/**
 * Validates answers against the JSON Schema the builder emits, so the renderer
 * enforces exactly what the schema describes rather than a parallel set of
 * rules. Ajv's messages are terse, so each is rewritten in the words a
 * respondent would expect.
 */
export function createSubmissionValidator(schema: JsonSchema) {
  const ajv = new Ajv2020({ strict: false, allErrors: true })
  addFormats(ajv)
  let validate: ValidateFunction | null = null
  try {
    validate = ajv.compile(schema as object)
  } catch {
    // A schema the builder itself flagged as broken; nothing to enforce.
    validate = null
  }

  return function validateSubmission(data: SubmissionData): SubmissionErrors {
    if (!validate) return {}
    if (validate(prune(data))) return {}

    const errors: SubmissionErrors = {}
    for (const error of validate.errors ?? []) {
      const key = fieldKeyOf(error)
      // The first error on a field is the specific one; later ones are usually
      // the `oneOf` summary that follows it.
      if (key && !errors[key]) errors[key] = messageFor(error)
    }
    return errors
  }
}

/**
 * Drops answers the respondent has not given, so `required` reports them as
 * missing rather than an empty string failing some other keyword.
 */
export function prune(data: SubmissionData): SubmissionData {
  const pruned: SubmissionData = {}
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue
    if (typeof value === "string" && value.trim() === "") continue
    if (Array.isArray(value) && value.length === 0) continue
    pruned[key] = value
  }
  return pruned
}

function fieldKeyOf(error: ErrorObject): string | undefined {
  if (error.keyword === "required") {
    return (error.params as { missingProperty?: string }).missingProperty
  }
  // "/likes/0" belongs to the field "likes".
  const [, key] = error.instancePath.split("/")
  return key || undefined
}

function messageFor(error: ErrorObject): string {
  const params = error.params as Record<string, unknown>
  const limit = params.limit as number | undefined

  switch (error.keyword) {
    case "required":
      return "This field is required"
    case "format":
      return params.format === "email"
        ? "Enter a valid email address"
        : params.format === "date"
          ? "Enter a valid date"
          : `Enter a valid ${String(params.format)}`
    case "minLength":
      return `Enter at least ${limit} character${limit === 1 ? "" : "s"}`
    case "maxLength":
      return `Enter no more than ${limit} character${limit === 1 ? "" : "s"}`
    case "pattern":
      return "This does not match the expected format"
    case "minimum":
      return `Enter ${limit} or more`
    case "maximum":
      return `Enter ${limit} or less`
    case "multipleOf":
      return `Enter a multiple of ${limit}`
    case "type":
      return params.type === "integer"
        ? "Enter a whole number"
        : `Enter a ${String(params.type)}`
    case "minItems":
      return `Choose at least ${limit} option${limit === 1 ? "" : "s"}`
    case "maxItems":
      return `Choose no more than ${limit} option${limit === 1 ? "" : "s"}`
    case "uniqueItems":
      return "Each option may only be chosen once"
    case "const":
    case "oneOf":
    case "enum":
      return "Choose one of the available options"
    case "additionalProperties":
      return "This answer is not part of the form"
    default:
      return error.message ?? "This answer is not valid"
  }
}
