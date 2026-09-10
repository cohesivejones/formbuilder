import type { FormField } from "../model/types"
import type { Condition } from "./model"

export type AnswerData = Record<string, unknown>

/**
 * Evaluates a condition against answers keyed by field key. Total: a broken
 * reference or a type mismatch is simply false, never an exception, because
 * this runs on every keystroke of a respondent.
 */
export function evaluateCondition(
  condition: Condition,
  data: AnswerData,
  keyById: ReadonlyMap<string, string>,
): boolean {
  switch (condition.op) {
    case "and":
      return condition.conditions.every((c) =>
        evaluateCondition(c, data, keyById),
      )
    case "or":
      return condition.conditions.some((c) =>
        evaluateCondition(c, data, keyById),
      )
    case "not":
      return !evaluateCondition(condition.condition, data, keyById)
  }

  const key = keyById.get(condition.field)
  const value = key === undefined ? undefined : data[key]

  switch (condition.op) {
    case "eq":
      return value === condition.value
    case "ne":
      return value !== condition.value
    case "gt":
      return typeof value === "number" && value > condition.value
    case "gte":
      return typeof value === "number" && value >= condition.value
    case "lt":
      return typeof value === "number" && value < condition.value
    case "lte":
      return typeof value === "number" && value <= condition.value
    case "contains":
      if (Array.isArray(value)) return value.includes(condition.value)
      return typeof value === "string" && value.includes(condition.value)
    case "empty":
      return isEmpty(value)
    case "notEmpty":
      return !isEmpty(value)
  }
}

function isEmpty(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  )
}

export function keyByIdOf(fields: readonly FormField[]): Map<string, string> {
  return new Map(fields.filter((f) => f.key).map((f) => [f.id, f.key]))
}

/**
 * Which fields are visible given the current answers.
 *
 * A hidden field's answer must not influence anything, or hiding a controlling
 * field would leave its dependents dangling: if X shows Y and Y shows Z, hiding
 * X has to take Z down too. So visibility is found by iterating to a fixpoint,
 * each round evaluating every rule against only the answers of fields still
 * visible. The iteration count is capped, which also makes a rule cycle
 * terminate; validation reports cycles to the author separately.
 */
export function resolveVisibility(
  fields: readonly FormField[],
  values: AnswerData,
): Set<string> {
  const keyById = keyByIdOf(fields)
  let visible = new Set(fields.map((f) => f.id))

  for (let round = 0; round <= fields.length; round++) {
    const data: AnswerData = {}
    for (const field of fields) {
      if (field.key && visible.has(field.id))
        data[field.key] = values[field.key]
    }
    const next = new Set<string>()
    for (const field of fields) {
      if (
        !field.visibleWhen ||
        evaluateCondition(field.visibleWhen, data, keyById)
      ) {
        next.add(field.id)
      }
    }
    if (next.size === visible.size && [...next].every((id) => visible.has(id)))
      break
    visible = next
  }

  return visible
}

/** The answers restricted to visible fields — what validation and submission see. */
export function visibleValues(
  fields: readonly FormField[],
  values: AnswerData,
  visible: ReadonlySet<string>,
): AnswerData {
  const result: AnswerData = {}
  for (const field of fields) {
    if (field.key && visible.has(field.id) && values[field.key] !== undefined) {
      result[field.key] = values[field.key]
    }
  }
  return result
}
