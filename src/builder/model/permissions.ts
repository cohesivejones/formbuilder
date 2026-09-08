import type { FieldLocks, FormField } from "./types"

/**
 * What an admin may do in one Builder instance. Every capability defaults to
 * true, so an unrestricted builder needs no configuration.
 *
 * These are form-wide. Per-field `locks` narrow them further for individual
 * fields; the more restrictive of the two always wins (see `effectiveLocks`).
 */
export interface BuilderPermissions {
  /** Show the palette and allow adding or duplicating fields. */
  addFields?: boolean
  /** Allow deleting fields and clearing the form. */
  removeFields?: boolean
  /** Allow dragging and the move up/down actions. */
  reorderFields?: boolean
  /** Allow editing field labels and help text. */
  editLabels?: boolean
  /** Allow editing the JSON Schema key. */
  editKeys?: boolean
  /** Allow editing type-specific settings. */
  editProps?: boolean
  /** Allow toggling the required flag. */
  editRequired?: boolean
  /** Allow editing the form's own title and description. */
  editFormMeta?: boolean
}

export type ResolvedPermissions = Required<BuilderPermissions>

export const FULL_PERMISSIONS: ResolvedPermissions = {
  addFields: true,
  removeFields: true,
  reorderFields: true,
  editLabels: true,
  editKeys: true,
  editProps: true,
  editRequired: true,
  editFormMeta: true,
}

export function resolvePermissions(
  permissions: BuilderPermissions | undefined,
): ResolvedPermissions {
  return { ...FULL_PERMISSIONS, ...permissions }
}

/** Every lock, resolved to a definite boolean. */
export type ResolvedLocks = Required<FieldLocks>

/**
 * Combines the form-wide permissions with a field's own locks. A capability is
 * locked when either side says so, so a host can grant deletion generally and
 * still protect one field, but cannot unlock a field the permissions forbid.
 */
export function effectiveLocks(
  field: FormField,
  permissions: ResolvedPermissions,
): ResolvedLocks {
  const locks = field.locks ?? {}
  return {
    label: locks.label === true || !permissions.editLabels,
    key: locks.key === true || !permissions.editKeys,
    props: locks.props === true || !permissions.editProps,
    required: locks.required === true || !permissions.editRequired,
    remove: locks.remove === true || !permissions.removeFields,
    reorder: locks.reorder === true || !permissions.reorderFields,
  }
}

/** True when the host has restricted this field beyond the form-wide policy. */
export function hasFieldLocks(field: FormField): boolean {
  const locks = field.locks
  return Boolean(
    locks &&
    (locks.label ||
      locks.key ||
      locks.props ||
      locks.required ||
      locks.remove ||
      locks.reorder),
  )
}
