import { describe, expect, it } from "vitest"
import { builtInFieldTypes } from "../fieldTypes/builtIns"
import { defineFieldType } from "./fieldType"
import { createRegistry } from "./registry"

describe("FieldTypeRegistry", () => {
  it("lists definitions in registration order", () => {
    const registry = createRegistry(builtInFieldTypes)
    expect(registry.all().map((d) => d.type)).toEqual([
      "text",
      "textarea",
      "email",
      "number",
      "date",
      "checkbox",
      "checkboxGroup",
      "radio",
      "select",
    ])
  })

  it("rejects duplicate types", () => {
    const dup = defineFieldType({ type: "text", label: "Dup", defaults: {} })
    expect(() => createRegistry([...builtInFieldTypes, dup])).toThrow(
      /registered twice/,
    )
  })

  it("resolves unknown types to a stable placeholder that flags itself", () => {
    const registry = createRegistry(builtInFieldTypes)
    expect(registry.has("mystery")).toBe(false)
    expect(registry.get("mystery")).toBeUndefined()
    const placeholder = registry.resolve("mystery")
    expect(placeholder.label).toBe("mystery")
    expect(placeholder.validate?.({} as never)).toEqual([
      'Field type "mystery" is not registered',
    ])
    expect(registry.resolve("mystery")).toBe(placeholder)
  })
})
