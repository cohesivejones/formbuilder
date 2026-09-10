import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { programQuestionSlot } from "../../examples/programQuestionSlot"
import { field } from "../../test/fields"
import { builtInFieldTypes } from "../fieldTypes/builtIns"
import type { FormDefinition } from "../model/types"
import { FormRenderer } from "./FormRenderer"

function form(
  fields: FormDefinition["fields"],
  meta: Partial<FormDefinition> = {},
) {
  return { title: "Test form", description: "", fields, ...meta }
}

describe("FormRenderer", () => {
  it("renders the form's title and description", () => {
    render(<FormRenderer form={form([], { description: "Please help" })} />)
    expect(
      screen.getByRole("heading", { name: "Test form" }),
    ).toBeInTheDocument()
    expect(screen.getByText("Please help")).toBeInTheDocument()
    expect(screen.getByText("This form has no fields.")).toBeInTheDocument()
  })

  it("labels each control and marks the required ones", () => {
    render(
      <FormRenderer
        form={form([
          field("text", "name", { label: "Your name", required: true }),
          field("email", "email", {
            label: "Email",
            description: "We reply here",
          }),
        ])}
      />,
    )
    expect(screen.getByLabelText(/Your name/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Email/)).toHaveAccessibleDescription(
      "We reply here",
    )
  })

  it("collects answers across every built-in type and submits them", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const options = [
      { id: "1", label: "Red", value: "red" },
      { id: "2", label: "Blue", value: "blue" },
    ]

    render(
      <FormRenderer
        onSubmit={onSubmit}
        form={form([
          field("text", "name", { label: "Name" }),
          field("textarea", "bio", { label: "Bio" }),
          field("email", "email", { label: "Email" }),
          field("number", "age", { label: "Age", integer: true }),
          field("date", "dob", { label: "Born" }),
          field("checkbox", "agree", { label: "Agree" }),
          field("radio", "colour", { label: "Colour", options }),
          field("select", "fav", { label: "Favourite", options }),
          field("checkboxGroup", "likes", { label: "Likes", options }),
        ])}
      />,
    )

    await user.type(screen.getByLabelText("Name"), "Ada")
    await user.type(screen.getByLabelText("Bio"), "Hello")
    await user.type(screen.getByLabelText("Email"), "ada@example.com")
    await user.type(screen.getByLabelText("Age"), "36")
    await user.type(screen.getByLabelText("Born"), "1815-12-10")
    await user.click(screen.getByLabelText("Agree"))
    await user.click(screen.getByRole("radio", { name: "Red" }))
    await user.selectOptions(screen.getByLabelText("Favourite"), "blue")
    await user.click(
      within(screen.getByRole("group", { name: "Likes" })).getByRole(
        "checkbox",
        {
          name: "Blue",
        },
      ),
    )
    await user.click(screen.getByRole("button", { name: "Submit" }))

    expect(onSubmit).toHaveBeenCalledWith({
      name: "Ada",
      bio: "Hello",
      email: "ada@example.com",
      age: 36,
      dob: "1815-12-10",
      agree: true,
      colour: "red",
      fav: "blue",
      likes: ["blue"],
    })
  })

  it("blocks submission and reports every unanswered required field", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <FormRenderer
        onSubmit={onSubmit}
        form={form([
          field("text", "name", { label: "Name", required: true }),
          field("email", "email", { label: "Email", required: true }),
        ])}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Submit" }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole("alert")).toHaveTextContent(
      "There are 2 answers to fix",
    )
    expect(screen.getAllByText("This field is required")).toHaveLength(2)
  })

  it("enforces the constraints the schema carries, in plain words", async () => {
    const user = userEvent.setup()
    render(
      <FormRenderer
        form={form([
          field("email", "email", { label: "Email" }),
          field("text", "code", { label: "Code", minLength: 4 }),
          field("number", "age", { label: "Age", integer: true, min: 18 }),
        ])}
      />,
    )

    await user.type(screen.getByLabelText("Email"), "nope")
    await user.type(screen.getByLabelText("Code"), "ab")
    await user.type(screen.getByLabelText("Age"), "12")
    await user.click(screen.getByRole("button", { name: "Submit" }))

    expect(screen.getByText("Enter a valid email address")).toBeInTheDocument()
    expect(screen.getByText("Enter at least 4 characters")).toBeInTheDocument()
    expect(screen.getByText("Enter 18 or more")).toBeInTheDocument()
  })

  it("holds errors back until submit, then clears them as they are fixed", async () => {
    const user = userEvent.setup()
    render(
      <FormRenderer
        form={form([field("email", "email", { label: "Email" })])}
      />,
    )

    // Nothing is flagged while the respondent is still working, so the form
    // cannot grow under the pointer and swallow their click on Submit.
    const input = screen.getByLabelText("Email")
    await user.type(input, "nope")
    await user.tab()
    expect(
      screen.queryByText("Enter a valid email address"),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Submit" }))
    expect(screen.getByText("Enter a valid email address")).toBeInTheDocument()
    expect(input).toHaveAttribute("aria-invalid", "true")

    // From then on it updates live.
    await user.clear(input)
    await user.type(input, "ada@example.com")
    expect(
      screen.queryByText("Enter a valid email address"),
    ).not.toBeInTheDocument()
    expect(input).not.toHaveAttribute("aria-invalid")
  })

  it("takes the respondent to a summary listing what failed", async () => {
    const user = userEvent.setup()
    render(
      <FormRenderer
        form={form([
          field("text", "name", { label: "Your name", required: true }),
          field("email", "email", { label: "Email" }),
        ])}
      />,
    )

    await user.type(screen.getByLabelText("Email"), "nope")
    await user.click(screen.getByRole("button", { name: "Submit" }))

    const summary = screen.getByRole("alert")
    expect(summary).toHaveFocus()
    expect(summary).toHaveTextContent("Your name: This field is required")
    expect(summary).toHaveTextContent("Email: Enter a valid email address")
  })

  it("treats a required checkbox group as at least one choice", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const options = [
      { id: "1", label: "A", value: "a" },
      { id: "2", label: "B", value: "b" },
    ]
    render(
      <FormRenderer
        onSubmit={onSubmit}
        form={form([
          field("checkboxGroup", "likes", {
            label: "Likes",
            options,
            required: true,
          }),
        ])}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Submit" }))
    expect(onSubmit).not.toHaveBeenCalled()

    await user.click(screen.getByRole("checkbox", { name: "A" }))
    await user.click(screen.getByRole("button", { name: "Submit" }))
    expect(onSubmit).toHaveBeenCalledWith({ likes: ["a"] })
  })

  it("starts a checkbox from its authored default", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <FormRenderer
        onSubmit={onSubmit}
        form={form([
          field("checkbox", "news", {
            label: "Newsletter",
            defaultChecked: true,
          }),
        ])}
      />,
    )
    expect(screen.getByLabelText("Newsletter")).toBeChecked()
    await user.click(screen.getByRole("button", { name: "Submit" }))
    expect(onSubmit).toHaveBeenCalledWith({ news: true })
  })

  it("resets every answer", async () => {
    const user = userEvent.setup()
    render(
      <FormRenderer form={form([field("text", "name", { label: "Name" })])} />,
    )
    await user.type(screen.getByLabelText("Name"), "Ada")
    await user.click(screen.getByRole("button", { name: "Reset" }))
    expect(screen.getByLabelText("Name")).toHaveValue("")
  })

  it("shows a dataless field as a note and collects nothing from it", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <FormRenderer
        fieldTypes={[...builtInFieldTypes, programQuestionSlot]}
        onSubmit={onSubmit}
        form={form([
          {
            ...field("text", "x"),
            type: "programQuestionSlot",
            key: "",
            props: { fieldType: "rating" },
          },
          field("text", "name", { label: "Name" }),
        ])}
      />,
    )
    expect(
      screen.getByText(/Resolved per program at serve time/),
    ).toBeInTheDocument()
    await user.type(screen.getByLabelText("Name"), "Ada")
    await user.click(screen.getByRole("button", { name: "Submit" }))
    expect(onSubmit).toHaveBeenCalledWith({ name: "Ada" })
  })

  it("offers printing, and lets a host turn it off", async () => {
    const user = userEvent.setup()
    const print = vi.fn()
    vi.stubGlobal("print", print)

    const { rerender } = render(
      <FormRenderer form={form([field("text", "name", { label: "Name" })])} />,
    )
    await user.click(screen.getByRole("button", { name: "Print" }))
    expect(print).toHaveBeenCalled()

    rerender(
      <FormRenderer
        form={form([field("text", "name", { label: "Name" })])}
        printable={false}
      />,
    )
    expect(
      screen.queryByRole("button", { name: "Print" }),
    ).not.toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it("gives a dropdown a printable tick list, since paper cannot be clicked", async () => {
    const user = userEvent.setup()
    const options = [
      { id: "1", label: "Metro", value: "metro" },
      { id: "2", label: "South West", value: "southWest" },
    ]
    const { container } = render(
      <FormRenderer
        form={form([field("select", "region", { label: "Region", options })])}
      />,
    )

    // The list is in the markup but belongs to print; that it is actually
    // hidden on screen is a question of applied CSS, so it is asserted in the
    // browser check rather than here.
    const items = () => Array.from(container.querySelectorAll("li"))
    expect(items().map((li) => li.textContent)).toEqual(["Metro", "South West"])
    expect(container.querySelector("ul")).toHaveClass("printChoices")
    expect(screen.getByLabelText("Region")).toHaveClass("screenOnly")

    // Choosing an option marks it, so a completed form prints the answer too.
    await user.selectOptions(screen.getByLabelText("Region"), "southWest")
    expect(items().map((li) => li.textContent)).toEqual([
      "Metro",
      "\u2713South West",
    ])
  })

  it("flags a field type it does not know rather than dropping it", () => {
    render(
      <FormRenderer
        form={form([{ ...field("text", "sig"), type: "signature" }])}
      />,
    )
    expect(screen.getByText(/does not know about/)).toBeInTheDocument()
  })
})

