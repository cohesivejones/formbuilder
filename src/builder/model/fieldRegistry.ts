import type { FieldOption, FieldType, FormField } from "./types"
import { newId } from "./keys"

export interface FieldTypeMeta {
  type: FieldType
  label: string
  description: string
  /** Name of a symbol in public/icons.svg. */
  icon: string
}

/** Palette entries, in display order. */
export const FIELD_TYPES: readonly FieldTypeMeta[] = [
  {
    type: "text",
    label: "Text",
    description: "Single line of text",
    icon: "text",
  },
  {
    type: "textarea",
    label: "Text area",
    description: "Multi-line text",
    icon: "textarea",
  },
  {
    type: "email",
    label: "Email",
    description: "Email address",
    icon: "email",
  },
  {
    type: "number",
    label: "Number",
    description: "Numeric value",
    icon: "number",
  },
  {
    type: "date",
    label: "Date",
    description: "Calendar date",
    icon: "date",
  },
  {
    type: "checkbox",
    label: "Checkbox",
    description: "Single yes/no",
    icon: "checkbox",
  },
  {
    type: "checkboxGroup",
    label: "Checkbox group",
    description: "Choose many",
    icon: "checkboxGroup",
  },
  {
    type: "radio",
    label: "Radio group",
    description: "Choose one",
    icon: "radio",
  },
  {
    type: "select",
    label: "Dropdown",
    description: "Choose one from a list",
    icon: "select",
  },
]

export function fieldTypeMeta(type: FieldType): FieldTypeMeta {
  const meta = FIELD_TYPES.find((m) => m.type === type)
  if (!meta) throw new Error(`Unknown field type: ${type}`)
  return meta
}

export function defaultOptions(count = 3): FieldOption[] {
  return Array.from({ length: count }, (_, i) => ({
    id: newId("o"),
    label: `Option ${i + 1}`,
    value: `option${i + 1}`,
  }))
}

/**
 * Creates a new field of the given type with sensible defaults.
 * `key` uniqueness is the caller's responsibility (see reducer).
 */
export function createField(type: FieldType, key: string): FormField {
  const base = {
    id: newId(),
    key,
    autoKey: true,
    label: fieldTypeMeta(type).label,
    required: false,
  }

  switch (type) {
    case "text":
      return { ...base, type, placeholder: "" }
    case "email":
      return { ...base, type, placeholder: "" }
    case "number":
      return { ...base, type, integer: false }
    case "textarea":
      return { ...base, type, rows: 4, placeholder: "" }
    case "checkbox":
      return { ...base, type, defaultChecked: false }
    case "checkboxGroup":
      return { ...base, type, options: defaultOptions() }
    case "radio":
      return { ...base, type, options: defaultOptions() }
    case "select":
      return { ...base, type, options: defaultOptions(), placeholder: "" }
    case "date":
      return { ...base, type }
  }
}
