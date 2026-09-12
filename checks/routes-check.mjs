import { chromium } from "./browser.mjs"

const OUT = process.argv[2]
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`))
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text()}`)
})

const r = {}

// 1. Root route: the full builder, palette present.
await page.goto("http://localhost:5199/")
await page.evaluate(() => localStorage.clear())
await page.reload()
await page.getByRole("complementary", { name: "Field palette" }).waitFor()
r.rootHasPalette = true
await page.screenshot({ path: `${OUT}/route-01-full.png` })

// 2. Navigate by clicking the nav link (client-side routing).
await page.getByRole("link", { name: /Locked-down form/ }).click()
await page.waitForURL("**/locked-down")
await page.getByTestId("canvas-field-serviceListened").waitFor()
r.navUrl = new URL(page.url()).pathname
r.paletteGone =
  (await page.getByRole("complementary", { name: "Field palette" }).count()) ===
  0
r.addButtons = await page
  .getByRole("button", { name: /^Add .* field$/ })
  .count()
r.navActive = await page.locator('a[aria-current="page"]').innerText()

// 3. Pinned vs free fields.
r.lockedBadges = await page.getByTitle("Locked by the host application").count()
r.dragHandles = await page
  .getByRole("button", { name: /^Drag to reorder/ })
  .count()
r.anchoredDeleteDisabled = await page
  .getByRole("button", { name: "The service listened to me cannot be deleted" })
  .isDisabled()
await page.screenshot({ path: `${OUT}/route-02-locked-down.png` })

// 4. Reword a pinned question; its key must not follow.
await page
  .getByRole("button", { name: "Edit My situation has improved" })
  .click()
await page
  .getByLabel("Label", { exact: true })
  .fill("Things have improved for me")
r.reworded = await page
  .getByRole("button", { name: "Edit Things have improved for me" })
  .count()
r.keyUnchanged = await page
  .getByTestId("canvas-field-situationImproved")
  .count()

// 5. The free comment field still drags.
const handle = page.getByRole("button", {
  name: /^Drag to reorder Anything else/,
})
// The comment field sits below the fold; bring it into view before pointing at it.
await handle.scrollIntoViewIfNeeded()
await page.waitForTimeout(100)
const box = await handle.boundingBox()
const card = await page
  .getByTestId("canvas-field-additionalComments")
  .boundingBox()
const target = await page
  .getByTestId("canvas-field-programQuestionSlot")
  .boundingBox()
// Sorting uses closest-center, so move the card's centre past the target's.
const dy = target.y + target.height / 2 - (card.y + card.height / 2) - 8
const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
await page.mouse.move(start.x, start.y)
await page.mouse.down()
await page.mouse.move(start.x, start.y - 10, { steps: 3 })
await page.mouse.move(start.x, start.y + dy, { steps: 20 })
await page.waitForTimeout(150)
await page.mouse.up()
await page.waitForTimeout(250)
r.orderAfterDrag = (
  await page
    .locator('[data-testid^="canvas-field-"]')
    .evaluateAll((els) =>
      els.map((e) => e.dataset.testid.replace("canvas-field-", "")),
    )
).join()

// 6. Deep link straight to the route, then an unknown path redirects home.
await page.goto("http://localhost:5199/locked-down")
await page.getByTestId("canvas-field-serviceListened").waitFor()
r.deepLinkOk = true
await page.goto("http://localhost:5199/nope")
await page.getByRole("complementary", { name: "Field palette" }).waitFor()
r.unknownRedirect = new URL(page.url()).pathname

console.log(JSON.stringify(r, null, 2))
console.log("errors:", errors.length ? errors : "none")
await browser.close()

const ok =
  r.navUrl === "/locked-down" &&
  r.paletteGone &&
  r.addButtons === 0 &&
  /Locked-down form/.test(r.navActive) &&
  r.lockedBadges === 3 &&
  r.dragHandles === 2 &&
  r.anchoredDeleteDisabled === true &&
  r.reworded === 1 &&
  r.keyUnchanged === 1 &&
  r.orderAfterDrag ===
    "serviceListened,serviceReceived,situationImproved,additionalComments,programQuestionSlot" &&
  r.deepLinkOk &&
  r.unknownRedirect === "/" &&
  errors.length === 0
console.log(ok ? "ROUTES CHECK PASSED" : "ROUTES CHECK FAILED")
process.exit(ok ? 0 : 1)