describe("FormRenderer conditional logic", () => {
  function conditionalForm() {
    const contact = field("radio", "contactMethod", {
      label: "Contact method",
      options: [
        { id: "1", label: "Phone", value: "phone" },
        { id: "2", label: "None", value: "none" },
      ],
    })
    const phone = field("text", "phoneNumber", {
      label: "Phone number",
      required: true,
    })
    phone.visibleWhen = { op: "eq", field: contact.id, value: "phone" }
    const comments = field("textarea", "comments", { label: "Comments" })
    comments.requiredWhen = { op: "eq", field: contact.id, value: "none" }
    return form([contact, phone, comments])
  }

  it("shows a field only while its condition holds", async () => {
    const user = userEvent.setup()
    render(<FormRenderer form={conditionalForm()} />)

    // Hidden fields still exist in the markup as aria-hidden print ghosts
    // (jsdom does not apply the stylesheet that hides them), so presence is
    // asked through the accessibility tree, which is what a person gets.
    const phoneBox = () =>
      screen.queryByRole("textbox", { name: /Phone number/ })
    expect(phoneBox()).not.toBeInTheDocument()
    await user.click(screen.getByRole("radio", { name: "Phone" }))
    expect(phoneBox()).toBeInTheDocument()
    await user.click(screen.getByRole("radio", { name: "None" }))
    expect(phoneBox()).not.toBeInTheDocument()
  })

  it("keeps a hidden field's answer on screen but never submits it", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<FormRenderer form={conditionalForm()} onSubmit={onSubmit} />)

    await user.click(screen.getByRole("radio", { name: "Phone" }))
    await user.type(screen.getByLabelText(/Phone number/), "0400 000 000")
    await user.click(screen.getByRole("radio", { name: "None" }))
    await user.type(screen.getByLabelText("Comments"), "Nothing further")
    await user.click(screen.getByRole("button", { name: "Submit" }))

    expect(onSubmit).toHaveBeenCalledWith({
      contactMethod: "none",
      comments: "Nothing further",
    })

    // The answer was retained underneath and comes back with the field.
    await user.click(screen.getByRole("radio", { name: "Phone" }))
    expect(screen.getByLabelText(/Phone number/)).toHaveValue("0400 000 000")
  })

  it("requires a visible conditional field and forgets it once hidden", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<FormRenderer form={conditionalForm()} onSubmit={onSubmit} />)

    // Phone chosen, number omitted: blocked.
    await user.click(screen.getByRole("radio", { name: "Phone" }))
    await user.click(screen.getByRole("button", { name: "Submit" }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(
      screen.getAllByText("This field is required").length,
    ).toBeGreaterThan(0)

    // Switch away: the demand disappears with the field.
    await user.click(screen.getByRole("radio", { name: "None" }))
    await user.type(screen.getByLabelText("Comments"), "ok")
    await user.click(screen.getByRole("button", { name: "Submit" }))
    expect(onSubmit).toHaveBeenCalled()
  })

  it("enforces requiredWhen on an always-visible field", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<FormRenderer form={conditionalForm()} onSubmit={onSubmit} />)

    await user.click(screen.getByRole("radio", { name: "None" }))
    await user.click(screen.getByRole("button", { name: "Submit" }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Comments: This field is required",
    )
  })

  it("cascades: hiding a controller takes its dependents down too", async () => {
    const user = userEvent.setup()
    const a = field("checkbox", "a", { label: "Show B" })
    const b = field("checkbox", "b", { label: "Show C" })
    b.visibleWhen = { op: "eq", field: a.id, value: true }
    const c = field("text", "c", { label: "C" })
    c.visibleWhen = { op: "eq", field: b.id, value: true }
    render(<FormRenderer form={form([a, b, c])} />)

    await user.click(screen.getByLabelText("Show B"))
    await user.click(screen.getByLabelText("Show C"))
    expect(screen.getByLabelText("C")).toBeInTheDocument()

    // Unticking A hides B, whose still-ticked answer must no longer show C.
    await user.click(screen.getByLabelText("Show B"))
    expect(
      screen.queryByRole("checkbox", { name: "Show C" }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: "C" })).not.toBeInTheDocument()
  })

  it("prints a hidden question as a ghost with its condition", () => {
    const { container } = render(<FormRenderer form={conditionalForm()} />)
    const ghost = container.querySelector(".printGhost")
    expect(ghost).not.toBeNull()
    expect(ghost).toHaveTextContent("Only if: Contact method = 'phone'")
    expect(ghost).toHaveTextContent("Phone number")
  })
})
