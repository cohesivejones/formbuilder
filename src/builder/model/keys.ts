/**
 * Helpers for generating JSON Schema property keys from labels.
 */

const KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

export function isValidKey(key: string): boolean {
  return KEY_PATTERN.test(key)
}

/**
 * Turns a human label into a camelCase identifier.
 * "First name"  -> "firstName"
 * "E-mail (work)" -> "eMailWork"
 * "2nd choice" -> "_2ndChoice"
 */
export function slugifyKey(label: string): string {
  const words = label
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)

  if (words.length === 0) return "field"

  const [first, ...rest] = words
  const camel =
    first.toLowerCase() +
    rest
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join("")

  return /^[0-9]/.test(camel) ? `_${camel}` : camel
}

/**
 * Returns `base` if it is not in `taken`, otherwise appends the smallest
 * numeric suffix that makes it unique ("name", "name2", "name3", ...).
 */
export function uniqueKey(base: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  if (!used.has(base)) return base
  let n = 2
  while (used.has(`${base}${n}`)) n += 1
  return `${base}${n}`
}

let counter = 0

/** Generates a short, unique id for internal use (fields and options). */
export function newId(prefix = "f"): string {
  counter += 1
  const random = Math.random().toString(36).slice(2, 8)
  return `${prefix}_${counter.toString(36)}${random}`
}
