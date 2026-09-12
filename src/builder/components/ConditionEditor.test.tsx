import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { parseCondition } from "../conditions/parse"
import type { Condition } from "../conditions/model"
import { builtInFieldTypes } from "../fieldTypes/builtIns"
import { FULL_PERMISSIONS } from "../model/permissions"
import { createRegistry } from "../model/registry"
import type { FormField } from "../model/types"
import { BuilderProvider } from "./BuilderProvider"
import { ConditionEditor } from "./ConditionEditor"
import { field } from "../../test/fields"

const registry = createRegistry(builtInFieldTypes)

const contact = field("radio", "contactMethod", {
  options: [
    { id: "1", label: "Phone", value: "phone" },
    { id: "2", label: "Email", value: "email" },
  ],
})
const size = field("number", "householdSize")
const tick = field("checkbox", "hasAllergies")
const owner = field("text", "phoneNumber")
const fields: FormField[] = [contact, size, tick, owner]

function Harness({
  value,
  onChange,
}: {
  value: Condition | undefined
  onChange: (c: Condition | null) => void
}) {
  return (
    <BuilderProvider registry={registry} permissions={FULL_PERMISSIONS}>
      <ConditionEditor
        label="Visible when"
        help="help text"
        field={owner}
        fields={fields}
        value={value}
        disabled={false}
        onChange={onChange}
      />
    </BuilderProvider>
  )
}

function parse(text: string): Condition {
  const result = parseCondition(text, { fields })
  if (!result.ok || !result.condition) throw new Error("bad test expression")
  return result.condition
}

describe("ConditionEditor rule rows", () => {
  it("builds a first rule from dropdowns alone", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness value={undefined} onChange={onChange} />)

    await user.click(screen.getByRole("button", { name: "Rules" }))
    expect(screen.getByText("Always")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Add a rule" }))
    // The default row is the first eligible field with a fitting value.
    expect(onChange).toHaveBeenLastCalledWith({
      op: "eq",
      field: contact.id,
      value: "phone",
    })
  })

  it("adapts operator and value when the row's field changes", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <Harness
        value={{ op: "eq", field: contact.id, value: "phone" }}
        onChange={onChange}
      />,
    )
    await user.click(screen.getByRole("button", { name: "Rules" }))

    // Options come from the referenced field; switching to a number field
    // swaps the value control and keeps a valid comparison.
    const row = screen.getByTestId("condition-row")
    expect(within(row).getByLabelText("Rule value")).toHaveValue("phone")

    await user.selectOptions(within(row).getByLabelText("Rule field"), size.id)
    expect(onChange).toHaveBeenLastCalledWith({
      op: "eq",
      field: size.id,
      value: 0,
    })
  })

  it("offers only operators that fit the field's shape", async () => {
    const user = userEvent.setup()
    render(
      <Harness
        value={{ op: "eq", field: tick.id, value: true }}
        onChange={vi.fn()}
      />,
    )
    await user.click(screen.getByRole("button", { name: "Rules" }))
    const operators = within(screen.getByTestId("condition-row"))
      .getAllByRole("option")
      .map((o) => o.textContent)
    // Field select options + one boolean operator + true/false values.
    expect(operators).toContain("=")
    expect(operators).not.toContain(">")
    expect(operators).not.toContain("contains")
  })

  it("adds a second rule as an all-group and regroups to any", async () => {
    const user = userEvent.setup()
    let value: Condition | undefined = parse("contactMethod = 'phone'")
    const onChange = vi.fn((next: Condition | null) => {
      value = next ?? undefined
    })
    const view = render(<Harness value={value} onChange={onChange} />)
    await user.click(screen.getByRole("button", { name: "Rules" }))

    await user.click(screen.getByRole("button", { name: "+ Rule" }))
    expect(value).toEqual(
      parse("contactMethod = 'phone' and contactMethod = 'phone'"),
    )

    view.rerender(<Harness value={value} onChange={onChange} />)
    await user.selectOptions(screen.getByLabelText("Match"), "or")
    expect(value).toEqual(
      parse("contactMethod = 'phone' or contactMethod = 'phone'"),
    )
  })

  it("nests a group, producing the parenthesised tree", async () => {
    const user = userEvent.setup()
    let value: Condition | undefined = parse(
      "hasAllergies = true and householdSize >= 3",
    )
    const onChange = vi.fn((next: Condition | null) => {
      value = next ?? undefined
    })
    render(<Harness value={value} onChange={onChange} />)
    await user.click(screen.getByRole("button", { name: "Rules" }))

    await user.click(screen.getByRole("button", { name: "+ Group" }))
    expect(value).toEqual(
      parse(
        "hasAllergies = true and householdSize >= 3 and (contactMethod = 'phone')",
      ),
    )
  })

  it("collapses on removal: two rows to one to none", async () => {
    const user = userEvent.setup()
    let value: Condition | undefined = parse(
      "hasAllergies = true and householdSize >= 3",
    )
    const onChange = vi.fn((next: Condition | null) => {
      value = next ?? undefined
    })
    const view = render(<Harness value={value} onChange={onChange} />)
    await user.click(screen.getByRole("button", { name: "Rules" }))

    await user.click(screen.getAllByRole("button", { name: "Remove rule" })[0])
    expect(value).toEqual(parse("householdSize >= 3"))

    view.rerender(<Harness value={value} onChange={onChange} />)
    await user.click(screen.getByRole("button", { name: "Remove rule" }))
    expect(value).toBeUndefined()
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it("round-trips with the expression view over the same tree", async () => {
    const user = userEvent.setup()
    let value: Condition | undefined = parse(
      "contactMethod = 'email' or householdSize > 2",
    )
    const onChange = vi.fn((next: Condition | null) => {
      value = next ?? undefined
    })
    render(<Harness value={value} onChange={onChange} />)

    // Expression view first (the default), then the same rule as rows.
    expect(screen.getByLabelText("Visible when")).toHaveValue(
      "contactMethod = 'email' or householdSize > 2",
    )
    await user.click(screen.getByRole("button", { name: "Rules" }))
    expect(screen.getAllByTestId("condition-row")).toHaveLength(2)
    expect(screen.getByLabelText("Match")).toHaveValue("or")
  })

  it("keeps a not-rule with the expression view", async () => {
    render(
      <Harness
        value={{ op: "not", condition: parse("hasAllergies = true") }}
        onChange={vi.fn()}
      />,
    )
    const rules = screen.getByRole("button", { name: "Rules" })
    expect(rules).toBeDisabled()
    expect(rules).toHaveAttribute(
      "title",
      expect.stringContaining('uses "not"'),
    )
    expect(screen.getByLabelText("Visible when")).toHaveValue(
      "not hasAllergies = true",
    )
  })
})
