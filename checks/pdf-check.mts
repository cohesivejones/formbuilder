import { statSync } from "node:fs"
import { chromium } from "playwright"
import { OUT, report, watchErrors } from "./support.mts"

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = watchErrors(page)

const r = {
  blankBytes: -1,
  navHidden: false,
  sidebarHidden: false,
  formVisible: false,
  actionsHidden: false,
  bodyScrolls: "",
  printedHeight: -1,
  filledBytes: -1,
}

await page.goto("http://localhost:5199/renderer")
await page.getByRole("heading", { name: "Client intake" }).waitFor()

// A blank form, for someone to complete on paper.
await page.pdf({
  path: `${OUT}/form-blank.pdf`,
  format: "A4",
  printBackground: true,
})
r.blankBytes = statSync(`${OUT}/form-blank.pdf`).size

// What the print stylesheet leaves on the page, checked in print media.
await page.emulateMedia({ media: "print" })
const hidden = async (sel: string) =>
  page
    .locator(sel)
    .first()
    .isVisible()
    .then((v) => !v)
r.navHidden = await hidden("nav")
r.sidebarHidden = await hidden("aside")
r.formVisible = await page.locator("form").first().isVisible()
r.actionsHidden =
  (await page.getByRole("button", { name: "Submit" }).isVisible()) === false
r.bodyScrolls = await page.evaluate(
  () => getComputedStyle(document.body).overflow,
)
r.printedHeight = await page.evaluate(
  () => document.documentElement.scrollHeight,
)
await page.emulateMedia({ media: null })

// The same form filled in becomes the record of a submission.
await page.getByLabel(/Full name/).fill("Ada Lovelace")
await page.getByLabel(/Email address/).fill("ada@example.com")
await page.getByLabel(/Date of birth/).fill("1815-12-10")
await page.getByRole("radio", { name: "Phone" }).check()
await page.getByLabel(/^Region/).selectOption("southWest")
await page.getByRole("checkbox", { name: "Counselling" }).check()
await page.getByRole("checkbox", { name: "Mediation" }).check()
await page.getByLabel(/People in your household/).fill("3")
await page.getByLabel(/Anything else/).fill("Please call after 5pm.")
await page.getByLabel(/I agree to be contacted/).check()
await page.pdf({
  path: `${OUT}/form-filled.pdf`,
  format: "A4",
  printBackground: true,
})
r.filledBytes = statSync(`${OUT}/form-filled.pdf`).size

console.log(JSON.stringify(r, null, 2))
console.log("errors:", errors.length ? errors : "none")
await browser.close()

report(
  "PDF",
  r.blankBytes > 1000 &&
    r.filledBytes > 1000 &&
    r.navHidden &&
    r.sidebarHidden &&
    r.formVisible &&
    r.actionsHidden &&
    r.bodyScrolls === "visible" &&
    r.printedHeight > 900 &&
    errors.length === 0,
)
