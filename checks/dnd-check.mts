import { chromium, type Locator } from "playwright"
import { OUT, boxOf, report, watchErrors } from "./support.mts"

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = watchErrors(page)

await page.goto("http://localhost:5199/")
await page.evaluate(() => localStorage.clear())
await page.reload()
await page.getByText("Your form is empty").waitFor()
await page.screenshot({ path: `${OUT}/01-empty.png` })

// Pointer-drag helper: press, move in steps (so the 5px activation constraint
// fires), release.
async function drag(fromLocator: Locator, toPoint: { x: number; y: number }) {
  const from = await boxOf(fromLocator)
  const start = { x: from.x + from.width / 2, y: from.y + from.height / 2 }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + 10, start.y + 10, { steps: 3 })
  await page.mouse.move(toPoint.x, toPoint.y, { steps: 20 })
  await page.waitForTimeout(150)
  await page.screenshot({ path: `${OUT}/mid-drag.png` })
  await page.mouse.up()
  await page.waitForTimeout(150)
}

const fieldOrder = () =>
  page
    .locator('[data-testid^="canvas-field-"]')
    .evaluateAll((els) =>
      els.map(
        (e) =>
          (e as HTMLElement).dataset.testid?.replace("canvas-field-", "") ?? "",
      ),
    )

// 1. Drag "Text" from the palette onto the empty canvas.
const dropArea = await boxOf(page.getByTestId("canvas-drop-area"))
await drag(page.getByRole("button", { name: "Add Text field" }), {
  x: dropArea.x + dropArea.width / 2,
  y: dropArea.y + dropArea.height / 2,
})
await page.getByTestId("canvas-field-text").waitFor()
await page.screenshot({ path: `${OUT}/02-dropped-text.png` })

// 2. Add Email and Dropdown by click, then drag "Date" to land BEFORE the first field.
await page.getByRole("button", { name: "Add Email field" }).click()
await page.getByRole("button", { name: "Add Dropdown field" }).click()
const first = await boxOf(page.getByTestId("canvas-field-text"))
await drag(page.getByRole("button", { name: "Add Date field" }), {
  x: first.x + first.width / 2,
  y: first.y + 8,
})
await page.getByTestId("canvas-field-date").waitFor()

const orderAfterInsert = await fieldOrder()
console.log("order after palette insert-before:", orderAfterInsert.join(", "))

// 3. Reorder: drag the Date card's handle down below the Dropdown card.
const last = await boxOf(page.getByTestId("canvas-field-dropdown"))
await drag(page.getByRole("button", { name: "Drag to reorder Date" }), {
  x: last.x + 40,
  y: last.y + last.height - 4,
})
const orderAfterSort = await fieldOrder()
console.log("order after sortable drag:", orderAfterSort.join(", "))

// 4. Select the dropdown, rename it, and check the schema output.
await page.getByRole("button", { name: "Edit Dropdown" }).click()
await page.getByLabel("Label", { exact: true }).fill("Favourite colour")
await page.getByLabel("Required", { exact: true }).check()
await page.screenshot({ path: `${OUT}/03-properties.png` })
await page.getByRole("tab", { name: /^Schema/ }).click()
const schema = JSON.parse(
  (await page.getByTestId("schema-json").textContent()) ?? "{}",
) as { properties: Record<string, unknown>; required?: string[] }
console.log("schema keys:", Object.keys(schema.properties).join(", "))
console.log("required:", JSON.stringify(schema.required))
console.log(
  "favouriteColour:",
  JSON.stringify(schema.properties.favouriteColour),
)
await page.screenshot({ path: `${OUT}/04-schema.png` })

// 5. Load sample for a full-canvas screenshot.
await page.getByRole("button", { name: "Load sample" }).click()
await page.getByTestId("canvas-field-fullName").waitFor()
await page.screenshot({ path: `${OUT}/05-sample.png`, fullPage: false })

console.log("errors:", errors.length ? errors : "none")
await browser.close()

report(
  "DND",
  orderAfterInsert.join() === "date,text,email,dropdown" &&
    orderAfterSort.join() === "text,email,dropdown,date" &&
    (schema.required ?? []).join() === "favouriteColour" &&
    errors.length === 0,
)
