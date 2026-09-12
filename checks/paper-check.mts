import { statSync } from "node:fs"
import { chromium } from "playwright"
import { OUT, report, watchErrors } from "./support.mts"

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = watchErrors(page)

const r = {
  screenSelectVisible: false,
  screenTickListHidden: false,
  selectHidden: false,
  regionOptionsOnPaper: false,
  placeholderHidden: "",
  inputHeight: -1,
  dateBoxOnPaper: false,
  filledBytes: -1,
  chosenRegionTicked: "",
}

await page.goto("http://localhost:5199/renderer")
await page.getByRole("heading", { name: "Client intake" }).waitFor()

// On screen the dropdown is the control and the paper tick list must not show.
r.screenSelectVisible = await page.getByLabel(/^Region/).isVisible()
r.screenTickListHidden = await page.evaluate(() => {
  const li = [...document.querySelectorAll("li")].find((el) =>
    el.textContent?.includes("Great Southern"),
  )
  const ul = li?.closest("ul")
  return !ul || ul.getBoundingClientRect().height === 0
})

await page.emulateMedia({ media: "print" })
await page.waitForTimeout(200)

// The dropdown gives way to a tick list of every option.
r.selectHidden = !(await page.getByLabel(/^Region/).isVisible())
r.regionOptionsOnPaper = await page
  .locator("li", { hasText: "Great Southern" })
  .first()
  .isVisible()

// Placeholders would read as answers once printed.
r.placeholderHidden = await page
  .getByLabel(/Full name/)
  .evaluate((el) => getComputedStyle(el, "::placeholder").color)

// Enough room to write by hand: 9mm is about 34px at 96dpi.
r.inputHeight = await page
  .getByLabel(/Full name/)
  .evaluate((el) => Math.round(el.getBoundingClientRect().height))

// The date field stays as the writing box, keeping its dd/mm/yyyy format hint.
// Its calendar button is hidden by CSS that getComputedStyle cannot read, so
// that is confirmed by reading the generated PDF rather than asserted here.
r.dateBoxOnPaper = await page.getByLabel(/Date of birth/).isVisible()

await page.emulateMedia({ media: null })

// Backgrounds off is the default in Chrome's print dialogue, so the paper
// fallback has to survive it.
await page.getByLabel(/^Region/).selectOption("southWest")
await page.getByRole("checkbox", { name: "Counselling" }).check()
await page.pdf({
  path: `${OUT}/paper-filled.pdf`,
  format: "A4",
  printBackground: false,
})
r.filledBytes = statSync(`${OUT}/paper-filled.pdf`).size

await page.emulateMedia({ media: "print" })
r.chosenRegionTicked = await page
  .locator("li", { hasText: "South West" })
  .first()
  .innerText()

console.log(JSON.stringify(r, null, 2))
console.log("errors:", errors.length ? errors : "none")
await browser.close()

report(
  "PAPER",
  r.screenSelectVisible &&
    r.screenTickListHidden &&
    r.selectHidden &&
    r.regionOptionsOnPaper &&
    r.placeholderHidden === "rgba(0, 0, 0, 0)" &&
    r.inputHeight >= 33 &&
    r.dateBoxOnPaper &&
    r.chosenRegionTicked.includes("✓") &&
    r.filledBytes > 1000 &&
    errors.length === 0,
)
