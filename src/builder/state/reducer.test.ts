import { describe, expect, it } from "vitest"
import { builtInFieldTypes } from "../fieldTypes/builtIns"
import { createField, defineFieldType } from "../model/fieldType"
import { createRegistry } from "../model/registry"
import type { FieldOption } from "../model/types"
import { field, testRegistry } from "../../test/fields"
import {
  canAddField,
  createBuilderReducer,
  initialState,
  type BuilderAction,
  type BuilderState,
} from "./reducer"

const reducer = createBuilderReducer(testRegistry)

function run(actions: BuilderAction[], start: BuilderState = initialState()) {
  return actions.reduce(reducer, start)
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

  it("ignores unknown field types", () => {
    const start = initialState()
    expect(reducer(start, { type: "addField", fieldType: "nope" })).toBe(start)
  })

  it("removes a field and clears selection if it was selected", () => {
    const withField = run([{ type: "addField", fieldType: "text" }])
    const id = withField.form.fields[0].id
    const state = reducer(withField, { type: "removeField", id })
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
    expect(reducer(start, { type: "moveField", from: 0, to: 0 })).toBe(start)
    expect(reducer(start, { type: "moveField", from: 0, to: 9 })).toBe(start)
  })

  it("derives the key from the label until the key is edited by hand", () => {
    let state = run([{ type: "addField", fieldType: "text" }])
    const id = state.form.fields[0].id

    state = reducer(state, {
      type: "updateField",
      id,
      patch: { label: "First name" },
    })
    expect(state.form.fields[0].key).toBe("firstName")
    expect(state.form.fields[0].autoKey).toBe(true)

    state = reducer(state, { type: "updateField", id, patch: { key: "given" } })
    expect(state.form.fields[0].autoKey).toBe(false)

    state = reducer(state, {
      type: "updateField",
      id,
      patch: { label: "Something else" },
    })
    expect(state.form.fields[0].key).toBe("given")

    state = reducer(state, {
      type: "updateField",
      id,
      patch: { key: "somethingElse", autoKey: true },
    })
    expect(state.form.fields[0].autoKey).toBe(true)
  })

  it("avoids key collisions when deriving from labels", () => {
    let state = run([
      { type: "addField", fieldType: "text" },
      { type: "addField", fieldType: "email" },
    ])
    const [text, email] = state.form.fields
    state = reducer(state, {
      type: "updateField",
      id: text.id,
      patch: { label: "Email" },
    })
    expect(state.form.fields[0].key).toBe("email2")
    expect(state.form.fields[1].id).toBe(email.id)
  })

  it("merges props and removes props set to undefined", () => {
    let state = run([{ type: "addField", fieldType: "text" }])
    const id = state.form.fields[0].id
    state = reducer(state, {
      type: "updateField",
      id,
      patch: { props: { minLength: 2, maxLength: 9 } },
    })
    expect(state.form.fields[0].props).toEqual({
      placeholder: "",
      minLength: 2,
      maxLength: 9,
    })
    state = reducer(state, {
      type: "updateField",
      id,
      patch: { props: { minLength: undefined } },
    })
    expect(state.form.fields[0].props).toEqual({
      placeholder: "",
      maxLength: 9,
    })
  })

  it("clears the description when set to an empty string", () => {
    let state = run([{ type: "addField", fieldType: "text" }])
    const id = state.form.fields[0].id
    state = reducer(state, {
      type: "updateField",
      id,
      patch: { description: "Hi" },
    })
    expect(state.form.fields[0].description).toBe("Hi")
    state = reducer(state, {
      type: "updateField",
      id,
      patch: { description: "" },
    })
    expect(state.form.fields[0]).not.toHaveProperty("description", "Hi")
    expect(state.form.fields[0].description).toBeUndefined()
  })

  it("duplicates a field right after the original with fresh ids and no locks", () => {
    let state = run([
      { type: "addField", fieldType: "radio" },
      { type: "addField", fieldType: "text" },
    ])
    const original = { ...state.form.fields[0], locks: { remove: true } }
    state = {
      ...state,
      form: { ...state.form, fields: [original, state.form.fields[1]] },
    }
    state = reducer(state, { type: "duplicateField", id: original.id })

    expect(state.form.fields).toHaveLength(3)
    const copy = state.form.fields[1]
    expect(copy.type).toBe("radio")
    expect(copy.id).not.toBe(original.id)
    expect(copy.key).toBe("radioGroup2")
    expect(copy.locks).toBeUndefined()
    const copyOptions = copy.props.options as FieldOption[]
    const originalOptions = original.props.options as FieldOption[]
    expect(copyOptions.map((o) => o.id)).not.toEqual(
      originalOptions.map((o) => o.id),
    )
    expect(copyOptions.map((o) => o.value)).toEqual(
      originalOptions.map((o) => o.value),
    )
    expect(state.selectedId).toBe(copy.id)
  })

  it("updates form metadata and clears fields", () => {
    let state = run([{ type: "addField", fieldType: "text" }])
    state = reducer(state, {
      type: "updateForm",
      patch: { title: "Intake", description: "Desc" },
    })
    expect(state.form).toMatchObject({ title: "Intake", description: "Desc" })
    state = reducer(state, { type: "clearForm" })
    expect(state.form.fields).toEqual([])
    expect(state.form.title).toBe("Intake")
    expect(state.selectedId).toBeNull()
  })

  describe("locks", () => {
    const locked = field("text", "dexId", {
      label: "How satisfied were you?",
      locks: { remove: true, key: true, props: true, required: true },
    })
    const start: BuilderState = {
      form: {
        title: "t",
        description: "",
        fields: [locked, field("text", "free")],
      },
      selectedId: locked.id,
    }

    it("refuses to remove a locked field, including via clear", () => {
      expect(reducer(start, { type: "removeField", id: locked.id })).toBe(start)
      const cleared = reducer(start, { type: "clearForm" })
      expect(cleared.form.fields.map((f) => f.key)).toEqual(["dexId"])
    })

    it("keeps the key, props and required flag but allows rewording", () => {
      const state = reducer(start, {
        type: "updateField",
        id: locked.id,
        patch: {
          label: "New wording",
          key: "other",
          required: true,
          props: { minLength: 3 },
        },
      })
      const updated = state.form.fields[0]
      expect(updated.label).toBe("New wording")
      expect(updated.key).toBe("dexId")
      expect(updated.required).toBe(false)
      expect(updated.props).toEqual(locked.props)
    })
  })

  describe("dataless and limited types", () => {
    const slot = defineFieldType<{ scale: string }>({
      type: "slot",
      label: "Slot",
      dataless: true,
      maxInstances: 1,
      defaults: { scale: "rating" },
    })
    const registry = createRegistry([...builtInFieldTypes, slot])
    const limited = createBuilderReducer(registry)

    it("adds a dataless field with no key and ignores required", () => {
      let state = limited(initialState(), {
        type: "addField",
        fieldType: "slot",
      })
      const added = state.form.fields[0]
      expect(added).toMatchObject({
        type: "slot",
        key: "",
        autoKey: false,
        props: { scale: "rating" },
      })
      state = limited(state, {
        type: "updateField",
        id: added.id,
        patch: { required: true, key: "x", label: "Renamed" },
      })
      expect(state.form.fields[0]).toMatchObject({
        key: "",
        required: false,
        label: "Renamed",
      })
    })

    it("refuses to add or duplicate beyond maxInstances", () => {
      const one = limited(initialState(), {
        type: "addField",
        fieldType: "slot",
      })
      expect(canAddField(registry, one.form, "slot")).toBe(false)
      expect(limited(one, { type: "addField", fieldType: "slot" })).toBe(one)
      expect(
        limited(one, { type: "duplicateField", id: one.form.fields[0].id }),
      ).toBe(one)
      expect(canAddField(registry, one.form, "text")).toBe(true)
    })

    it("preserves a saved field of an unregistered type", () => {
      const ghost = { ...createField(slot, ""), type: "vanished" }
      const state = limited(
        {
          form: { title: "", description: "", fields: [ghost] },
          selectedId: null,
        },
        { type: "updateField", id: ghost.id, patch: { label: "Still here" } },
      )
      expect(state.form.fields[0]).toMatchObject({
        type: "vanished",
        label: "Still here",
      })
    })
  })
})
