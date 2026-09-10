import Ajv2020 from "ajv/dist/2020"
import addFormats from "ajv-formats"
import { describe, expect, it } from "vitest"
import { builtInFieldTypes } from "../fieldTypes/builtIns"
import { createField, defineFieldType } from "../model/fieldType"
import { createRegistry } from "../model/registry"
import type { FormDefinition } from "../model/types"
import { field, testRegistry } from "../../test/fields"
import { toJsonSchema } from "./toJsonSchema"

function form(
  fields: FormDefinition["fields"],
  meta: Partial<FormDefinition> = {},
) {
  return { title: "Test form", description: "", fields, ...meta }
}

function generate(
  fields: FormDefinition["fields"],
  meta: Partial<FormDefinition> = {},
) {
  return toJsonSchema(form(fields, meta), testRegistry)
}

function compile(schema: object) {
  const ajv = new Ajv2020({ strict: true, allErrors: true })
  addFormats(ajv)
  return ajv.compile(schema)
}

describe("toJsonSchema", () => {
  it("emits an object schema with title, dialect and closed properties", () => {
    const { schema } = generate([field("text", "name")], {
      description: "Hello",
    })
    expect(schema).toMatchObject({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      title: "Test form",
      description: "Hello",
      type: "object",
      additionalProperties: false,
    })
    expect(schema.required).toBeUndefined()
  })

  it("omits empty title and description", () => {
    const { schema } = generate([], { title: "  ", description: "" })
    expect(schema).not.toHaveProperty("title")
    expect(schema).not.toHaveProperty("description")
  })

  it("lists required fields in order", () => {
    const { schema } = generate([
      field("text", "a", { required: true }),
      field("text", "b"),
      field("email", "c", { required: true }),
    ])
    expect(schema.required).toEqual(["a", "c"])
  })

  it("maps text constraints", () => {
    const { schema } = generate([
      field("text", "code", {
        label: "Code",
        description: "Your code",
        minLength: 2,
        maxLength: 5,
        pattern: "^[A-Z]+$",
      }),
    ])
    expect(schema.properties?.code).toEqual({
      title: "Code",
      description: "Your code",
      type: "string",
      minLength: 2,
      maxLength: 5,
      pattern: "^[A-Z]+$",
    })
  })

  it("drops an invalid regex pattern rather than emitting a broken schema", () => {
    const { schema } = generate([field("text", "t", { pattern: "[" })])
    expect(schema.properties?.t).not.toHaveProperty("pattern")
  })

  it("maps email and date to string formats", () => {
    const { schema } = generate([field("email", "email"), field("date", "dob")])
    expect(schema.properties?.email).toMatchObject({
      type: "string",
      format: "email",
    })
    expect(schema.properties?.dob).toMatchObject({
      type: "string",
      format: "date",
    })
  })

  it("maps number fields, switching to integer when requested", () => {
    const { schema } = generate([
      field("number", "age", { integer: true, min: 0, max: 120 }),
      field("number", "price", { step: 0.5 }),
      field("number", "zeroStep", { step: 0 }),
    ])
    expect(schema.properties?.age).toMatchObject({
      type: "integer",
      minimum: 0,
      maximum: 120,
    })
    expect(schema.properties?.price).toMatchObject({
      type: "number",
      multipleOf: 0.5,
    })
    expect(schema.properties?.zeroStep).not.toHaveProperty("multipleOf")
  })

  it("maps textarea to string with a textarea widget and rows", () => {
    const { schema, uiSchema } = generate([
      field("textarea", "bio", {
        rows: 6,
        maxLength: 500,
        placeholder: "Tell us",
      }),
    ])
    expect(schema.properties?.bio).toMatchObject({
      type: "string",
      maxLength: 500,
    })
    expect(uiSchema.bio).toEqual({
      "ui:widget": "textarea",
      "ui:placeholder": "Tell us",
      "ui:options": { rows: 6 },
    })
  })

  it("maps a single checkbox to boolean with an optional default", () => {
    const { schema, uiSchema } = generate([
      field("checkbox", "agree", { defaultChecked: true }),
      field("checkbox", "news"),
    ])
    expect(schema.properties?.agree).toMatchObject({
      type: "boolean",
      default: true,
    })
    expect(schema.properties?.news).toEqual({
      title: "Checkbox",
      type: "boolean",
    })
    expect(uiSchema.agree).toBeUndefined()
  })

  it("maps radio and select to string oneOf with labels", () => {
    const options = [
      { id: "1", label: "Yes", value: "yes" },
      { id: "2", label: "No", value: "no" },
    ]
    const { schema, uiSchema } = generate([
      field("radio", "choice", { options }),
      field("select", "pick", { options, placeholder: "Choose…" }),
    ])
    const expected = {
      type: "string",
      oneOf: [
        { const: "yes", title: "Yes" },
        { const: "no", title: "No" },
      ],
    }
    expect(schema.properties?.choice).toMatchObject(expected)
    expect(schema.properties?.pick).toMatchObject(expected)
    expect(uiSchema.choice).toEqual({ "ui:widget": "radio" })
    expect(uiSchema.pick).toEqual({ "ui:placeholder": "Choose…" })
  })

  it("maps a checkbox group to a unique array of enum items", () => {
    const options = [
      { id: "1", label: "A", value: "a" },
      { id: "2", label: "B", value: "b" },
    ]
    const { schema, uiSchema } = generate([
      field("checkboxGroup", "tags", { options, maxSelected: 2 }),
    ])
    expect(schema.properties?.tags).toEqual({
      title: "Checkbox group",
      type: "array",
      uniqueItems: true,
      maxItems: 2,
      items: {
        type: "string",
        oneOf: [
          { const: "a", title: "A" },
          { const: "b", title: "B" },
        ],
      },
    })
    expect(uiSchema.tags).toEqual({ "ui:widget": "checkboxes" })
  })

  it("treats a required checkbox group as at least one selection", () => {
    const { schema } = generate([
      field("checkboxGroup", "one", { required: true }),
      field("checkboxGroup", "two", { required: true, minSelected: 2 }),
    ])
    expect(schema.properties?.one?.minItems).toBe(1)
    expect(schema.properties?.two?.minItems).toBe(2)
  })

  it("drops duplicate option values so oneOf stays satisfiable", () => {
    const { schema } = generate([
      field("select", "s", {
        options: [
          { id: "1", label: "A", value: "x" },
          { id: "2", label: "B", value: "x" },
        ],
      }),
    ])
    expect(schema.properties?.s?.oneOf).toHaveLength(1)
  })

  it("omits oneOf entirely when a choice field has no options", () => {
    const { schema } = generate([field("radio", "r", { options: [] })])
    expect(schema.properties?.r).toEqual({
      title: "Radio group",
      type: "string",
    })
  })

  it("keeps ui:order in field order", () => {
    const { uiSchema } = generate([
      field("text", "z"),
      field("text", "a"),
      field("text", "m"),
    ])
    expect(uiSchema["ui:order"]).toEqual(["z", "a", "m"])
  })

  it("skips dataless and unregistered fields", () => {
    const slot = defineFieldType({
      type: "slot",
      label: "Slot",
      dataless: true,
      defaults: {},
    })
    const registry = createRegistry([...builtInFieldTypes, slot])
    const { schema, uiSchema } = toJsonSchema(
      form([
        field("text", "a"),
        createField(slot, ""),
        { ...field("text", "ghost"), type: "vanished" },
      ]),
      registry,
    )
    expect(Object.keys(schema.properties ?? {})).toEqual(["a"])
    expect(uiSchema["ui:order"]).toEqual(["a"])
  })

  it("lets a custom type define its own schema and ui mapping", () => {
    const rating = defineFieldType<{ max: number }>({
      type: "rating",
      label: "Rating",
      defaults: { max: 5 },
      toJsonSchema: ({ props }) => ({
        type: "integer",
        minimum: 1,
        maximum: props.max,
      }),
      toUiSchema: () => ({
        "ui:widget": "radio",
        "ui:options": { stars: true },
      }),
    })
    const registry = createRegistry([rating])
    const stars = {
      ...createField(rating, "stars"),
      label: "Stars",
      required: true,
    }
    const { schema, uiSchema } = toJsonSchema(form([stars]), registry)
    expect(schema.properties?.stars).toEqual({
      title: "Stars",
      type: "integer",
      minimum: 1,
      maximum: 5,
    })
    expect(schema.required).toEqual(["stars"])
    expect(uiSchema.stars).toEqual({
      "ui:widget": "radio",
      "ui:options": { stars: true },
    })
  })

  it("produces a schema that compiles under strict draft 2020-12 and validates data", () => {
    const options = [
      { id: "1", label: "Red", value: "red" },
      { id: "2", label: "Blue", value: "blue" },
    ]
    const { schema } = generate([
      field("text", "name", { required: true, minLength: 1 }),
      field("email", "email", { required: true }),
      field("number", "age", { integer: true, min: 0 }),
      field("textarea", "bio"),
      field("date", "dob"),
      field("checkbox", "agree"),
      field("radio", "colour", { options, required: true }),
      field("select", "fav", { options }),
      field("checkboxGroup", "likes", { options, required: true }),
    ])

    const validate = compile(schema)

    expect(
      validate({
        name: "Ada",
        email: "ada@example.com",
        age: 36,
        bio: "Hi",
        dob: "1815-12-10",
        agree: true,
        colour: "red",
        fav: "blue",
        likes: ["red", "blue"],
      }),
    ).toBe(true)

    expect(
      validate({
        name: "Ada",
        email: "not-an-email",
        colour: "red",
        likes: ["red"],
      }),
    ).toBe(false)
    expect(
      validate({
        name: "Ada",
        email: "a@b.co",
        colour: "green",
        likes: ["red"],
      }),
    ).toBe(false)
    expect(
      validate({ name: "Ada", email: "a@b.co", colour: "red", likes: [] }),
    ).toBe(false)
    expect(
      validate({
        name: "Ada",
        email: "a@b.co",
        colour: "red",
        likes: ["red"],
        age: 1.5,
      }),
    ).toBe(false)
    expect(
      validate({
        name: "Ada",
        email: "a@b.co",
        colour: "red",
        likes: ["red"],
        extra: 1,
      }),
    ).toBe(false)
  })
})

