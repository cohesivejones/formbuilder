import Ajv2020 from "ajv/dist/2020"
import { describe, expect, it } from "vitest"
import type { Condition } from "./model"
import { referencedFields } from "./model"
import { parseCondition, type ParseContext } from "./parse"
import { conditionWithKeys, printCondition } from "./print"
import { evaluateCondition, resolveVisibility, visibleValues } from "./evaluate"
import { conditionToSchema } from "./toSchema"
import { checkCondition } from "./check"
import { field, testRegistry } from "../../test/fields"

const fields = [
  { id: "f1", key: "hasAllergies" },
  { id: "f2", key: "contactMethod" },
  { id: "f3", key: "householdSize" },
  { id: "f4", key: "services" },
  { id: "f5", key: "notes" },
]
const context: ParseContext = { fields }

function parse(text: string): Condition {
  const result = parseCondition(text, context)
  if (!result.ok || !result.condition)
    throw new Error(!result.ok ? result.error : "blank")
  return result.condition
}

function error(text: string): string {
  const result = parseCondition(text, context)
  if (result.ok) throw new Error("expected a parse error")
  return result.error
}

describe("parseCondition", () => {
  it("parses each comparison", () => {
    expect(parse("hasAllergies = true")).toEqual({
      op: "eq",
      field: "f1",
      value: true,
    })
    expect(parse("contactMethod != 'phone'")).toEqual({
      op: "ne",
      field: "f2",
      value: "phone",
    })
    expect(parse("householdSize >= 3")).toEqual({
      op: "gte",
      field: "f3",
      value: 3,
    })
    expect(parse("householdSize < -1.5")).toEqual({
      op: "lt",
      field: "f3",
      value: -1.5,
    })
    expect(parse("services contains 'other'")).toEqual({
      op: "contains",
      field: "f4",
      value: "other",
    })
    expect(parse("notes is empty")).toEqual({ op: "empty", field: "f5" })
    expect(parse("notes is not empty")).toEqual({ op: "notEmpty", field: "f5" })
  })

  it("gives and tighter binding than or, and honours parentheses and not", () => {
    expect(
      parse("hasAllergies = true or notes is empty and householdSize > 2"),
    ).toEqual({
      op: "or",
      conditions: [
        { op: "eq", field: "f1", value: true },
        {
          op: "and",
          conditions: [
            { op: "empty", field: "f5" },
            { op: "gt", field: "f3", value: 2 },
          ],
        },
      ],
    })
    expect(parse("not (hasAllergies = true or notes is empty)")).toEqual({
      op: "not",
      condition: {
        op: "or",
        conditions: [
          { op: "eq", field: "f1", value: true },
          { op: "empty", field: "f5" },
        ],
      },
    })
  })

  it("accepts either quote style and keywords in any case", () => {
    expect(parse('contactMethod = "phone"')).toEqual({
      op: "eq",
      field: "f2",
      value: "phone",
    })
    expect(parse("notes IS EMPTY AND hasAllergies = TRUE")).toEqual({
      op: "and",
      conditions: [
        { op: "empty", field: "f5" },
        { op: "eq", field: "f1", value: true },
      ],
    })
  })

  it("treats blank input as no rule", () => {
    expect(parseCondition("   ", context)).toEqual({
      ok: true,
      condition: null,
    })
  })

  it("explains what went wrong in the author's terms", () => {
    expect(error("houshold >= 3")).toBe(
      'Unknown field "houshold" — did you mean householdSize?',
    )
    expect(error("contactMethod = phone")).toBe(
      "Values need quotes: did you mean 'phone'?",
    )
    expect(error("householdSize >= 'three'")).toBe(
      ">= compares numbers; 'three' is not one",
    )
    expect(error("hasAllergies")).toBe(
      '"hasAllergies" needs a comparison, such as = or contains',
    )
    expect(error("(notes is empty")).toBe("Missing a closing )")
    expect(error("notes is full")).toBe(
      'After "is", expected "empty" or "not empty"',
    )
    expect(error("contactMethod = 'phone")).toMatch(/missing its closing quote/)
    expect(error("notes is empty banana = 1")).toMatch(/Unexpected "banana"/)
  })

  it("refuses a rule about the field it belongs to", () => {
    const result = parseCondition("notes is empty", { fields, selfId: "f5" })
    expect(result).toEqual({
      ok: false,
      error: "A condition cannot refer to the field it belongs to",
    })
  })
})

describe("printCondition", () => {
  it("round-trips through the parser", () => {
    const texts = [
      "hasAllergies = true",
      "contactMethod != 'phone'",
      "householdSize >= 3 and services contains 'other'",
      "(hasAllergies = true or notes is empty) and householdSize < 5",
      "not notes is not empty",
    ]
    for (const text of texts) {
      const printed = printCondition(parse(text), fields)
      expect(parse(printed)).toEqual(parse(text))
      expect(printed).toBe(text)
    }
  })

  it("shows current keys and falls back to the id for a missing field", () => {
    const condition = parse("contactMethod = 'phone'")
    expect(printCondition(condition, [{ id: "f2", key: "channel" }])).toBe(
      "channel = 'phone'",
    )
    expect(printCondition(condition, [])).toBe("f2 = 'phone'")
  })

  it("can print with labels for paper", () => {
    const condition = parse("contactMethod = 'phone'")
    expect(
      printCondition(
        condition,
        [{ id: "f2", key: "contactMethod", label: "Preferred contact" }],
        {
          names: "label",
        },
      ),
    ).toBe("Preferred contact = 'phone'")
  })
})

