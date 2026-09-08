import type { FormDefinition, FormField } from "../builder"

export type ParseResult =
  { ok: true; form: FormDefinition } | { ok: false; error: string }

/**
 * Reads a pasted form definition. The text comes from a person, so every
 * assumption is checked and reported in a sentence they can act on rather
 * than thrown.
 */
export function parseFormDefinition(text: string): ParseResult {
  if (text.trim() === "")
    return { ok: false, error: "Paste a form definition first." }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    return {
      ok: false,
      error: `That is not valid JSON: ${(error as Error).message}`,
    }
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: "Expected a JSON object with a fields array." }
  }

  const candidate = parsed as Partial<FormDefinition>
  if (!Array.isArray(candidate.fields)) {
    return {
      ok: false,
      error:
        "This looks like a JSON Schema rather than a form definition. Copy the definition from the builder instead.",
    }
  }

  for (const [index, field] of candidate.fields.entries()) {
    const problem = checkField(field, index)
    if (problem) return { ok: false, error: problem }
  }

  return {
    ok: true,
    form: {
      title:
        typeof candidate.title === "string" ? candidate.title : "Untitled form",
      description:
        typeof candidate.description === "string" ? candidate.description : "",
      fields: candidate.fields as FormField[],
    },
  }
}

function checkField(field: unknown, index: number): string | undefined {
  const position = `Field ${index + 1}`
  if (typeof field !== "object" || field === null) {
    return `${position} is not an object.`
  }
  const f = field as Partial<FormField>
  if (typeof f.type !== "string" || f.type === "") {
    return `${position} is missing a type.`
  }
  if (typeof f.id !== "string" || f.id === "") {
    return `${position} ("${f.type}") is missing an id.`
  }
  if (
    f.props !== undefined &&
    (typeof f.props !== "object" || f.props === null)
  ) {
    return `${position} ("${f.type}") has props that are not an object.`
  }
  return undefined
}
