import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

/**
 * The guarantee behind "the same validation runs on the backend": everything
 * reachable from src/builder/server.ts must be importable in Node. This walks
 * the static import graph and fails on anything a server cannot load —
 * components, CSS, runtime React, drag-and-drop — so UI cannot leak into the
 * server surface without this test saying so.
 */
describe("server entry point", () => {
  it("reaches no React, CSS, component file or DOM dependency", () => {
    const here = dirname(fileURLToPath(import.meta.url))
    const root = resolve(here, "../src/builder/server.ts")
    const seen = new Set<string>()
    const queue = [root]
    const offences: string[] = []

    while (queue.length > 0) {
      const file = queue.pop()!
      if (seen.has(file)) continue
      seen.add(file)

      if (file.endsWith(".tsx")) {
        offences.push(`${file} is a component file`)
        continue
      }
      if (file.endsWith(".css")) {
        offences.push(`${file} is a stylesheet`)
        continue
      }

      const source = readFileSync(file, "utf8")
      for (const match of source.matchAll(
        /^(import|export)\s[^;]*?from\s+"([^"]+)"/gms,
      )) {
        const statement = match[0]
        const specifier = match[2]
        const typeOnly = /^(import|export)\s+type\b/.test(statement)

        if (!specifier.startsWith(".")) {
          // Bare imports: a type-only React import erases; anything else from
          // the UI world is an offence. Ajv is expected and Node-safe.
          if (!typeOnly && /react|dnd-kit/.test(specifier)) {
            offences.push(`${file} imports ${specifier}`)
          }
          continue
        }
        if (typeOnly) continue

        const base = resolve(dirname(file), specifier)
        const target = [
          `${base}.ts`,
          `${base}.tsx`,
          `${base}/index.ts`,
          base,
        ].find(existsSync)
        // A missing target throws on read, failing the test loudly.
        queue.push(target ?? `${base}.ts`)
      }
    }

    expect(offences).toEqual([])
    // The walk actually covered the surface rather than short-circuiting.
    expect(seen.size).toBeGreaterThan(10)
  })
})
