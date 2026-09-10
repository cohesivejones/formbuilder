/**
 * Conditional logic, stored as data.
 *
 * A condition is a small expression tree referencing other fields by their
 * stable internal `id` (never the key, which follows the label until locked).
 * Trees are what the form definition stores, what the renderer and any server
 * evaluate, and what the exporter compiles to JSON Schema. The expression
 * language (see parse.ts) is only an editing surface over this shape, so no
 * consumer ever needs a parser and nothing is ever eval'd — the property that
 * keeps rules CSP-safe and enforceable outside the browser.
 */

export type Literal = string | number | boolean

export type Condition =
  | { op: "and" | "or"; conditions: Condition[] }
  | { op: "not"; condition: Condition }
  | { op: "eq" | "ne"; field: string; value: Literal }
  | { op: "gt" | "gte" | "lt" | "lte"; field: string; value: number }
  | { op: "contains"; field: string; value: string }
  | { op: "empty" | "notEmpty"; field: string }

/** Every field id a condition refers to, duplicates included. */
export function referencedFields(condition: Condition): string[] {
  switch (condition.op) {
    case "and":
    case "or":
      return condition.conditions.flatMap(referencedFields)
    case "not":
      return referencedFields(condition.condition)
    default:
      return [condition.field]
  }
}
