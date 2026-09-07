import { createContext, useContext } from "react"
import type { FieldTypeRegistry } from "../model/registry"

export const FieldTypesContext = createContext<FieldTypeRegistry | null>(null)

/** The registry of the enclosing Builder. */
export function useFieldTypes(): FieldTypeRegistry {
  const registry = useContext(FieldTypesContext)
  if (!registry) {
    throw new Error("useFieldTypes must be used inside a Builder")
  }
  return registry
}
