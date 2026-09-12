import { chromium } from "playwright"
import { OUT, boxOf, report, watchErrors } from "./support.mts"

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = watchErrors(page)

const r = {
  loadedFromBuilder: false,
  fieldsRendered: -1,
  alert: "",
  requiredError: -1,
  emailError: -1,
  submitted: {} as Record<string, unknown>,
  pastedGroup: -1,
  pastedSubmission: {} as Record<string, unknown>,
  parseError: "",
  formUnchanged: -1,
}

// 1. Build a form on the homepage so the renderer has something to pick up.
await page.goto("http://localhost:5199/")
await page.evaluate(() => localStorage.clear())
await page.reload()
await page.getByRole("button", { name: "Add Text field" }).click()
await page.getByLabel("Label", { exact: true }).fill("Nickname")
await page.getByLabel("Required", { exact: true }).check()
await page.getByRole("button", { name: "Add Email field" }).click()
await page.getByLabel("Label", { exact: true }).fill("Contact email")
await page.getByLabel("Form title").fill("Handover form")
await page.waitForTimeout(200)

// 2. Cross to the renderer and pull that form in.
await page.getByRole("link", { name: /Renderer/ }).click()
await page.waitForURL("**/renderer")
await page.getByRole("button", { name: "Load from builder" }).click()
await page.getByRole("heading", { name: "Handover form" }).waitFor()
r.loadedFromBuilder = true
r.fieldsRendered = await page.getByLabel(/Nickname|Contact email/).count()
await page.screenshot({ path: `${OUT}/renderer-01-loaded.png` })

// 3. Required and format rules come from the generated schema. The click is
//    driven by hand, with the layout settled, so a shift that swallowed it
//    would show up here.
await page.getByLabel(/Contact email/).fill("not-an-email")
await page.waitForTimeout(300)
const submitBox = await boxOf(page.getByRole("button", { name: "Submit" }))
await page.mouse.move(
  submitBox.x + submitBox.width / 2,
  submitBox.y + submitBox.height / 2,
)
await page.mouse.down()
await page.waitForTimeout(150)
await page.mouse.up()
await page.waitForTimeout(300)
r.alert = await page.getByRole("alert").innerText()
r.requiredError = await page.getByText("This field is required").count()
r.emailError = await page.getByText("Enter a valid email address").count()
await page.screenshot({ path: `${OUT}/renderer-02-errors.png` })

// 4. Fix the answers and submit.
await page.getByLabel(/Nickname/).fill("Ada")
await page.getByLabel(/Contact email/).fill("ada@example.com")
await page.getByRole("button", { name: "Submit" }).click()
await page.getByRole("heading", { name: "Submitted answers" }).waitFor()
r.submitted = JSON.parse(await page.locator("pre code").innerText()) as Record<
  string,
  unknown
>
await page.screenshot({ path: `${OUT}/renderer-03-submitted.png` })

// 5. A pasted definition replaces the rendered form; a bad paste explains itself.
const pasted = JSON.stringify(
  {
    title: "Pasted form",
    fields: [
      {
        id: "p1",
        type: "radio",
        key: "colour",
        autoKey: false,
        label: "Colour",
        required: true,
        props: {
          options: [
            { id: "o1", label: "Red", value: "red" },
            { id: "o2", label: "Blue", value: "blue" },
          ],
        },
      },
    ],
  },
  null,
  2,
)
await page.getByLabel("Form definition JSON").fill(pasted)
await page.getByRole("button", { name: "Render this form" }).click()
await page.getByRole("heading", { name: "Pasted form" }).waitFor()
r.pastedGroup = await page.getByRole("group", { name: /Colour/ }).count()
await page.getByRole("radio", { name: "Blue" }).check()
await page.getByRole("button", { name: "Submit" }).click()
r.pastedSubmission = JSON.parse(
  await page.locator("pre code").innerText(),
) as Record<string, unknown>

await page.getByLabel("Form definition JSON").fill("{ broken")
await page.getByRole("button", { name: "Render this form" }).click()
r.parseError = await page.getByRole("alert").innerText()
r.formUnchanged = await page
  .getByRole("heading", { name: "Pasted form" })
  .count()

console.log(JSON.stringify(r, null, 2))
console.log("errors:", errors.length ? errors : "none")
await browser.close()

report(
  "RENDERER",
  r.loadedFromBuilder &&
    r.fieldsRendered === 2 &&
    /2 answers to fix/.test(r.alert) &&
    r.requiredError === 2 &&
    r.emailError === 2 &&
    r.submitted.nickname === "Ada" &&
    r.submitted.contactEmail === "ada@example.com" &&
    r.pastedGroup === 1 &&
    r.pastedSubmission.colour === "blue" &&
    /not valid JSON/.test(r.parseError) &&
    r.formUnchanged === 1 &&
    errors.length === 0,
)
