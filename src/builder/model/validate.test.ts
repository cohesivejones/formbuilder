import { describe, expect, it } from "vitest"
import { field } from "../../test/fields"
import { createField } from "./fieldRegistry"
import type { FormDefinition, FormField } from "./types"
import { validateForm } from "./validate"

function form(fields: FormField[]): FormDefinition {
  return { title: "t", description: "", fields }
}

function messages(fields: FormField[]) {
  return validateForm(form(fields)).map((i) => i.message)
}

describe("validateForm", () => {
  it("passes a clean form", () => {
    expect(
      messages([createField("text", "a"), createField("select", "b")]),
    ).toEqual([])
  })

  it("flags duplicate keys on every offending field", () => {
    const a = createField("text", "same")
    const b = createField("text", "same")
    const issues = validateForm(form([a, b]))
    expect(issues.map((i) => i.fieldId)).toEqual([a.id, b.id])
    expect(issues[0].message).toMatch(/more than one field/)
  })

  it("flags invalid and empty keys", () => {
    expect(messages([createField("text", "1bad")])).toEqual([
      expect.stringMatching(/valid identifier/),
    ])
    expect(messages([createField("text", "")])).toEqual(["Key is empty"])
  })

  it("flags empty labels", () => {
    expect(messages([field("text", "a", { label: " " })])).toEqual([
      "Label is empty",
    ])
  })

  it("flags invalid regex patterns and inverted ranges", () => {
    expect(
      messages([
        field("text", "a", { pattern: "(" }),
        field("text", "b", { minLength: 5, maxLength: 2 }),
        field("number", "c", { min: 5, max: 2 }),
      ]),
    ).toEqual([
      "Pattern is not a valid regular expression",
      "Minimum length is greater than maximum length",
      "Minimum is greater than maximum",
    ])
  })

  it("flags option problems", () => {
    expect(messages([field("radio", "r", { options: [] })])).toEqual([
      "Has no options",
    ])
    expect(
      messages([
        field("radio", "r", {
          options: [
            { id: "1", label: "A", value: "x" },
            { id: "2", label: "B", value: "x" },
            { id: "3", label: "C", value: "" },
          ],
        }),
      ]),
    ).toEqual([
      'Option value "x" is duplicated',
      "An option has an empty value",
    ])
  })
})
