import { chromium } from "playwright"
import { OUT, report, watchErrors } from "./support.mts"

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = watchErrors(page)

const r = {
  phoneHiddenAtStart: false,
  phoneGoneAgain: false,
  alert: "",
  submitted: {} as Record<string, unknown>,
  prefilled: "",
  loosenedRuleApplies: false,
  cardRule: -1,
  parseError: "",
  semanticError: "",
  suggestion: "",
  completed: "",
}

// 1. The demo page: fields appear and disappear with the answers.
await page.goto("http://localhost:5199/conditions")
await page.getByRole("heading", { name: "Follow-up preferences" }).waitFor()
const phoneBox = page.getByRole("textbox", { name: /Best phone number/ })
r.phoneHiddenAtStart =
  (await phoneBox.count()) === 0 || !(await phoneBox.isVisible())
await page.getByRole("radio", { name: "Please phone me" }).check()
await phoneBox.waitFor()
await phoneBox.fill("0400 111 222")
await page.getByRole("checkbox", { name: /allergies/ }).check()
await page
  .getByRole("textbox", { name: /Please list your allergies/ })
  .waitFor()
await page.screenshot({ path: `${OUT}/cond-01-revealed.png` })

// 2. Conditional requirement: switch to no follow-up, comments become required.
await page.getByRole("radio", { name: "No follow-up" }).check()
r.phoneGoneAgain = !(await phoneBox.isVisible().catch(() => false))
await page.getByRole("checkbox", { name: /allergies/ }).uncheck()
await page.getByRole("button", { name: "Submit" }).click()
r.alert = await page.getByRole("alert").innerText()
await page.getByRole("textbox", { name: /Anything else/ }).fill("All good")
await page.getByRole("button", { name: "Submit" }).click()
await page.getByTestId("conditions-submission").waitFor()
r.submitted = JSON.parse(
  await page.getByTestId("conditions-submission").innerText(),
) as Record<string, unknown>
await page.screenshot({ path: `${OUT}/cond-02-submitted.png` })

// 3. The hidden questions still reach paper, prefaced by when they apply.
await page.pdf({
  path: `${OUT}/cond-form.pdf`,
  format: "A4",
  printBackground: false,
})

// 4. The edit view: the same definition in the real builder, expression
//    prefilled; loosening the rule changes the try view at once.
await page.getByRole("tab", { name: "Edit the rules" }).click()
await page.getByRole("button", { name: "Edit Best phone number" }).click()
const visibleWhen = page.getByLabel("Visible when")
r.prefilled = await visibleWhen.inputValue()
await visibleWhen.fill("contactMethod != 'none'")
await page.getByRole("tab", { name: "Try the form" }).click()
await page.getByRole("radio", { name: "Please email me" }).check()
r.loosenedRuleApplies = await page
  .getByRole("textbox", { name: /Best phone number/ })
  .isVisible()
await page.screenshot({ path: `${OUT}/cond-04-edit-flow.png` })

// 5. Authoring from scratch on the full builder page.
await page.goto("http://localhost:5199/")
await page.evaluate(() => localStorage.clear())
await page.reload()
await page.getByRole("button", { name: "Add Checkbox field" }).click()
await page.getByLabel("Label", { exact: true }).fill("Show more")
await page.getByRole("button", { name: "Add Text field" }).click()
await page.getByLabel("Visible when").fill("showMore = true")
r.cardRule = await page
  .getByTestId("canvas-field-text")
  .getByText("visible when showMore = true")
  .count()

await page.getByLabel("Visible when").fill("showMoar = true")
r.parseError = await page.getByText(/Unknown field "showMoar"/).innerText()
await page.screenshot({ path: `${OUT}/cond-03-authoring.png` })

// 6. Semantic checking: a value no option matches is refused with the options
//    named, and typing a partial key offers completions.
await page.getByRole("button", { name: "Add Radio group field" }).click()
await page.getByLabel("Label", { exact: true }).fill("Reason")
await page.getByRole("button", { name: "Edit Text" }).click()
const rule = page.getByLabel("Visible when")
await rule.fill("reason = 'phome'")
r.semanticError = await page
  .getByText(/reason has no option 'phome'/)
  .innerText()

await rule.fill("")
await rule.pressSequentially("rea")
r.suggestion = await page.getByRole("option", { name: "reason" }).innerText()
await page.screenshot({ path: `${OUT}/cond-06-autocomplete.png` })
await page.keyboard.press("Enter")
r.completed = await rule.inputValue()

console.log(JSON.stringify(r, null, 2))
console.log("errors:", errors.length ? errors : "none")
await browser.close()

report(
  "CONDITIONS",
  /its options are 'option1', 'option2', 'option3'/.test(r.semanticError) &&
    r.suggestion === "reason" &&
    r.completed === "reason" &&
    r.prefilled === "contactMethod = 'phone'" &&
    r.loosenedRuleApplies &&
    r.phoneHiddenAtStart &&
    r.phoneGoneAgain &&
    /Anything else\?: This field is required/.test(r.alert) &&
    // hasAllergies: false is a real answer (the box was ticked then unticked);
    // what must be absent is the hidden phone number and allergy details.
    JSON.stringify(r.submitted) ===
      JSON.stringify({
        contactMethod: "none",
        hasAllergies: false,
        finalComments: "All good",
      }) &&
    r.cardRule === 1 &&
    /did you mean showMore\?/.test(r.parseError) &&
    errors.length === 0,
)
