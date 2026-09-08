import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { RendererPage } from "./RendererPage"

describe("RendererPage", () => {
  it("renders the sample form to start with", () => {
    render(<RendererPage />)
    expect(
      screen.getByRole("heading", { name: "Client intake" }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/Full name/)).toBeInTheDocument()
  })

  it("renders a pasted definition", async () => {
    const user = userEvent.setup()
    render(<RendererPage />)

    const pasted = JSON.stringify({
      title: "Tiny form",
      fields: [
        {
          id: "f1",
          type: "text",
          key: "nickname",
          autoKey: false,
          label: "Nickname",
          required: false,
          props: {},
        },
      ],
    })
    const editor = screen.getByLabelText("Form definition JSON")
    await user.clear(editor)
    await user.paste(pasted)
    await user.click(screen.getByRole("button", { name: "Render this form" }))

    expect(
      screen.getByRole("heading", { name: "Tiny form" }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Nickname")).toBeInTheDocument()
  })

  it("explains a bad paste without changing the rendered form", async () => {
    const user = userEvent.setup()
    render(<RendererPage />)

    const editor = screen.getByLabelText("Form definition JSON")
    await user.clear(editor)
    await user.paste("{ not json")
    await user.click(screen.getByRole("button", { name: "Render this form" }))

    expect(screen.getByRole("alert")).toHaveTextContent(/not valid JSON/)
    expect(
      screen.getByRole("heading", { name: "Client intake" }),
    ).toBeInTheDocument()
  })

  it("says so when the builder has saved nothing yet", async () => {
    const user = userEvent.setup()
    render(<RendererPage />)
    await user.click(screen.getByRole("button", { name: "Load from builder" }))
    expect(screen.getByRole("alert")).toHaveTextContent(
      /has not saved a form yet/,
    )
  })

  it("shows the submitted answers", async () => {
    const user = userEvent.setup()
    render(<RendererPage />)

    await user.type(screen.getByLabelText(/Full name/), "Ada")
    await user.type(screen.getByLabelText(/Email address/), "ada@example.com")
    await user.click(screen.getByRole("radio", { name: "Phone" }))
    await user.click(screen.getByRole("checkbox", { name: "Counselling" }))
    await user.click(screen.getByLabelText(/I agree to be contacted/))
    await user.click(screen.getByRole("button", { name: "Submit" }))

    const output = screen.getByRole("heading", { name: "Submitted answers" })
      .parentElement as HTMLElement
    expect(output).toHaveTextContent('"fullName": "Ada"')
    expect(output).toHaveTextContent('"contactMethod": "phone"')
  })
})
