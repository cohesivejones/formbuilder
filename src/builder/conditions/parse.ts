import type { Condition, Literal } from "./model"

/**
 * The expression language admins type. It parses into a `Condition` tree; the
 * text itself is never stored or evaluated.
 *
 *   hasAllergies = true
 *   contactMethod = 'phone' or contactMethod = 'sms'
 *   services contains 'other' and householdSize >= 3
 *   not (region is empty)
 *
 * Fields are referred to by key, because keys are what the admin can see, and
 * resolved to ids at parse time so a later rename breaks nothing.
 */

export interface ParseField {
  id: string
  key: string
}

export interface ParseContext {
  fields: readonly ParseField[]
  /** The field the rule belongs to. A rule about itself is always a mistake. */
  selfId?: string
}

export type ParseResult =
  { ok: true; condition: Condition | null } | { ok: false; error: string }

type Token =
  | { kind: "ident"; text: string }
  | { kind: "number"; value: number }
  | { kind: "string"; value: string }
  | { kind: "symbol"; text: "=" | "!=" | ">" | ">=" | "<" | "<=" | "(" | ")" }

const KEYWORDS = new Set([
  "and",
  "or",
  "not",
  "is",
  "empty",
  "contains",
  "true",
  "false",
])

class ParseError extends Error {}

export function parseCondition(
  text: string,
  context: ParseContext,
): ParseResult {
  if (text.trim() === "") return { ok: true, condition: null }
  try {
    const parser = new Parser(tokenize(text), context)
    const condition = parser.parseOr()
    parser.expectEnd()
    return { ok: true, condition }
  } catch (error) {
    if (error instanceof ParseError) return { ok: false, error: error.message }
    throw error
  }
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < input.length) {
    const ch = input[i]
    if (/\s/.test(ch)) {
      i += 1
    } else if (ch === "(" || ch === ")") {
      tokens.push({ kind: "symbol", text: ch })
      i += 1
    } else if (ch === "'" || ch === '"') {
      const end = input.indexOf(ch, i + 1)
      if (end === -1)
        throw new ParseError(
          `A value starting with ${ch} is missing its closing quote`,
        )
      tokens.push({ kind: "string", value: input.slice(i + 1, end) })
      i = end + 1
    } else if (ch === "!" && input[i + 1] === "=") {
      tokens.push({ kind: "symbol", text: "!=" })
      i += 2
    } else if (ch === ">" || ch === "<") {
      const two = input[i + 1] === "="
      const text = (two ? `${ch}=` : ch) as ">" | ">=" | "<" | "<="
      tokens.push({ kind: "symbol", text })
      i += two ? 2 : 1
    } else if (ch === "=") {
      tokens.push({ kind: "symbol", text: "=" })
      i += 1
    } else if (
      /[0-9]/.test(ch) ||
      (ch === "-" && /[0-9]/.test(input[i + 1] ?? ""))
    ) {
      const match = /^-?[0-9]+(\.[0-9]+)?/.exec(input.slice(i))!
      tokens.push({ kind: "number", value: Number(match[0]) })
      i += match[0].length
    } else if (/[A-Za-z_]/.test(ch)) {
      const match = /^[A-Za-z_][A-Za-z0-9_]*/.exec(input.slice(i))!
      tokens.push({ kind: "ident", text: match[0] })
      i += match[0].length
    } else {
      throw new ParseError(`Unexpected character "${ch}"`)
    }
  }
  return tokens
}

class Parser {
  private position = 0
  private readonly tokens: Token[]
  private readonly context: ParseContext

  constructor(tokens: Token[], context: ParseContext) {
    this.tokens = tokens
    this.context = context
  }

  parseOr(): Condition {
    const parts = [this.parseAnd()]
    while (this.takeKeyword("or")) parts.push(this.parseAnd())
    return parts.length === 1 ? parts[0] : { op: "or", conditions: parts }
  }

  private parseAnd(): Condition {
    const parts = [this.parseNot()]
    while (this.takeKeyword("and")) parts.push(this.parseNot())
    return parts.length === 1 ? parts[0] : { op: "and", conditions: parts }
  }

  private parseNot(): Condition {
    if (this.takeKeyword("not"))
      return { op: "not", condition: this.parseNot() }
    return this.parsePrimary()
  }

  private parsePrimary(): Condition {
    const token = this.peek()
    if (!token)
      throw new ParseError("The condition ends where a field name was expected")
    if (token.kind === "symbol" && token.text === "(") {
      this.position += 1
      const inner = this.parseOr()
      const closing = this.next()
      if (!closing || closing.kind !== "symbol" || closing.text !== ")") {
        throw new ParseError("Missing a closing )")
      }
      return inner
    }
    return this.parseComparison()
  }

