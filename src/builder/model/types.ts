/**
 * Core data model for the form builder.
 *
 * A `FormDefinition` is the builder's internal representation. It is converted
 * to JSON Schema (plus a UI schema for presentation hints) by `schema/toJsonSchema.ts`.
 */

export type FieldType =
  | "text"
  | "email"
  | "number"
  | "textarea"
  | "checkbox"
  | "checkboxGroup"
  | "radio"
  | "select"
  | "date"

export interface FieldOption {
  id: string
  label: string
  value: string
}

interface BaseField {
  /** Stable internal id used for drag-and-drop and selection. Never exported. */
  id: string
  /** Property name in the generated JSON Schema. Must be unique within the form. */
  key: string
  /**
   * True while the key is being derived from the label. Set to false once the
   * user edits the key by hand so their choice is preserved.
   */
  autoKey: boolean
  label: string
  description?: string
  required: boolean
}

export interface TextField extends BaseField {
  type: "text"
  placeholder?: string
  minLength?: number
  maxLength?: number
  pattern?: string
}

export interface EmailField extends BaseField {
  type: "email"
  placeholder?: string
}

export interface NumberField extends BaseField {
  type: "number"
  placeholder?: string
  min?: number
  max?: number
  step?: number
  integer: boolean
}

export interface TextareaField extends BaseField {
  type: "textarea"
  placeholder?: string
  rows: number
  maxLength?: number
}

export interface CheckboxField extends BaseField {
  type: "checkbox"
  defaultChecked: boolean
}

export interface CheckboxGroupField extends BaseField {
  type: "checkboxGroup"
  options: FieldOption[]
  minSelected?: number
  maxSelected?: number
}

export interface RadioField extends BaseField {
  type: "radio"
  options: FieldOption[]
}

export interface SelectField extends BaseField {
  type: "select"
  options: FieldOption[]
  placeholder?: string
}

export interface DateField extends BaseField {
  type: "date"
}

export type FormField =
  | TextField
  | EmailField
  | NumberField
  | TextareaField
  | CheckboxField
  | CheckboxGroupField
  | RadioField
  | SelectField
  | DateField

export type FieldOfType<T extends FieldType> = Extract<FormField, { type: T }>

export type OptionsField = CheckboxGroupField | RadioField | SelectField

export function hasOptions(field: FormField): field is OptionsField {
  return (
    field.type === "checkboxGroup" ||
    field.type === "radio" ||
    field.type === "select"
  )
}

export interface FormDefinition {
  title: string
  description: string
  fields: FormField[]
}
