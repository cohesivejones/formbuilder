import { chromium } from "./browser.mjs"

const OUT = process.argv[2]
const URL = "http://localhost:5199/"

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`))
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text()}`)
})

await page.goto(URL)
await page.evaluate(() => localStorage.clear())
await page.reload()
await page.getByText("Your form is empty").waitFor()

async function drag(fromLocator, toPoint) {
  const from = await fromLocator.boundingBox()
  const start = { x: from.x + from.width / 2, y: from.y + from.height / 2 }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + 10, start.y + 10, { steps: 3 })
  await page.mouse.move(toPoint.x, toPoint.y, { steps: 20 })
  await page.waitForTimeout(150)
  await page.mouse.up()
  await page.waitForTimeout(150)
}

const results = {}

// 1. Built-ins still drag: Text onto the empty canvas.
const dropArea = page.getByTestId("canvas-drop-area")
let box = await dropArea.boundingBox()
await drag(page.getByRole("button", { name: "Add Text field" }), {
  x: box.x + box.width / 2,
  y: box.y + box.height / 2,
})
await page.getByTestId("canvas-field-text").waitFor()

// 2. Drag the custom Program question slot to land before Text.
const first = await page.getByTestId("canvas-field-text").boundingBox()
await drag(page.getByRole("button", { name: "Add Program question field" }), {
  x: first.x + first.width / 2,
  y: first.y + 8,
})
await page.getByTestId("canvas-field-programQuestionSlot").waitFor()
results.order = await page
  .locator('[data-testid^="canvas-field-"]')
  .evaluateAll((els) =>
    els.map((e) => e.dataset.testid.replace("canvas-field-", "")),
  )
results.paletteDisabled = await page
  .getByRole("button", { name: "Add Program question field" })
  .isDisabled()

// 3. Only the answer scale is editable; changing it updates the card.
results.hasLabelInput = await page.getByLabel("Label", { exact: true }).count()
results.hasKeyInput = await page.getByLabel("Key", { exact: true }).count()
await page.getByLabel("Answer scale").selectOption("rating-pictogram")
results.cardScale = await page
  .getByTestId("canvas-field-programQuestionSlot")
  .getByText(/Answer scale/)
  .textContent()
await page.screenshot({ path: `${OUT}/slot-01-properties.png` })

// 4. Schema excludes the dataless slot; text remains.
await page.getByRole("tab", { name: /^Schema/ }).click()
const schema = JSON.parse(await page.getByTestId("schema-json").textContent())
results.schemaKeys = Object.keys(schema.properties)
await page.screenshot({ path: `${OUT}/slot-02-schema.png` })

// 5. Reload: persisted form comes back with the slot intact.
await page.reload()
await page.getByTestId("canvas-field-programQuestionSlot").waitFor()
results.persistedScale = await page
  .getByTestId("canvas-field-programQuestionSlot")
  .getByText(/Answer scale/)
  .textContent()

console.log(JSON.stringify(results, null, 2))
console.log("errors:", errors.length ? errors : "none")
await browser.close()

const ok =
  results.order.join() === "programQuestionSlot,text" &&
  results.paletteDisabled === true &&
  results.hasLabelInput === 0 &&
  results.hasKeyInput === 0 &&
  /Pictogram/.test(results.cardScale) &&
  results.schemaKeys.join() === "text" &&
  /Pictogram/.test(results.persistedScale) &&
  errors.length === 0
console.log(ok ? "SLOT CHECK PASSED" : "SLOT CHECK FAILED")
process.exit(ok ? 0 : 1)
