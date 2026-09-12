/**
 * Runs every browser check against a dev server it starts itself.
 *
 *   npm run check:browser          all checks
 *   npm run check:browser -- dnd   just one
 *
 * Screenshots and PDFs land in checks/output (gitignored), one artifact set
 * per run, so a failure can be diagnosed by eye.
 */
import { spawn, spawnSync } from "node:child_process"
import { mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, "output")
mkdirSync(outDir, { recursive: true })

const ALL = [
  "dnd",
  "slot",
  "routes",
  "renderer",
  "pdf",
  "paper",
  "conditions",
  "playground",
]
const requested = process.argv.slice(2)
const checks = requested.length > 0 ? requested : ALL

const vite = spawn("npx", ["vite", "--port", "5199", "--strictPort"], {
  cwd: join(here, ".."),
  stdio: "ignore",
})

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch("http://localhost:5199/")
      if (response.ok) return
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error("The dev server never answered on port 5199")
}

let failures = 0
try {
  await waitForServer()
  for (const name of checks) {
    const script = join(here, `${name}-check.mjs`)
    const result = spawnSync("node", [script, outDir], { stdio: "inherit" })
    const passed = result.status === 0
    if (!passed) failures += 1
    console.log(`${passed ? "PASS" : "FAIL"}  ${name}`)
  }
} finally {
  vite.kill()
}

console.log(
  failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`,
)
process.exit(failures === 0 ? 0 : 1)
