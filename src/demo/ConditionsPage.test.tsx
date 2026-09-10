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
