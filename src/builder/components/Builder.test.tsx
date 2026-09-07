import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { Builder } from "./Builder"

function schemaJson() {
  return JSON.parse(screen.getByTestId("schema-json").textContent ?? "{}")
}

describe("Builder", () => {
  it("starts empty with a schema and no fields", () => {
    render(<Builder persist={false} />)
    expect(screen.getByText("Your form is empty")).toBeInTheDocument()
    expect(schemaJson()).toMatchObject({ type: "object", properties: {} })
  })

  it("adds a field from the palette and shows its properties", async () => {
    const user = userEvent.setup()
    render(<Builder persist={false} />)

    await user.click(screen.getByRole("button", { name: "Add Text field" }))

    expect(screen.getByTestId("canvas-field-text")).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Field" })).toHaveAttribute(
      "aria-selected",
      "true",
    )
    expect(screen.getByLabelText("Label")).toHaveValue("Text")
    expect(screen.getByLabelText("Key")).toHaveValue("text")
  })

  it("derives the key from the label and reflects edits in the schema", async () => {
    const user = userEvent.setup()
    render(<Builder persist={false} />)

    await user.click(screen.getByRole("button", { name: "Add Email field" }))
    const label = screen.getByLabelText("Label")
    await user.clear(label)
    await user.type(label, "Work email")
    await user.click(screen.getByLabelText("Required"))

    expect(screen.getByLabelText("Key")).toHaveValue("workEmail")

    await user.click(screen.getByRole("tab", { name: "Schema" }))
    expect(schemaJson()).toMatchObject({
      properties: {
        workEmail: { type: "string", format: "email", title: "Work email" },
      },
      required: ["workEmail"],
    })
  })

  it("keeps a hand-edited key when the label changes", async () => {
    const user = userEvent.setup()
    render(<Builder persist={false} />)

    await user.click(screen.getByRole("button", { name: "Add Number field" }))
    const key = screen.getByLabelText("Key")
    await user.clear(key)
    await user.type(key, "qty")
    const label = screen.getByLabelText("Label")
    await user.clear(label)
    await user.type(label, "Quantity")

    expect(screen.getByLabelText("Key")).toHaveValue("qty")
    expect(
      screen.getByRole("button", { name: "Derive from label" }),
    ).toBeInTheDocument()
  })

  it("reorders, duplicates and deletes fields from the canvas", async () => {
    const user = userEvent.setup()
    render(<Builder persist={false} />)

    await user.click(screen.getByRole("button", { name: "Add Text field" }))
    await user.click(screen.getByRole("button", { name: "Add Date field" }))

    await user.click(screen.getByRole("tab", { name: "Schema" }))
    expect(schemaJson()["properties"]).toEqual({
      text: expect.anything(),
      date: expect.anything(),
    })
    let order = Object.keys(schemaJson()["properties"])
    expect(order).toEqual(["text", "date"])

    await user.click(screen.getByRole("button", { name: "Move Date up" }))
    order = Object.keys(schemaJson()["properties"])
    expect(order).toEqual(["date", "text"])

    await user.click(screen.getByRole("button", { name: "Duplicate Date" }))
    expect(screen.getByTestId("canvas-field-date2")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Delete Text" }))
    expect(screen.queryByTestId("canvas-field-text")).not.toBeInTheDocument()
  })

  it("edits options on a choice field", async () => {
    const user = userEvent.setup()
    render(<Builder persist={false} />)

    await user.click(
      screen.getByRole("button", { name: "Add Radio group field" }),
    )
    const firstLabel = screen.getByLabelText("Option 1 label")
    await user.clear(firstLabel)
    await user.type(firstLabel, "Yes please")
    expect(screen.getByLabelText("Option 1 value")).toHaveValue("yesPlease")

    await user.click(screen.getByRole("button", { name: "Remove option 3" }))
    await user.click(screen.getByRole("button", { name: "Add option" }))
    expect(screen.getByLabelText("Option 3 value")).toHaveValue("option3")

    await user.click(screen.getByRole("tab", { name: "Schema" }))
    expect(schemaJson()["properties"]["radioGroup"]["oneOf"]).toEqual([
      { const: "yesPlease", title: "Yes please" },
      { const: "option2", title: "Option 2" },
      { const: "option3", title: "Option 3" },
    ])
  })

  it("surfaces validation issues and links them to the field", async () => {
    const user = userEvent.setup()
    render(<Builder persist={false} />)

    await user.click(screen.getByRole("button", { name: "Add Text field" }))
    await user.click(screen.getByRole("button", { name: "Add Text field" }))
    const key = screen.getByLabelText("Key")
    await user.clear(key)
    await user.type(key, "text")

    // The Schema tab carries an issue-count badge, so its name is "Schema 2 issues".
    await user.click(screen.getByRole("tab", { name: /^Schema/ }))
    const status = screen.getByTestId("schema-issues")
    expect(
      within(status).getAllByText(/used by more than one field/),
    ).toHaveLength(2)

    await user.click(within(status).getAllByRole("button", { name: "Text" })[0])
    expect(screen.getByRole("tab", { name: "Field" })).toHaveAttribute(
      "aria-selected",
      "true",
    )
  })

  it("loads the sample form", async () => {
    const user = userEvent.setup()
    render(<Builder persist={false} />)

    await user.click(screen.getByRole("button", { name: "load a sample form" }))
    expect(screen.getByLabelText("Form title")).toHaveValue("Client intake")
    expect(screen.getByTestId("canvas-field-fullName")).toBeInTheDocument()
    expect(schemaJson()["required"]).toContain("fullName")
  })
})