describe("referencedFields / conditionWithKeys", () => {
  it("collects every reference and swaps ids for keys", () => {
    const condition = parse(
      "hasAllergies = true and (notes is empty or householdSize > 2)",
    )
    expect(referencedFields(condition).sort()).toEqual(["f1", "f3", "f5"])
    expect(conditionWithKeys(condition, fields)).toEqual(
      parseCondition(
        "hasAllergies = true and (notes is empty or householdSize > 2)",
        {
          fields: fields.map((f) => ({ ...f, id: f.key })),
        } as ParseContext & { fields: typeof fields },
      ).ok
        ? {
            op: "and",
            conditions: [
              { op: "eq", field: "hasAllergies", value: true },
              {
                op: "or",
                conditions: [
                  { op: "empty", field: "notes" },
                  { op: "gt", field: "householdSize", value: 2 },
                ],
              },
            ],
          }
        : undefined,
    )
  })
})

describe("evaluateCondition", () => {
  const keyById = new Map(fields.map((f) => [f.id, f.key]))
  const evaluate = (text: string, data: Record<string, unknown>) =>
    evaluateCondition(parse(text), data, keyById)

  it("evaluates each operator, treating the unanswered as absent", () => {
    expect(evaluate("hasAllergies = true", { hasAllergies: true })).toBe(true)
    expect(evaluate("hasAllergies = true", {})).toBe(false)
    expect(evaluate("contactMethod != 'phone'", {})).toBe(true)
    expect(evaluate("householdSize >= 3", { householdSize: 3 })).toBe(true)
    expect(evaluate("householdSize >= 3", { householdSize: "3" })).toBe(false)
    expect(
      evaluate("services contains 'other'", { services: ["a", "other"] }),
    ).toBe(true)
    expect(evaluate("services contains 'other'", { services: [] })).toBe(false)
    expect(evaluate("notes contains 'call'", { notes: "please call me" })).toBe(
      true,
    )
    expect(evaluate("notes is empty", { notes: "" })).toBe(true)
    expect(evaluate("notes is not empty", { notes: "hi" })).toBe(true)
    expect(evaluate("notes is empty", { services: [] })).toBe(true)
  })

  it("never throws on a broken reference", () => {
    const orphan: Condition = { op: "eq", field: "gone", value: 1 }
    expect(evaluateCondition(orphan, { anything: 1 }, keyById)).toBe(false)
  })
})

describe("resolveVisibility", () => {
  it("cascades: hiding a controller hides everything downstream", () => {
    const a = field("checkbox", "a")
    const b = field("checkbox", "b")
    const c = field("text", "c")
    b.visibleWhen = { op: "eq", field: a.id, value: true }
    c.visibleWhen = { op: "eq", field: b.id, value: true }
    const all = [a, b, c]

    expect(resolveVisibility(all, { a: true, b: true })).toEqual(
      new Set([a.id, b.id, c.id]),
    )
    // b's answer is still true underneath, but with a unticked, b is hidden and
    // its answer must no longer show c.
    expect(resolveVisibility(all, { a: false, b: true })).toEqual(
      new Set([a.id]),
    )
  })

  it("terminates on a rule cycle", () => {
    const x = field("checkbox", "x")
    const y = field("checkbox", "y")
    x.visibleWhen = { op: "eq", field: y.id, value: true }
    y.visibleWhen = { op: "eq", field: x.id, value: true }
    const visible = resolveVisibility([x, y], { x: true, y: true })
    expect(visible).toBeInstanceOf(Set)
  })

  it("restricts answers to visible fields", () => {
    const a = field("checkbox", "a")
    const b = field("text", "b")
    b.visibleWhen = { op: "eq", field: a.id, value: true }
    const values = { a: false, b: "kept underneath" }
    const visible = resolveVisibility([a, b], values)
    expect(visibleValues([a, b], values, visible)).toEqual({ a: false })
  })
})

