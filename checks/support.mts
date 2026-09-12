import type { Locator, Page } from "playwright"

/** Where screenshots and PDFs land; the runner passes checks/output. */
export const OUT =
  process.argv[2] ?? new URL("./output", import.meta.url).pathname

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

/** A bounding box that must exist: pointer maths cannot proceed without one. */
export async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox()
  if (!box) throw new Error(`No bounding box for ${String(locator)}`)
  return box
}

/** Collects page and console errors; a passing check requires none. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`))
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`)
  })
  return errors
}

export function report(name: string, ok: boolean): never {
  console.log(ok ? `${name} CHECK PASSED` : `${name} CHECK FAILED`)
  process.exit(ok ? 0 : 1)
}
