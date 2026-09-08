import { createContext, useContext } from "react"
import type { ResolvedPermissions } from "../model/permissions"
import type { FieldTypeRegistry } from "../model/registry"

export interface BuilderContextValue {
  registry: FieldTypeRegistry
  permissions: ResolvedPermissions
}

export const BuilderContext = createContext<BuilderContextValue | null>(null)

/** The registry and permissions of the enclosing Builder. */
export function useBuilderContext(): BuilderContextValue {
  const value = useContext(BuilderContext)
  if (!value) {
    throw new Error("This component must be used inside a Builder")
  }
  return value
}

/** Convenience for components that only need the field types. */
export function useFieldTypes(): FieldTypeRegistry {
  return useBuilderContext().registry
}