describe("conditionToSchema", () => {
  const context = {
    keyOf: (id: string) => fields.find((f) => f.id === id)?.key,
    isArrayField: (id: string) => id === "f4",
  }

  function matches(text: string, data: Record<string, unknown>): boolean {
    const ajv = new Ajv2020({ strict: true })
    const schema = conditionToSchema(parse(text), context)
    return ajv.compile({ type: "object", ...schema } as object)(data)
  }

  it("agrees with the evaluator across operators", () => {
    const keyById = new Map(fields.map((f) => [f.id, f.key]))
    const cases: Array<[string, Record<string, unknown>]> = [
      ["hasAllergies = true", { hasAllergies: true }],
      ["hasAllergies = true", {}],
      ["contactMethod != 'phone'", {}],
      ["contactMethod != 'phone'", { contactMethod: "phone" }],
      ["householdSize > 2", { householdSize: 3 }],
      ["householdSize > 2", { householdSize: 2 }],
      ["householdSize <= 2", { householdSize: 2 }],
      ["services contains 'other'", { services: ["other"] }],
      ["services contains 'other'", { services: ["a"] }],
      ["notes contains 'call'", { notes: "please call" }],
      ["notes is empty", {}],
      ["notes is not empty", { notes: "hi" }],
      [
        "hasAllergies = true and householdSize > 2",
        { hasAllergies: true, householdSize: 3 },
      ],
      ["hasAllergies = true or householdSize > 2", { householdSize: 3 }],
      ["not hasAllergies = true", {}],
    ]
    for (const [text, data] of cases) {
      expect(matches(text, data), `${text} on ${JSON.stringify(data)}`).toBe(
        evaluateCondition(parse(text), data, keyById),
      )
    }
  })

  it("escapes regex characters in string contains", () => {
    expect(matches("notes contains 'a.b'", { notes: "a.b" })).toBe(true)
    expect(matches("notes contains 'a.b'", { notes: "axb" })).toBe(false)
  })

  it("never matches when the referenced field is gone", () => {
    const orphan: Condition = { op: "eq", field: "gone", value: true }
    const ajv = new Ajv2020({ strict: true })
    const validate = ajv.compile({
      type: "object",
      ...conditionToSchema(orphan, context),
    } as object)
    expect(validate({ gone: true })).toBe(false)
  })
})

describe("checkCondition", () => {
  const radio = field("radio", "contactMethod", {
    options: [
      { id: "1", label: "Phone", value: "phone" },
      { id: "2", label: "Email", value: "email" },
      { id: "3", label: "None", value: "none" },
    ],
  })
  const services = field("checkboxGroup", "services", {
    options: [
      { id: "1", label: "Counselling", value: "counselling" },
      { id: "2", label: "Other", value: "other" },
    ],
  })
  const size = field("number", "householdSize")
  const dob = field("date", "dateOfBirth")
  const tick = field("checkbox", "hasAllergies")
  const name = field("text", "fullName")
  const all = [radio, services, size, dob, tick, name]

  function issues(condition: Parameters<typeof checkCondition>[0]) {
    return checkCondition(condition, all, testRegistry)
  }

  it("accepts rules that fit the fields", () => {
    expect(issues({ op: "eq", field: radio.id, value: "phone" })).toEqual([])
    expect(
      issues({ op: "contains", field: services.id, value: "other" }),
    ).toEqual([])
    expect(issues({ op: "gte", field: size.id, value: 3 })).toEqual([])
    expect(issues({ op: "eq", field: tick.id, value: true })).toEqual([])
    expect(issues({ op: "contains", field: name.id, value: "call" })).toEqual(
      [],
    )
    expect(issues({ op: "empty", field: dob.id })).toEqual([])
  })

  it("catches an option value that does not exist", () => {
    expect(issues({ op: "eq", field: radio.id, value: "phome" })).toEqual([
      "contactMethod has no option 'phome' — its options are 'phone', 'email', 'none'",
    ])
    expect(
      issues({ op: "contains", field: services.id, value: "gym" }),
    ).toEqual([
      "services has no option 'gym' — its options are 'counselling', 'other'",
    ])
  })

  it("catches comparisons against the wrong shape of value", () => {
    expect(issues({ op: "eq", field: tick.id, value: "yes" })).toEqual([
      "hasAllergies holds true or false, so it will never equal 'yes'",
    ])
    expect(issues({ op: "eq", field: size.id, value: "3" })).toEqual([
      "householdSize holds a number, so it will never equal '3'",
    ])
    expect(issues({ op: "eq", field: name.id, value: 3 })).toEqual([
      "fullName holds text, so it will never equal 3",
    ])
  })

  it("catches equality against a list and ordering against non-numbers", () => {
    expect(issues({ op: "eq", field: services.id, value: "other" })).toEqual([
      `services holds a list — use "services contains 'other'" instead`,
    ])
    expect(issues({ op: "gte", field: dob.id, value: 3 })).toEqual([
      ">= compares numbers, but dateOfBirth holds a date",
    ])
    expect(issues({ op: "contains", field: size.id, value: "3" })).toEqual([
      "contains needs a list or text, but householdSize holds a number",
    ])
  })

  it("collects issues through and/or/not and skips broken references", () => {
    expect(
      issues({
        op: "and",
        conditions: [
          {
            op: "not",
            condition: { op: "eq", field: radio.id, value: "phome" },
          },
          { op: "eq", field: "gone", value: 1 },
          { op: "gt", field: dob.id, value: 1 },
        ],
      }),
    ).toEqual([
      "contactMethod has no option 'phome' — its options are 'phone', 'email', 'none'",
      "> compares numbers, but dateOfBirth holds a date",
    ])
  })
})
