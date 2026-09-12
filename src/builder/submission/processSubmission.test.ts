import { describe, expect, it } from "vitest"
import { field } from "../../test/fields"
import { builtInFieldTypes } from "../fieldTypes/builtIns"
import { coreFieldTypes } from "../fieldTypes/core"
import { createSampleForm } from "../model/sample"
import type { FormDefinition } from "../model/types"
import { createConditionsForm } from "../../examples/conditionsForm"
import { createSubmissionProcessor } from "./processSubmission"

/**
 * The server simulation: everything here uses `coreFieldTypes`, the registry a
 * backend would hold, against definitions authored in the browser.
 */

function conditionalForm(): FormDefinition {
  const contact = field("radio", "contactMethod", {
    label: "Contact method",
    required: true,
    options: [
      { id: "1", label: "Phone", value: "phone" },
      { id: "2", label: "None", value: "none" },
    ],
  })
  const phone = field("email", "phoneEmail", {
    label: "Confirmation email",
    required: true,
  })
  phone.visibleWhen = { op: "eq", field: contact.id, value: "phone" }
  return { title: "t", description: "", fields: [contact, phone] }
}

describe("createSubmissionProcessor", () => {
  const processor = createSubmissionProcessor(conditionalForm(), coreFieldTypes)

  it("accepts a valid submission and returns it pruned", () => {
    const result = processor.process({
      contactMethod: "phone",
      phoneEmail: "ada@example.com",
      extraBlank: "",
    })
    expect(result.errors).toEqual({})
    expect(result.data).toEqual({
      contactMethod: "phone",
      phoneEmail: "ada@example.com",
    })
  })

  it("enforces a conditional requirement without any browser involved", () => {
    const result = processor.process({ contactMethod: "phone" })
    expect(result.errors).toEqual({ phoneEmail: "This field is required" })
  })

  it("drops an answer to a hidden field, matching the renderer", () => {
    const result = processor.process({
      contactMethod: "none",
      phoneEmail: "sneaked@in.example",
    })
    expect(result.errors).toEqual({})
    expect(result.data).toEqual({ contactMethod: "none" })
  })

  it("accepts a hidden but malformed answer by dropping it — the trap a schema-only check falls into", () => {
    const result = processor.process({
      contactMethod: "none",
      phoneEmail: "not-an-email",
    })
    // Schema-only validation would reject this submission even though the
    // form never asked the question; the pipeline agrees with the browser.
    expect(result.errors).toEqual({})
    expect(result.data).toEqual({ contactMethod: "none" })
  })

  it("drops a key the form never declared, so nothing undeclared is stored", () => {
    const result = processor.process({
      contactMethod: "none",
      ssn: "123-45-6789",
    })
    expect(result.errors).toEqual({})
    expect(result.data).toEqual({ contactMethod: "none" })
  })

  it("can reject unasked answers instead, for APIs preferring loud failure", () => {
    const result = processor.process(
      {
        contactMethod: "none",
        phoneEmail: "sneaked@in.example",
        ssn: "123-45-6789",
        blankIsFine: "",
      },
      { rejectUnasked: true },
    )
    expect(result.errors).toEqual({
      phoneEmail: "This answers a question the form did not ask",
      ssn: "This answers a question the form did not ask",
    })
    expect(result.data).toEqual({ contactMethod: "none" })
  })

  it("exposes the generated schema for hosts that persist it", () => {
    expect(processor.schema).toMatchObject({ type: "object" })
    expect(processor.uiSchema["ui:order"]).toEqual([
      "contactMethod",
      "phoneEmail",
    ])
  })
})

describe("core and browser registries agree", () => {
  it.each([
    ["sample form", createSampleForm()],
    ["conditions form", createConditionsForm()],
  ])("emit identical schemas for the %s", (_name, form) => {
    const server = createSubmissionProcessor(form, coreFieldTypes)
    const browser = createSubmissionProcessor(form, builtInFieldTypes)
    expect(server.schema).toEqual(browser.schema)
    expect(server.uiSchema).toEqual(browser.uiSchema)
  })

  it("process a submission identically", () => {
    const form = createConditionsForm()
    const raw = {
      contactMethod: "none",
      phoneNumber: "0400 000 000",
      hasAllergies: true,
      allergyDetails: "",
      services: ["other"],
      finalComments: "all good",
    }
    const server = createSubmissionProcessor(form, coreFieldTypes).process(raw)
    const browser = createSubmissionProcessor(form, builtInFieldTypes).process(
      raw,
    )
    expect(server.data).toEqual(browser.data)
    expect(server.errors).toEqual(browser.errors)
    expect([...server.visible].sort()).toEqual([...browser.visible].sort())
  })
})