describe("toJsonSchema conditional logic", () => {
  it("folds visibility into a static requirement", () => {
    const contact = field("radio", "contactMethod", {
      options: [
        { id: "1", label: "Phone", value: "phone" },
        { id: "2", label: "None", value: "none" },
      ],
    })
    const phone = field("text", "phoneNumber", { required: true })
    phone.visibleWhen = { op: "eq", field: contact.id, value: "phone" }

    const { schema, uiSchema } = generate([contact, phone])

    // Not unconditionally required: the form itself withholds the field.
    expect(schema.required).toBeUndefined()
    expect(schema.allOf).toEqual([
      {
        if: {
          properties: { contactMethod: { const: "phone" } },
          required: ["contactMethod"],
        },
        then: { properties: { phoneNumber: {} }, required: ["phoneNumber"] },
      },
    ])
    expect(uiSchema.phoneNumber).toMatchObject({
      "ui:visibleWhen": { op: "eq", field: "contactMethod", value: "phone" },
    })

    const validate = compile(schema)
    expect(validate({ contactMethod: "none" })).toBe(true)
    expect(validate({ contactMethod: "phone" })).toBe(false)
    expect(validate({ contactMethod: "phone", phoneNumber: "0400" })).toBe(true)
  })

  it("compiles requiredWhen, combined with visibility when both exist", () => {
    const tick = field("checkbox", "hasAllergies")
    const details = field("textarea", "allergyDetails")
    details.visibleWhen = { op: "eq", field: tick.id, value: true }
    details.requiredWhen = { op: "eq", field: tick.id, value: true }

    const { schema } = generate([tick, details])
    const validate = compile(schema)

    expect(validate({})).toBe(true)
    expect(validate({ hasAllergies: false })).toBe(true)
    expect(validate({ hasAllergies: true })).toBe(false)
    expect(validate({ hasAllergies: true, allergyDetails: "peanuts" })).toBe(
      true,
    )
  })

  it("compiles a requiredWhen on an always-visible field", () => {
    const contact = field("radio", "contactMethod", {
      options: [{ id: "1", label: "None", value: "none" }],
    })
    const comments = field("textarea", "comments")
    comments.requiredWhen = { op: "eq", field: contact.id, value: "none" }

    const { schema } = generate([contact, comments])
    const validate = compile(schema)
    expect(validate({})).toBe(true)
    expect(validate({ contactMethod: "none" })).toBe(false)
    expect(validate({ contactMethod: "none", comments: "bye" })).toBe(true)
  })

  it("compiles under strict Ajv with array membership conditions", () => {
    const services = field("checkboxGroup", "services", {
      options: [{ id: "1", label: "Other", value: "other" }],
    })
    const other = field("text", "otherService")
    other.requiredWhen = { op: "contains", field: services.id, value: "other" }

    const { schema } = generate([services, other])
    const validate = compile(schema)
    expect(validate({ services: ["other"] })).toBe(false)
    expect(validate({ services: ["other"], otherService: "gym" })).toBe(true)
  })
})
