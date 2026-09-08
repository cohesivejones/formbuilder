import { describe, expect, it } from "vitest"
import { createSampleForm } from "../builder/model/sample"
import { parseFormDefinition } from "./parseFormDefinition"

function errorFor(text: string): string {
  const result = parseFormDefinition(text)
  if (result.ok) throw new Error("expected a failure")
  return result.error
}

describe("parseFormDefinition", () => {
  it("round-trips a form the builder produced", () => {
    const form = createSampleForm()
    const result = parseFormDefinition(JSON.stringify(form))
    expect(result).toEqual({ ok: true, form })
  })

  it("fills in a missing title and description", () => {
    const result = parseFormDefinition('{ "fields": [] }')
    expect(result).toEqual({
      ok: true,
      form: { title: "Untitled form", description: "", fields: [] },
    })
  })

  it("asks for input when given none", () => {
    expect(errorFor("   ")).toBe("Paste a form definition first.")
  })

  it("reports malformed JSON", () => {
    expect(errorFor("{ nope }")).toMatch(/not valid JSON/)
  })

  it("rejects values that are not an object", () => {
    expect(errorFor("[]")).toMatch(/Expected a JSON object/)
    expect(errorFor('"hello"')).toMatch(/Expected a JSON object/)
  })

  it("recognises a JSON Schema pasted by mistake", () => {
    const schema = JSON.stringify({ type: "object", properties: {} })
    expect(errorFor(schema)).toMatch(/looks like a JSON Schema/)
  })

  it("names the field that is malformed", () => {
    expect(
      errorFor('{ "fields": [{ "id": "a", "type": "text" }, { "id": "b" }] }'),
    ).toBe("Field 2 is missing a type.")
    expect(errorFor('{ "fields": [{ "type": "text" }] }')).toBe(
      'Field 1 ("text") is missing an id.',
    )
    expect(
      errorFor('{ "fields": [{ "id": "a", "type": "text", "props": 3 }] }'),
    ).toBe('Field 1 ("text") has props that are not an object.')
  })
})
