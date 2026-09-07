import type { ComponentType, ReactNode } from "react"
import type { JsonSchema, UiFieldSchema } from "../schema/jsonSchemaTypes"
import { newId } from "./keys"
import type { FieldProps, FormField } from "./types"

/** The generic field settings the inspector can show. */
export type BaseProperty = "label" | "description" | "required"

interface PropertySpecBase {
  /** Key in `field.props`. */
  name: string
  label: string
  help?: string
  /** Inspector section heading. Specs sharing a section are grouped. */
  section?: string
}

/**
 * A declarative description of one type-specific setting. The inspector renders
 * a matching control, so most field types need no custom editor component.
 */
export type PropertySpec =
  | (PropertySpecBase & {
      kind: "text"
      placeholder?: string
      multiline?: boolean
      mono?: boolean
    })
  | (PropertySpecBase & {
      kind: "number"
      min?: number
      max?: number
      step?: number | "any"
    })
  | (PropertySpecBase & { kind: "boolean" })
  | (PropertySpecBase & {
      kind: "select"
      options: { label: string; value: string }[]
    })
  /** A list of label/value pairs edited with the options editor (radio, select…). */
  | (PropertySpecBase & { kind: "options" })

export interface PreviewProps<P extends FieldProps = FieldProps> {
  field: FormField<P>
}

export interface PropertiesEditorProps<P extends FieldProps = FieldProps> {
  field: FormField<P>
  onChange: (props: Partial<P>) => void
  /** True when the field's props are locked by the host. */
  disabled: boolean
}

/**
 * Everything the builder needs to know about one kind of field. Built-in types
 * and host-registered custom types use the same contract.
 *
 * Declare `P` as a type alias rather than an interface so it satisfies the
 * `Record<string, unknown>` constraint.
 */
export interface FieldTypeDefinition<P extends FieldProps = FieldProps> {
  /** Unique id, stored on every field of this type. */
  type: string
  /** Palette and badge label; also the default label of new fields. */
  label: string
  description?: string
  /** Any node: an <Icon>, an emoji, an <img>. Sized by the surrounding text. */
  icon?: ReactNode
  /**
   * A dataless field is presentation or a placeholder the host fills in later.
   * It has no key, cannot be required and emits no JSON Schema property.
   */
  dataless?: boolean
  /** Cap on how many fields of this type a form may contain. */
  maxInstances?: number
  /** Which generic settings the inspector shows. Defaults to all three. */
  baseProperties?: BaseProperty[]
  /** Initial `props` for a new field. Use the function form when values need fresh ids. */
  defaults: P | (() => P)
  /** Type-specific settings, rendered by the inspector in order. */
  properties?: PropertySpec[]
  /**
   * The type-specific part of the field's JSON Schema. The builder adds `title`
   * and `description` itself. Return undefined to emit no property.
   */
  toJsonSchema?: (field: FormField<P>) => JsonSchema | undefined
  toUiSchema?: (field: FormField<P>) => UiFieldSchema | undefined
  /** Read-only rendering of the field on the canvas. */
  Preview?: ComponentType<PreviewProps<P>>
  /** Escape hatch for settings the declarative `properties` cannot express. */
  PropertiesEditor?: ComponentType<PropertiesEditorProps<P>>
  /** Extra validation. Return human-readable problems. */
  validate?: (field: FormField<P>) => string[]
}

/**
 * Type-checks a definition against its props type and widens it for the
 * registry, which stores definitions of every props shape together.
 */
export function defineFieldType<P extends FieldProps>(
  definition: FieldTypeDefinition<P>,
): FieldTypeDefinition {
  return definition as unknown as FieldTypeDefinition
}

/**
 * Creates a new field of the given type. `key` uniqueness is the caller's job
 * (see the reducer); dataless types ignore it.
 */
export function createField(
  definition: FieldTypeDefinition,
  key: string,
): FormField {
  const defaults =
    typeof definition.defaults === "function"
      ? definition.defaults()
      : structuredClone(definition.defaults)

  return {
    id: newId(),
    type: definition.type,
    key: definition.dataless ? "" : key,
    autoKey: !definition.dataless,
    label: definition.label,
    required: false,
    props: defaults,
  }
}

export function baseProperties(
  definition: FieldTypeDefinition,
): Set<BaseProperty> {
  const base = new Set<BaseProperty>(
    definition.baseProperties ?? ["label", "description", "required"],
  )
  if (definition.dataless) base.delete("required")
  return base
}
