import { describe, expect, it } from "vitest"
import { isValidKey, newId, slugifyKey, uniqueKey } from "./keys"

describe("slugifyKey", () => {
  it("camel-cases words", () => {
    expect(slugifyKey("First name")).toBe("firstName")
    expect(slugifyKey("Date of Birth")).toBe("dateOfBirth")
  })

  it("strips punctuation and accents", () => {
    expect(slugifyKey("E-mail (work)")).toBe("eMailWork")
    expect(slugifyKey("Café name")).toBe("cafeName")
  })

  it("prefixes keys that would start with a digit", () => {
    expect(slugifyKey("2nd choice")).toBe("_2ndChoice")
  })

  it("falls back when there is nothing usable", () => {
    expect(slugifyKey("")).toBe("field")
    expect(slugifyKey("!!!")).toBe("field")
  })
})

describe("uniqueKey", () => {
  it("returns the base when free", () => {
    expect(uniqueKey("name", ["other"])).toBe("name")
  })

  it("appends the smallest free numeric suffix", () => {
    expect(uniqueKey("name", ["name"])).toBe("name2")
    expect(uniqueKey("name", ["name", "name2", "name3"])).toBe("name4")
  })
})

describe("isValidKey", () => {
  it("accepts identifiers", () => {
    expect(isValidKey("firstName")).toBe(true)
    expect(isValidKey("_x1")).toBe(true)
  })

  it("rejects non-identifiers", () => {
    expect(isValidKey("1abc")).toBe(false)
    expect(isValidKey("first name")).toBe(false)
    expect(isValidKey("")).toBe(false)
  })
})

describe("newId", () => {
  it("is unique across calls", () => {
    const ids = new Set(Array.from({ length: 200 }, () => newId()))
    expect(ids.size).toBe(200)
  })
})
