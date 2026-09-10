import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { ConditionsPage } from "./ConditionsPage"

describe("ConditionsPage", () => {
  it("lists the rules beside the form", () => {
    render(<ConditionsPage />)
    expect(
      screen.getByRole("heading", { name: "Follow-up preferences" }),
    ).toBeInTheDocument()
    const rules = screen.getByRole("complementary", { name: "The rules" })
    expect(rules).toHaveTextContent("contactMethod = 'phone'")
    expect(rules).toHaveTextContent("services contains 'other'")
    expect(rules).toHaveTextContent("contactMethod = 'none'")
  })

  it("reveals the phone question for the phone answer and keeps it out of a non-phone submission", async () => {
    const user = userEvent.setup()
    render(<ConditionsPage />)

    expect(
      screen.queryByRole("textbox", { name: /Best phone number/ }),
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole("radio", { name: "Please phone me" }))
    await user.type(
      screen.getByRole("textbox", { name: /Best phone number/ }),
      "0400",
    )

    // Change of mind: no follow-up, which instead demands the comments box.
    await user.click(screen.getByRole("radio", { name: "No follow-up" }))
    await user.click(screen.getByRole("button", { name: "Submit" }))
    expect(screen.getByRole("alert")).toHaveTextContent("Anything else?")

    await user.type(
      screen.getByRole("textbox", { name: /Anything else/ }),
      "All good, thanks",
    )
    await user.click(screen.getByRole("button", { name: "Submit" }))

    const submitted = JSON.parse(
      screen.getByTestId("conditions-submission").textContent ?? "{}",
    )
    expect(submitted).toEqual({
      contactMethod: "none",
      finalComments: "All good, thanks",
    })
  })
})

describe("ConditionsPage rule editing", () => {
  it("shows where a rule is stored in the definition", async () => {
    const user = userEvent.setup()
    render(<ConditionsPage />)
    await user.click(screen.getByText("How a rule is stored"))
    const stored = JSON.parse(
      screen.getByTestId("stored-rule").textContent ?? "{}",
    )
    expect(stored.key).toBe("phoneNumber")
    expect(stored.visibleWhen).toMatchObject({ op: "eq", value: "phone" })
  })

  it("opens the builder view with the expression prefilled, and edits flow back", async () => {
    const user = userEvent.setup()
    render(<ConditionsPage />)

    await user.click(screen.getByRole("tab", { name: "Edit the rules" }))
    await user.click(
      screen.getByRole("button", { name: "Edit Best phone number" }),
    )

    const input = screen.getByLabelText("Visible when")
    expect(input).toHaveValue("contactMethod = 'phone'")

    // Loosen the rule: the phone box now also shows for email.
    await user.clear(input)
    await user.type(input, "contactMethod != 'none'")

    await user.click(screen.getByRole("tab", { name: "Try the form" }))
    await user.click(screen.getByRole("radio", { name: "Please email me" }))
    expect(
      screen.getByRole("textbox", { name: /Best phone number/ }),
    ).toBeInTheDocument()
  })
})
