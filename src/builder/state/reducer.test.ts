import { describe, expect, it } from "vitest"
import type { BuilderAction, BuilderState } from "./reducer"
import { builderReducer, initialState } from "./reducer"

function run(actions: BuilderAction[], start: BuilderState = initialState()) {
  return actions.reduce(builderReducer, start)
}

describe("builderReducer", () => {
  it("adds a field at the end with a unique key and selects it", () => {
    const state = run([
      { type: "addField", fieldType: "text" },
      { type: "addField", fieldType: "text" },
    ])
    expect(state.form.fields.map((f) => f.key)).toEqual(["text", "text2"])
    expect(state.selectedId).toBe(state.form.fields[1].id)
  })

  it("adds a field at a given index", () => {
    const state = run([
      { type: "addField", fieldType: "text" },
      { type: "addField", fieldType: "email" },
      { type: "addField", fieldType: "number", index: 1 },
    ])
    expect(state.form.fields.map((f) => f.type)).toEqual([
      "text",
      "number",
      "email",
    ])
  })

  it("removes a field and clears selection if it was selected", () => {
    const withField = run([{ type: "addField", fieldType: "text" }])
    const id = withField.form.fields[0].id
    const state = builderReducer(withField, { type: "removeField", id })
    expect(state.form.fields).toEqual([])
    expect(state.selectedId).toBeNull()
  })

  it("moves fields", () => {
    const state = run([
      { type: "addField", fieldType: "text" },
      { type: "addField", fieldType: "email" },
      { type: "addField", fieldType: "number" },
      { type: "moveField", from: 0, to: 2 },
    ])
    expect(state.form.fields.map((f) => f.type)).toEqual([
      "email",
      "number",
      "text",
    ])
  })

  it("ignores no-op or out-of-range moves", () => {
    const start = run([{ type: "addField", fieldType: "text" }])
    expect(builderReducer(start, { type: "moveField", from: 0, to: 0 })).toBe(
      start,
    )
    expect(builderReducer(start, { type: "moveField", from: 0, to: 9 })).toBe(
      start,
    )
  })

  it("derives the key from the label until the key is edited by hand", () => {
    let state = run([{ type: "addField", fieldType: "text" }])
    const id = state.form.fields[0].id

    state = builderReducer(state, {
      type: "updateField",
      id,
      patch: { label: "First name" },
    })
    expect(state.form.fields[0].key).toBe("firstName")
    expect(state.form.fields[0].autoKey).toBe(true)

    state = builderReducer(state, {
      type: "updateField",
      id,
      patch: { key: "given" },
    })
    expect(state.form.fields[0].autoKey).toBe(false)

    state = builderReducer(state, {
      type: "updateField",
      id,
      patch: { label: "Something else" },
    })
    expect(state.form.fields[0].key).toBe("given")
  })

  it("avoids key collisions when deriving from labels", () => {
    let state = run([
      { type: "addField", fieldType: "text" },
      { type: "addField", fieldType: "email" },
    ])
    const [text, email] = state.form.fields
    state = builderReducer(state, {
      type: "updateField",
      id: text.id,
      patch: { label: "Email" },
    })
    expect(state.form.fields[0].key).toBe("email2")
    expect(state.form.fields[1].id).toBe(email.id)
  })

  it("duplicates a field right after the original with fresh ids", () => {
    let state = run([
      { type: "addField", fieldType: "radio" },
      { type: "addField", fieldType: "text" },
    ])
    const original = state.form.fields[0]
    state = builderReducer(state, { type: "duplicateField", id: original.id })

    expect(state.form.fields).toHaveLength(3)
    const copy = state.form.fields[1]
    expect(copy.type).toBe("radio")
    expect(copy.id).not.toBe(original.id)
    expect(copy.key).toBe("radioGroup2")
    if (copy.type === "radio" && original.type === "radio") {
      expect(copy.options.map((o) => o.id)).not.toEqual(
        original.options.map((o) => o.id),
      )
      expect(copy.options.map((o) => o.value)).toEqual(
        original.options.map((o) => o.value),
      )
    }
    expect(state.selectedId).toBe(copy.id)
  })

  it("replaces options only on choice fields", () => {
    let state = run([
      { type: "addField", fieldType: "select" },
      { type: "addField", fieldType: "text" },
    ])
    const [select, text] = state.form.fields
    const options = [{ id: "o1", label: "Only", value: "only" }]
    state = builderReducer(state, {
      type: "setOptions",
      id: select.id,
      options,
    })
    state = builderReducer(state, { type: "setOptions", id: text.id, options })
    expect(state.form.fields[0]).toMatchObject({ options })
    expect(state.form.fields[1]).not.toHaveProperty("options")
  })

  it("updates form metadata and clears fields", () => {
    let state = run([{ type: "addField", fieldType: "text" }])
    state = builderReducer(state, {
      type: "updateForm",
      patch: { title: "Intake", description: "Desc" },
    })
    expect(state.form).toMatchObject({ title: "Intake", description: "Desc" })
    state = builderReducer(state, { type: "clearForm" })
    expect(state.form.fields).toEqual([])
    expect(state.form.title).toBe("Intake")
    expect(state.selectedId).toBeNull()
  })
})
