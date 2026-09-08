import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { LockedDownFormPage } from "./LockedDownFormPage"

describe("LockedDownFormPage", () => {
  it("offers no way to add a field", () => {
    render(<LockedDownFormPage />)
    expect(
      screen.queryByRole("complementary", { name: "Field palette" }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /^Add / }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /^Duplicate / }),
    ).not.toBeInTheDocument()
  })

  it("pins the outcome questions but leaves the rest of the form free", () => {
    render(<LockedDownFormPage />)

    const anchored = screen.getByTestId("canvas-field-serviceListened")
    expect(within(anchored).getByText("Locked")).toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: "The service listened to me cannot be deleted",
      }),
    ).toBeDisabled()
    expect(
      screen.queryByRole("button", {
        name: "Drag to reorder The service listened to me",
      }),
    ).not.toBeInTheDocument()

    const comments = "Anything else you would like to tell us?"
    expect(
      screen.getByRole("button", { name: `Delete ${comments}` }),
    ).toBeEnabled()
    expect(
      screen.getByRole("button", { name: `Drag to reorder ${comments}` }),
    ).toBeInTheDocument()
  })

  it("allows rewording a pinned question without changing its key", async () => {
    const user = userEvent.setup()
    render(<LockedDownFormPage />)

    await user.click(
      screen.getByRole("button", { name: "Edit My situation has improved" }),
    )
    const label = screen.getByLabelText("Label")
    await user.clear(label)
    await user.type(label, "Things have improved for me")

    expect(
      screen.getByRole("button", { name: "Edit Things have improved for me" }),
    ).toBeInTheDocument()
    // The key still anchors the export, and is not offered for editing.
    expect(
      screen.getByTestId("canvas-field-situationImproved"),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText("Key")).not.toBeInTheDocument()
  })

  it("keeps the form title read-only", () => {
    render(<LockedDownFormPage />)
    expect(screen.getByLabelText("Form title")).toHaveAttribute("readonly")
  })
})