  private parseComparison(): Condition {
    const token = this.next()
    if (
      !token ||
      token.kind !== "ident" ||
      KEYWORDS.has(token.text.toLowerCase())
    ) {
      throw new ParseError(
        `Expected a field name${token ? `, found "${describe(token)}"` : ""}`,
      )
    }
    const field = this.resolveField(token.text)

    const operator = this.next()
    if (!operator) {
      throw new ParseError(
        `"${token.text}" needs a comparison, such as = or contains`,
      )
    }

    if (
      operator.kind === "symbol" &&
      (operator.text === "=" || operator.text === "!=")
    ) {
      const value = this.parseLiteral()
      return { op: operator.text === "=" ? "eq" : "ne", field, value }
    }

    if (
      operator.kind === "symbol" &&
      (operator.text === ">" ||
        operator.text === ">=" ||
        operator.text === "<" ||
        operator.text === "<=")
    ) {
      const value = this.parseLiteral()
      if (typeof value !== "number") {
        throw new ParseError(
          `${operator.text} compares numbers; ${literalText(value)} is not one`,
        )
      }
      const op = { ">": "gt", ">=": "gte", "<": "lt", "<=": "lte" } as const
      return { op: op[operator.text], field, value }
    }

    if (
      operator.kind === "ident" &&
      operator.text.toLowerCase() === "contains"
    ) {
      const value = this.parseLiteral()
      if (typeof value !== "string") {
        throw new ParseError(
          "contains expects a quoted value, such as contains 'other'",
        )
      }
      return { op: "contains", field, value }
    }

    if (operator.kind === "ident" && operator.text.toLowerCase() === "is") {
      if (this.takeKeyword("empty")) return { op: "empty", field }
      if (this.takeKeyword("not") && this.takeKeyword("empty"))
        return { op: "notEmpty", field }
      throw new ParseError(`After "is", expected "empty" or "not empty"`)
    }

    throw new ParseError(
      `Expected a comparison after "${token.text}", found "${describe(operator)}"`,
    )
  }

  private parseLiteral(): Literal {
    const token = this.next()
    if (!token)
      throw new ParseError("The condition ends where a value was expected")
    if (token.kind === "number") return token.value
    if (token.kind === "string") return token.value
    if (token.kind === "ident") {
      const lower = token.text.toLowerCase()
      if (lower === "true") return true
      if (lower === "false") return false
      throw new ParseError(`Values need quotes: did you mean '${token.text}'?`)
    }
    throw new ParseError(`Expected a value, found "${describe(token)}"`)
  }

  private resolveField(key: string): string {
    const match = this.context.fields.find((f) => f.key === key)
    if (match) {
      if (match.id === this.context.selfId) {
        throw new ParseError(
          "A condition cannot refer to the field it belongs to",
        )
      }
      return match.id
    }
    const suggestion = closestKey(key, this.context.fields)
    throw new ParseError(
      `Unknown field "${key}"${suggestion ? ` — did you mean ${suggestion}?` : ""}`,
    )
  }

  private peek(): Token | undefined {
    return this.tokens[this.position]
  }

  private next(): Token | undefined {
    return this.tokens[this.position++]
  }

  private takeKeyword(word: string): boolean {
    const token = this.peek()
    if (token?.kind === "ident" && token.text.toLowerCase() === word) {
      this.position += 1
      return true
    }
    return false
  }

  expectEnd(): void {
    const token = this.peek()
    if (token)
      throw new ParseError(
        `Unexpected "${describe(token)}" after the condition`,
      )
  }
}

function describe(token: Token): string {
  if (token.kind === "number") return String(token.value)
  if (token.kind === "string") return `'${token.value}'`
  return token.kind === "ident" ? token.text : token.text
}

function literalText(value: Literal): string {
  return typeof value === "string" ? `'${value}'` : String(value)
}

function closestKey(
  input: string,
  fields: readonly ParseField[],
): string | undefined {
  let best: string | undefined
  let bestDistance = 3
  for (const field of fields) {
    if (!field.key) continue
    const key = field.key.toLowerCase()
    const typed = input.toLowerCase()
    // Compare against the key's prefix too, so a typo in the start of a long
    // key ("houshold" for householdSize) still earns a suggestion.
    const distance = Math.min(
      levenshtein(typed, key),
      levenshtein(typed, key.slice(0, typed.length + 1)),
    )
    if (distance < bestDistance) {
      best = field.key
      bestDistance = distance
    }
  }
  return best
}

function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const current = row[j]
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        previous + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
      previous = current
    }
  }
  return row[b.length]
}
