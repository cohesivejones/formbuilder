import { useMemo, type ReactNode } from "react"
import type { ResolvedPermissions } from "../model/permissions"
import type { FieldTypeRegistry } from "../model/registry"
import { BuilderContext } from "./builderContext"

export function BuilderProvider({
  registry,
  permissions,
  children,
}: {
  registry: FieldTypeRegistry
  permissions: ResolvedPermissions
  children: ReactNode
}) {
  const value = useMemo(
    () => ({ registry, permissions }),
    [registry, permissions],
  )
  return (
    <BuilderContext.Provider value={value}>{children}</BuilderContext.Provider>
  )
}
