import type { ReactNode } from "react"
import type { FieldTypeRegistry } from "../model/registry"
import { FieldTypesContext } from "./fieldTypesContext"

export function FieldTypesProvider({
  registry,
  children,
}: {
  registry: FieldTypeRegistry
  children: ReactNode
}) {
  return (
    <FieldTypesContext.Provider value={registry}>
      {children}
    </FieldTypesContext.Provider>
  )
}
