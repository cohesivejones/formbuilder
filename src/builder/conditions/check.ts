import type { FieldTypeRegistry } from "../model/registry"
import type { FormField } from "../model/types"
import type { Condition, Literal } from "./model"

/**
 * Semantic checking, the layer above syntax. A rule can parse cleanly and
 * still be one that never matches: 'phome' for a radio whose options are
 * phone/email/none, an ordering comparison against a text field, equality
 * against a multi-choice list. Each of those is reported in the author's
 * terms, at typing time and again by form validation, since an option renamed
 * later can invalidate a stored rule.
 *
 * A field's value shape is read from its own `toJsonSchema` mapping, so custom
 * types are covered without declaring anything new.
 */
export function checkCondition(
  condition: Condition,
  fields: readonly FormField[],
  registry: FieldTypeRegistry,
): string[] {
  const byId = new Map(fields.map((f) => [f.id, f]))
  const issues: string[] = []

  const walk = (c: Condition): void => {
    switch (c.op) {
      case "and":
      case "or":
        for (const inner of c.conditions) walk(inner)
        return
      case "not":
        walk(c.condition)
        return
    }

    const field = byId.get(c.field)
    if (!field) return // a broken reference is reported separately
    const info = fieldValueInfo(field, registry)
    if (info.kind === "unknown") return
    const key = field.key

    switch (c.op) {
      case "eq":
      case "ne":
        if (info.kind === "list") {
          const example = typeof c.value === "string" ? c.value : "…"
          issues.push(
            `${key} holds a list — use "${key} contains '${example}'" instead`,
          )
        } else if (!literalFits(info.kind, c.value)) {
          issues.push(
            `${key} holds ${info.noun}, so it will never equal ${literal(c.value)}`,
          )
        } else if (info.options && !info.options.includes(c.value)) {
          issues.push(
            `${key} has no option ${literal(c.value)} — its options are ${optionList(info.options)}`,
          )
        }
        return
      case "gt":
      case "gte":
      case "lt":
      case "lte":
        if (info.kind !== "number") {
          issues.push(
            `${SYMBOL[c.op]} compares numbers, but ${key} holds ${info.noun}`,
          )
        }
        return
      case "contains":
        if (info.kind === "number" || info.kind === "boolean") {
          issues.push(
            `contains needs a list or text, but ${key} holds ${info.noun}`,
          )
        } else if (
          info.kind === "list" &&
          info.options &&
          !info.options.includes(c.value)
        ) {
          issues.push(
            `${key} has no option ${literal(c.value)} — its options are ${optionList(info.options)}`,
          )
        }
        return
      case "empty":
      case "notEmpty":
        return
    }
  }

  walk(condition)
  return issues
}

const SYMBOL = { gt: ">", gte: ">=", lt: "<", lte: "<=" } as const

export interface FieldValueInfo {
  kind: "text" | "number" | "boolean" | "list" | "unknown"
  noun: string
  /** For choice fields, the values an answer can take. */
  options?: Literal[]
}

/**
 * The shape of the answers a field produces, read from its own schema mapping.
 * The semantic checker and the rule-row builder both draw on it.
 */
export function fieldValueInfo(
  field: FormField,
  registry: FieldTypeRegistry,
): FieldValueInfo {
  const schema = registry.resolve(field.type).toJsonSchema?.(field)
  if (!schema) return { kind: "unknown", noun: "an unknown value" }

  switch (schema.type) {
    case "string":
      return {
        kind: "text",
        noun:
          schema.format === "date"
            ? "a date"
            : schema.format === "email"
              ? "an email address"
              : "text",
        options: consts(schema.oneOf),
      }
    case "number":
    case "integer":
      return { kind: "number", noun: "a number" }
    case "boolean":
      return { kind: "boolean", noun: "true or false" }
    case "array":
      return {
        kind: "list",
        noun: "a list",
        options: consts(schema.items?.oneOf),
      }
    default:
      return { kind: "unknown", noun: "an unknown value" }
  }
}

function consts(
  oneOf: Array<{ const?: unknown }> | undefined,
): Literal[] | undefined {
  if (!oneOf || oneOf.length === 0) return undefined
  const values = oneOf
    .map((branch) => branch.const)
    .filter(
      (v): v is Literal =>
        typeof v === "string" ||
        typeof v === "number" ||
        typeof v === "boolean",
    )
  return values.length > 0 ? values : undefined
}

function literalFits(kind: FieldValueInfo["kind"], value: Literal): boolean {
  if (kind === "text") return typeof value === "string"
  if (kind === "number") return typeof value === "number"
  if (kind === "boolean") return typeof value === "boolean"
  return true
}

function literal(value: Literal): string {
  return typeof value === "string" ? `'${value}'` : String(value)
}

function optionList(options: Literal[]): string {
  const shown = options.slice(0, 6).map(literal).join(", ")
  return options.length > 6 ? `${shown}, …` : shown
}
