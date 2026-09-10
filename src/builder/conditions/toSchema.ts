import type { JsonSchema } from "../schema/jsonSchemaTypes"
import type { Condition } from "./model"

export interface ConditionSchemaContext {
  /** Current key for a field id; undefined when the field no longer exists. */
  keyOf(fieldId: string): string | undefined
  /** Whether the referenced field's data is an array (a checkbox group). */
  isArrayField(fieldId: string): boolean
}

/**
 * Compiles a condition into a JSON Schema fragment that holds exactly when the
 * condition does, assuming unanswered fields are absent (which `prune`
 * guarantees before validation). Used inside `if`, so conditional requirements
 * ride the exported schema and any Ajv-style validator enforces them without
 * knowing our condition language.
 *
 * A reference to a field that no longer exists compiles to a schema that never
 * matches: the requirement simply never triggers, and validation reports the
 * broken rule to the author instead.
 */
export function conditionToSchema(
  condition: Condition,
  context: ConditionSchemaContext,
): JsonSchema {
  const NEVER: JsonSchema = { not: {} }

  switch (condition.op) {
    case "and":
      return {
        allOf: condition.conditions.map((c) => conditionToSchema(c, context)),
      }
    case "or":
      return {
        anyOf: condition.conditions.map((c) => conditionToSchema(c, context)),
      }
    case "not":
      return { not: conditionToSchema(condition.condition, context) }
  }

  const key = context.keyOf(condition.field)
  if (key === undefined) return NEVER

  switch (condition.op) {
    case "eq":
      return {
        properties: { [key]: { const: condition.value } },
        required: [key],
      }
    case "ne":
      // True when absent as well as when different, matching the evaluator.
      return {
        not: {
          properties: { [key]: { const: condition.value } },
          required: [key],
        },
      }
    // The explicit types mirror the evaluator, where a comparison against a
    // value of the wrong shape is simply false.
    case "gt":
      return {
        properties: {
          [key]: { type: "number", exclusiveMinimum: condition.value },
        },
        required: [key],
      }
    case "gte":
      return {
        properties: { [key]: { type: "number", minimum: condition.value } },
        required: [key],
      }
    case "lt":
      return {
        properties: {
          [key]: { type: "number", exclusiveMaximum: condition.value },
        },
        required: [key],
      }
    case "lte":
      return {
        properties: { [key]: { type: "number", maximum: condition.value } },
        required: [key],
      }
    case "contains":
      return context.isArrayField(condition.field)
        ? {
            properties: {
              [key]: { type: "array", contains: { const: condition.value } },
            },
            required: [key],
          }
        : {
            properties: {
              [key]: { type: "string", pattern: escapeRegex(condition.value) },
            },
            required: [key],
          }
    // Pruning strips empty strings and arrays, so empty means absent. The
    // property stub carries no constraint; Ajv's strictest mode wants every
    // `required` name declared beside it.
    case "empty":
      return { not: { properties: { [key]: {} }, required: [key] } }
    case "notEmpty":
      return { properties: { [key]: {} }, required: [key] }
  }
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
