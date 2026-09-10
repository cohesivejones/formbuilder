import type { Condition, Literal } from "./model"

export interface PrintField {
  id: string
  key: string
  label?: string
}

export interface PrintOptions {
  /**
   * "key" (the default) round-trips through the parser. "label" reads better
   * on paper, where nobody will parse the result back.
   */
  names?: "key" | "label"
}

/**
 * Turns a stored condition back into the expression language. Field ids are
 * shown as their current keys, so a rule follows renames; an id whose field is
 * gone is printed as-is, which validation flags separately.
 */
export function printCondition(
  condition: Condition,
  fields: readonly PrintField[],
  options: PrintOptions = {},
): string {
  const byId = new Map(fields.map((f) => [f.id, f]))
  const nameOf = (id: string) => {
    const field = byId.get(id)
    if (!field) return id
    return options.names === "label"
      ? field.label || field.key || id
      : field.key || id
  }
  return print(condition, nameOf, 0)
}

const PRECEDENCE = { or: 1, and: 2, not: 3 } as const

function print(
  condition: Condition,
  nameOf: (id: string) => string,
  parent: number,
): string {
  switch (condition.op) {
    case "and":
    case "or": {
      const mine = PRECEDENCE[condition.op]
      const text = condition.conditions
        .map((c) => print(c, nameOf, mine))
        .join(` ${condition.op} `)
      return mine < parent ? `(${text})` : text
    }
    case "not":
      return `not ${print(condition.condition, nameOf, PRECEDENCE.not)}`
    case "eq":
      return `${nameOf(condition.field)} = ${literal(condition.value)}`
    case "ne":
      return `${nameOf(condition.field)} != ${literal(condition.value)}`
    case "gt":
      return `${nameOf(condition.field)} > ${condition.value}`
    case "gte":
      return `${nameOf(condition.field)} >= ${condition.value}`
    case "lt":
      return `${nameOf(condition.field)} < ${condition.value}`
    case "lte":
      return `${nameOf(condition.field)} <= ${condition.value}`
    case "contains":
      return `${nameOf(condition.field)} contains ${literal(condition.value)}`
    case "empty":
      return `${nameOf(condition.field)} is empty`
    case "notEmpty":
      return `${nameOf(condition.field)} is not empty`
  }
}

function literal(value: Literal): string {
  if (typeof value === "string") {
    return value.includes("'") ? `"${value}"` : `'${value}'`
  }
  return String(value)
}

/**
 * The condition with field ids swapped for keys, for putting into exported
 * documents that consumers read without knowing our internal ids.
 */
export function conditionWithKeys(
  condition: Condition,
  fields: readonly PrintField[],
): Condition {
  const keyOf = (id: string) => fields.find((f) => f.id === id)?.key ?? id
  const map = (c: Condition): Condition => {
    switch (c.op) {
      case "and":
      case "or":
        return { op: c.op, conditions: c.conditions.map(map) }
      case "not":
        return { op: "not", condition: map(c.condition) }
      default:
        return { ...c, field: keyOf(c.field) }
    }
  }
  return map(condition)
}
