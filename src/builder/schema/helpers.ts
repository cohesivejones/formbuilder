import type { FieldOption } from "../model/types"
import type { JsonSchema } from "./jsonSchemaTypes"

/**
 * Small helpers for writing `toJsonSchema` / `toUiSchema` mappers. Each returns
 * an object to spread, so optional keywords only appear when they have a value.
 */

/** `{ key: value }` only when value is a non-empty string. */
export function nonEmpty<K extends string>(
  key: K,
  value: unknown,
): Partial<Record<K, string>> {
  const trimmed = typeof value === "string" ? value.trim() : ""
  return trimmed ? ({ [key]: trimmed } as Record<K, string>) : {}
}

/** `{ key: value }` only when value is defined. */
export function defined<K extends string, V>(
  key: K,
  value: V | undefined,
): Partial<Record<K, V>> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V>)
}

/**
 * Builds `oneOf: [{ const, title }]` from options, dropping duplicate values
 * (a value matching two `oneOf` branches would make the schema unsatisfiable).
 * Returns an empty object when there are no options so the schema stays valid.
 */
export function oneOfOptions(
  options: FieldOption[] | undefined,
): Pick<JsonSchema, "oneOf"> {
  const seen = new Set<string>()
  const oneOf: JsonSchema[] = []
  for (const option of options ?? []) {
    if (seen.has(option.value)) continue
    seen.add(option.value)
    oneOf.push({ const: option.value, title: option.label })
  }
  return oneOf.length > 0 ? { oneOf } : {}
}

export function isValidRegex(pattern: unknown): boolean {
  if (typeof pattern !== "string" || pattern === "") return true
  try {
    new RegExp(pattern)
    return true
  } catch {
    return false
  }
}

/** `{ pattern }` only when it is a non-empty, valid regular expression. */
export function validPattern(pattern: unknown): Pick<JsonSchema, "pattern"> {
  return typeof pattern === "string" && pattern !== "" && isValidRegex(pattern)
    ? { pattern }
    : {}
}
