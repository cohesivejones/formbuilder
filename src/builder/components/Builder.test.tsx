import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { programQuestionSlot } from "../../examples/programQuestionSlot"
import { field } from "../../test/fields"
import { builtInFieldTypes } from "../fieldTypes/builtIns"
import { createSampleForm } from "../model/sample"
import type { FormDefinition } from "../model/types"
import { Builder } from "./Builder"

function schemaJson() {
  return JSON.parse(screen.getByTestId("schema-json").textContent ?? "{}")
}

const withSlot = [...builtInFieldTypes, programQuestionSlot]

describe("Builder", () => {
  it("starts empty with a schema and no fields", () => {
    render(<Builder />)
    expect(screen.getByText("Your form is empty")).toBeInTheDocument()
    expect(schemaJson()).toMatchObject({ type: "object", properties: {} })
  })

  it("adds a field from the palette and shows its properties", async () => {
    const user = userEvent.setup()
    render(<Builder />)

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
    render(<Builder />)

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
    render(<Builder />)

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

  it("edits type-specific settings rendered from the definition", async () => {
    const user = userEvent.setup()
    render(<Builder />)

    await user.click(screen.getByRole("button", { name: "Add Text field" }))
    await user.type(screen.getByLabelText("Min length"), "2")
    await user.type(screen.getByLabelText("Max length"), "5")
    await user.type(screen.getByLabelText("Pattern (regular expression)"), "[[")

    expect(
      screen.getByText("Pattern is not a valid regular expression"),
    ).toBeInTheDocument()

    await user.click(screen.getByRole("tab", { name: /^Schema/ }))
    expect(schemaJson()["properties"]["text"]).toMatchObject({
      minLength: 2,
      maxLength: 5,
    })
    expect(schemaJson()["properties"]["text"]).not.toHaveProperty("pattern")
  })

  it("reorders, duplicates and deletes fields from the canvas", async () => {
    const user = userEvent.setup()
    render(<Builder />)

    await user.click(screen.getByRole("button", { name: "Add Text field" }))
    await user.click(screen.getByRole("button", { name: "Add Date field" }))

    await user.click(screen.getByRole("tab", { name: "Schema" }))
    expect(Object.keys(schemaJson()["properties"])).toEqual(["text", "date"])

    await user.click(screen.getByRole("button", { name: "Move Date up" }))
    expect(Object.keys(schemaJson()["properties"])).toEqual(["date", "text"])

    await user.click(screen.getByRole("button", { name: "Duplicate Date" }))
    expect(screen.getByTestId("canvas-field-date2")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Delete Text" }))
    expect(screen.queryByTestId("canvas-field-text")).not.toBeInTheDocument()
  })

  it("edits options on a choice field", async () => {
    const user = userEvent.setup()
    render(<Builder />)

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
    render(<Builder />)

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

  it("loads a sample form when the host provides one", async () => {
    const user = userEvent.setup()
    render(<Builder sample={createSampleForm} />)

    await user.click(screen.getByRole("button", { name: "load a sample form" }))
    expect(screen.getByLabelText("Form title")).toHaveValue("Client intake")
    expect(screen.getByTestId("canvas-field-fullName")).toBeInTheDocument()
    expect(schemaJson()["required"]).toContain("fullName")
  })

  it("hides sample actions and the schema tab when the host opts out", () => {
    render(<Builder showSchema={false} />)
    expect(
      screen.queryByRole("button", { name: "Load sample" }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole("tab")).not.toBeInTheDocument()
    expect(screen.getByText(/Select a field on the canvas/)).toBeInTheDocument()
  })

  describe("custom field types", () => {
    it("offers a registered custom type with its own settings and no key", async () => {
      const user = userEvent.setup()
      render(<Builder fieldTypes={withSlot} />)

      const paletteItem = screen.getByRole("button", {
        name: "Add Program question field",
      })
      await user.click(paletteItem)

      const card = screen.getByTestId("canvas-field-programQuestionSlot")
      expect(
        within(card).getByText(/Answer scale: Rating \(1 to 5\)/),
      ).toBeInTheDocument()

      // Fixed label, no key, no required: only the answer scale is editable.
      expect(screen.queryByLabelText("Label")).not.toBeInTheDocument()
      expect(screen.queryByLabelText("Key")).not.toBeInTheDocument()
      expect(screen.queryByLabelText("Required")).not.toBeInTheDocument()
      await user.selectOptions(
        screen.getByLabelText("Answer scale"),
        "rating-pictogram",
      )
      expect(
        within(card).getByText(/Pictogram \(smiley faces\)/),
      ).toBeInTheDocument()

      // Single instance: the palette item is disabled and the duplicate action too.
      expect(paletteItem).toBeDisabled()
      expect(
        screen.getByRole("button", { name: "Duplicate Program question" }),
      ).toBeDisabled()

      // Dataless: it is not in the schema.
      await user.click(screen.getByRole("tab", { name: "Schema" }))
      expect(schemaJson()["properties"]).toEqual({})
    })

    it("re-enables the palette item once the single instance is removed", async () => {
      const user = userEvent.setup()
      render(<Builder fieldTypes={withSlot} />)
      await user.click(
        screen.getByRole("button", { name: "Add Program question field" }),
      )
      await user.click(
        screen.getByRole("button", { name: "Delete Program question" }),
      )
      expect(
        screen.getByRole("button", { name: "Add Program question field" }),
      ).toBeEnabled()
    })
  })

  describe("host integration", () => {
    it("works controlled: reports every change and renders the host's value", async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()

      function Host() {
        const [form, setForm] = useState<FormDefinition>({
          title: "Feedback",
          description: "",
          fields: [
            field("text", "serviceListened", {
              label: "The service listened to me",
              locks: { remove: true, key: true, props: true },
            }),
          ],
        })
        return (
          <Builder
            value={form}
            onChange={(next) => {
              onChange(next)
              setForm(next)
            }}
            showSchema={false}
          />
        )
      }

      render(<Host />)
      const card = screen.getByTestId("canvas-field-serviceListened")
      expect(within(card).getByText("Locked")).toBeInTheDocument()
      expect(
        screen.getByRole("button", {
          name: "The service listened to me cannot be deleted",
        }),
      ).toBeDisabled()

      await user.click(
        screen.getByRole("button", { name: "Add Text area field" }),
      )
      expect(onChange).toHaveBeenCalledTimes(1)
      expect(
        onChange.mock.calls[0][0].fields.map((f: { type: string }) => f.type),
      ).toEqual(["text", "textarea"])

      await user.click(
        screen.getByRole("button", { name: "Edit The service listened to me" }),
      )
      expect(screen.getByLabelText("Key")).toBeDisabled()
      const label = screen.getByLabelText("Label")
      await user.clear(label)
      await user.type(label, "Staff listened")
      expect(
        screen.getByRole("button", { name: "Edit Staff listened" }),
      ).toBeInTheDocument()
      const latest = onChange.mock.calls.at(-1)![0] as FormDefinition
      expect(latest.fields[0]).toMatchObject({
        key: "serviceListened",
        label: "Staff listened",
      })
    })

    it("preserves and flags a field whose type is not registered", () => {
      const form: FormDefinition = {
        title: "t",
        description: "",
        fields: [{ ...field("text", "legacy"), type: "signature" }],
      }
      render(<Builder defaultValue={form} />)
      expect(screen.getByTestId("canvas-field-legacy")).toBeInTheDocument()
      expect(screen.getByLabelText("1 issue")).toHaveAttribute(
        "title",
        'Field type "signature" is not registered',
      )
    })
  })
})
