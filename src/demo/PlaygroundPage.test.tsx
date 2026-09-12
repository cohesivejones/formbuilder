import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { PlaygroundPage } from "./PlaygroundPage"

function tree() {
  return JSON.parse(screen.getByTestId("playground-tree").textContent ?? "{}")
}

describe("PlaygroundPage", () => {
  it("shows the seeded expression as tree, schema and verdict", () => {
    render(<PlaygroundPage />)

    // The seed is the precedence example: (contains and eq) or contains.
    expect(tree()).toMatchObject({
      op: "or",
      conditions: [
        { op: "and" },
        { op: "contains", field: "finalComments", value: "urgent" },
      ],
    })
    expect(screen.getByTestId("playground-schema")).toHaveTextContent('"anyOf"')
    // Default answers: other ticked and contact by phone, so the and-side holds.
    expect(screen.getByTestId("playground-verdict")).toHaveTextContent(
      /^Matches/,
    )
  })

  it("re-evaluates as the sample answers change", async () => {
    const user = userEvent.setup()
    render(<PlaygroundPage />)

    const answers = screen.getByLabelText("Sample answers JSON")
    await user.clear(answers)
    await user.paste('{ "contactMethod": "none", "services": ["counselling"] }')
    expect(screen.getByTestId("playground-verdict")).toHaveTextContent(
      /^No match/,
    )

    await user.clear(answers)
    await user.paste("{ nope")
    expect(screen.getByTestId("playground-verdict")).toHaveTextContent(
      /Not valid JSON/,
    )
  })

  it("parses what is typed, with the semantic checks live", async () => {
    const user = userEvent.setup()
    render(<PlaygroundPage />)

    const input = screen.getByLabelText("Expression")
    await user.clear(input)
    await user.paste("hasAllergies = true")
    expect(tree()).toEqual({ op: "eq", field: "hasAllergies", value: true })
    expect(screen.getByTestId("playground-verdict")).toHaveTextContent(
      /^Matches/,
    )

    await user.clear(input)
    await user.paste("contactMethod = 'phome'")
    expect(
      screen.getByText(/contactMethod has no option 'phome'/),
    ).toBeInTheDocument()
  })

  it("loads a preset and regrouping with parentheses flips the verdict", async () => {
    const user = userEvent.setup()
    render(<PlaygroundPage />)

    const answers = screen.getByLabelText("Sample answers JSON")
    await user.clear(answers)
    await user.paste(
      '{ "services": ["other"], "finalComments": "urgent please" }',
    )

    // (other and phone) or urgent → true via the urgent clause.
    expect(screen.getByTestId("playground-verdict")).toHaveTextContent(
      /^Matches/,
    )

    // other and (phone or urgent) → still true? services other ✓, urgent ✓ → true.
    // Drop 'other' instead to split the two readings.
    await user.clear(answers)
    await user.paste('{ "finalComments": "urgent please" }')
    expect(screen.getByTestId("playground-verdict")).toHaveTextContent(
      /^Matches/,
    )

    await user.click(
      screen.getByRole("button", {
        name: "services contains 'other' and (contactMethod = 'phone' or finalComments contains 'urgent')",
      }),
    )
    expect(tree()).toMatchObject({ op: "and" })
    expect(screen.getByTestId("playground-verdict")).toHaveTextContent(
      /^No match/,
    )
  })
})
