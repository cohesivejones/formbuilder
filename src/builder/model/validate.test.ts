import { describe, expect, it } from "vitest"
import { builtInFieldTypes } from "../fieldTypes/builtIns"
import { field, testRegistry } from "../../test/fields"
import { createField, defineFieldType } from "./fieldType"
import { createRegistry } from "./registry"
import type { FormDefinition, FormField } from "./types"
import { validateForm } from "./validate"

function form(fields: FormField[]): FormDefinition {
  return { title: "t", description: "", fields }
}

function messages(fields: FormField[], registry = testRegistry) {
  return validateForm(form(fields), registry).map((i) => i.message)
}

describe("validateForm", () => {
  it("passes a clean form", () => {
    expect(messages([field("text", "a"), field("select", "b")])).toEqual([])
  })

  it("flags duplicate keys on every offending field", () => {
    const a = field("text", "same")
    const b = field("text", "same")
    const issues = validateForm(form([a, b]), testRegistry)
    expect(issues.map((i) => i.fieldId)).toEqual([a.id, b.id])
    expect(issues[0].message).toMatch(/more than one field/)
  })

  it("flags invalid and empty keys", () => {
    expect(messages([field("text", "1bad")])).toEqual([
      expect.stringMatching(/valid identifier/),
    ])
    expect(messages([field("text", "")])).toEqual(["Key is empty"])
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

  it("flags unregistered types without running their validation", () => {
    const ghost = { ...field("text", "g"), type: "vanished" }
    expect(messages([ghost])).toEqual([
      'Field type "vanished" is not registered',
    ])
  })

  it("does not require keys on dataless fields and enforces maxInstances", () => {
    const slot = defineFieldType({
      type: "slot",
      label: "Slot",
      dataless: true,
      maxInstances: 1,
      defaults: {},
    })
    const registry = createRegistry([...builtInFieldTypes, slot])
    expect(messages([createField(slot, "")], registry)).toEqual([])
    expect(
      messages([createField(slot, ""), createField(slot, "")], registry),
    ).toEqual([
      "Only one Slot field is allowed",
      "Only one Slot field is allowed",
    ])
  })

  it("runs a type's own validate hook", () => {
    const picky = defineFieldType<{ max: number }>({
      type: "picky",
      label: "Picky",
      defaults: { max: 0 },
      validate: ({ props }) => (props.max <= 0 ? ["Max must be positive"] : []),
    })
    const registry = createRegistry([picky])
    expect(messages([createField(picky, "p")], registry)).toEqual([
      "Max must be positive",
    ])
  })
})

describe("validateForm conditions", () => {
  it("passes rules that refer to real fields", () => {
    const a = field("checkbox", "a")
    const b = field("text", "b")
    b.visibleWhen = { op: "eq", field: a.id, value: true }
    expect(messages([a, b])).toEqual([])
  })

  it("flags a rule referring to a field that no longer exists", () => {
    const b = field("text", "b")
    b.visibleWhen = { op: "eq", field: "gone", value: true }
    b.requiredWhen = { op: "eq", field: "gone", value: true }
    expect(messages([b])).toEqual([
      "The visibility condition refers to a field that no longer exists",
      "The required condition refers to a field that no longer exists",
    ])
  })

  it("flags a rule referring to its own field", () => {
    const b = field("text", "b")
    b.requiredWhen = { op: "notEmpty", field: b.id }
    expect(messages([b])).toEqual([
      "The required condition refers to this field itself",
    ])
  })

  it("flags every field in a visibility loop", () => {
    const x = field("checkbox", "x")
    const y = field("checkbox", "y")
    const z = field("checkbox", "z")
    x.visibleWhen = { op: "eq", field: y.id, value: true }
    y.visibleWhen = { op: "eq", field: x.id, value: true }
    expect(messages([x, y, z])).toEqual([
      "Visibility conditions form a loop between fields",
      "Visibility conditions form a loop between fields",
    ])
  })
})

describe("validateForm semantic rule checks", () => {
  it("flags a stored rule whose option no longer exists", () => {
    const radio = field("radio", "contactMethod", {
      options: [{ id: "1", label: "Phone", value: "phone" }],
    })
    const dependent = field("text", "phoneNumber")
    // Written when an 'email' option existed; the option has since been removed.
    dependent.visibleWhen = { op: "eq", field: radio.id, value: "email" }
    expect(messages([radio, dependent])).toEqual([
      "The visibility condition will never match: contactMethod has no option 'email' — its options are 'phone'",
    ])
  })
})
