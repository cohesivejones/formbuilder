/**
 * Chromium comes from the Playwright installed in the sibling feedback repo,
 * so this project carries no browser dependency of its own. Point
 * PLAYWRIGHT_DIR somewhere else if yours lives elsewhere.
 */
const dir =
  process.env.PLAYWRIGHT_DIR ??
  "/Users/nathanjones/workspace/feedback/node_modules/playwright"

const playwright = await import(`${dir}/index.mjs`)

export const chromium = playwright.chromium
