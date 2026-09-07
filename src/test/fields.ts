import { createField } from "../builder/model/fieldRegistry"
import type { FieldOfType, FieldType } from "../builder/model/types"

/** Builds a field of a concrete type with overrides, for tests. */
export function field<T extends FieldType>(
  type: T,
  key: string,
  overrides: Partial<FieldOfType<T>> = {},
): FieldOfType<T> {
  return { ...(createField(type, key) as FieldOfType<T>), ...overrides }
}
