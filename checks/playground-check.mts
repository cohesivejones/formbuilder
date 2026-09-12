import { chromium } from "playwright"
import { OUT, report, watchErrors } from "./support.mts"

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = watchErrors(page)

const r = {
  seedVerdict: "",
  ungroupedVerdict: "",
  groupedVerdict: "",
  groupedExpression: "",
  typedTree: {} as Record<string, unknown>,
  typedVerdictAbsent: "",
  typedVerdictPresent: "",
  semanticError: -1,
}

await page.goto("http://localhost:5199/playground")
await page.getByLabel("Expression").waitFor()
r.seedVerdict = await page.getByTestId("playground-verdict").innerText()
await page.screenshot({ path: `${OUT}/play-01-seed.png` })

// The precedence pair: same clauses, different grouping, different verdicts.
await page
  .getByLabel("Sample answers JSON")
  .fill('{ "finalComments": "urgent please" }')
r.ungroupedVerdict = await page.getByTestId("playground-verdict").innerText()
await page
  .getByRole("button", {
    name: "services contains 'other' and (contactMethod = 'phone' or finalComments contains 'urgent')",
  })
  .click()
r.groupedVerdict = await page.getByTestId("playground-verdict").innerText()
r.groupedExpression = await page.getByLabel("Expression").inputValue()

// Typing with autocomplete and semantic checking, same as the inspector.
const input = page.getByLabel("Expression")
await input.fill("")
await input.pressSequentially("house")
await page.getByRole("option", { name: "householdSize" }).click()
await input.pressSequentially(" >= 2")
r.typedTree = JSON.parse(
  await page.getByTestId("playground-tree").innerText(),
) as Record<string, unknown>
// The answers were replaced above and hold no householdSize, so no match —
// until the answers say otherwise.
r.typedVerdictAbsent = await page.getByTestId("playground-verdict").innerText()
await page.getByLabel("Sample answers JSON").fill('{ "householdSize": 3 }')
r.typedVerdictPresent = await page.getByTestId("playground-verdict").innerText()

await input.fill("contactMethod = 'phome'")
r.semanticError = await page
  .getByText(/contactMethod has no option 'phome'/)
  .count()
await page.screenshot({ path: `${OUT}/play-02-typed.png` })

console.log(JSON.stringify(r, null, 2))
console.log("errors:", errors.length ? errors : "none")
await browser.close()

report(
  "PLAYGROUND",
  /^Matches/.test(r.seedVerdict) &&
    /^Matches/.test(r.ungroupedVerdict) &&
    /^No match/.test(r.groupedVerdict) &&
    r.groupedExpression.includes("(contactMethod = 'phone'") &&
    JSON.stringify(r.typedTree) ===
      JSON.stringify({ op: "gte", field: "householdSize", value: 2 }) &&
    /^No match/.test(r.typedVerdictAbsent) &&
    /^Matches/.test(r.typedVerdictPresent) &&
    r.semanticError === 1 &&
    errors.length === 0,
)
