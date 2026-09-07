/**
 * Core data model for the form builder.
 *
 * Every field has the same shape regardless of type. Type-specific settings live
 * in `props`, whose meaning is defined by the field's `FieldTypeDefinition`
 * (see fieldType.ts). This lets hosts register their own field types without
 * the builder knowing about them.
 */

export type FieldProps = Record<string, unknown>

export interface FieldOption {
  id: string
  label: string
  value: string
}

/**
 * Host-imposed restrictions on a field. Used for fields whose identity anchors
 * downstream data (for example an export mapping keyed on the field key), where
 * an admin may reword the label but must not remove or re-key the field.
 */
export interface FieldLocks {
  /** The field cannot be deleted. */
  remove?: boolean
  /** The key cannot be changed and no longer follows the label. */
  key?: boolean
  /** Type-specific properties cannot be changed. */
  props?: boolean
  /** The required flag cannot be changed. */
  required?: boolean
}

export interface FormField<P extends FieldProps = FieldProps> {
  /** Stable internal id used for drag-and-drop and selection. */
  id: string
  /** Registered field type. */
  type: string
  /**
   * Property name in the generated JSON Schema. Empty for dataless fields
   * (see FieldTypeDefinition.dataless).
   */
  key: string
  /**
   * True while the key is being derived from the label. Set to false once the
   * user edits the key by hand so their choice is preserved.
   */
  autoKey: boolean
  label: string
  description?: string
  required: boolean
  /** Type-specific settings, shaped by the field type's `defaults` and `properties`. */
  props: P
  locks?: FieldLocks
}

export interface FormDefinition {
  title: string
  description: string
  fields: FormField[]
}
