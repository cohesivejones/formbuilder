import { builtInFieldTypes } from "../builder/fieldTypes/builtIns"
import { createField } from "../builder/model/fieldType"
import { createRegistry } from "../builder/model/registry"
import type { FormField } from "../builder/model/types"

export const testRegistry = createRegistry(builtInFieldTypes)

type BaseOverrides = Partial<
  Pick<
    FormField,
    "id" | "label" | "description" | "required" | "autoKey" | "locks"
  >
>
const BASE_KEYS = new Set([
  "id",
  "label",
  "description",
  "required",
  "autoKey",
  "locks",
])

/**
 * Builds a built-in field for tests. Generic settings (label, required…) are
 * applied to the field; every other override is a prop.
 */
export function field(
  type: string,
  key: string,
  overrides: BaseOverrides & Record<string, unknown> = {},
): FormField {
  const definition = testRegistry.get(type)
  if (!definition) throw new Error(`Unknown test field type ${type}`)
  const base = createField(definition, key)
  const result: FormField = { ...base, props: { ...base.props } }
  for (const [name, value] of Object.entries(overrides)) {
    if (BASE_KEYS.has(name)) {
      ;(result as unknown as Record<string, unknown>)[name] = value
    } else {
      result.props[name] = value
    }
  }
  return result
}
