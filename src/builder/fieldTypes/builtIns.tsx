import { Icon } from "../components/Icon"
import { cx } from "../components/cx"
import { defineFieldType, type FieldTypeDefinition } from "../model/fieldType"
import { newId } from "../model/keys"
import type { FieldOption } from "../model/types"
import {
  defined,
  isValidRegex,
  nonEmpty,
  oneOfOptions,
  validPattern,
} from "../schema/helpers"
import { ChoiceListPreview } from "./ChoiceListPreview"
import styles from "./previews.module.css"

/**
 * The standard field types. Each is a self-contained definition: defaults,
 * inspector settings, preview, JSON Schema mapping and validation. Hosts can
 * use them all, a subset, or mix them with their own (see examples/).
 */

type TextProps = {
  placeholder: string
  minLength?: number
  maxLength?: number
  pattern?: string
}
type EmailProps = { placeholder: string }
type NumberProps = {
  placeholder: string
  min?: number
  max?: number
  step?: number
  integer: boolean
}
type TextareaProps = { placeholder: string; rows?: number; maxLength?: number }
type CheckboxProps = { defaultChecked: boolean }
type ChoiceProps = { options: FieldOption[] }
type CheckboxGroupProps = ChoiceProps & {
  minSelected?: number
  maxSelected?: number
}
type SelectProps = ChoiceProps & { placeholder: string }
type DateProps = Record<string, never>

export function defaultOptions(count = 3): FieldOption[] {
  return Array.from({ length: count }, (_, i) => ({
    id: newId("o"),
    label: `Option ${i + 1}`,
    value: `option${i + 1}`,
  }))
}

const inputClass = cx("control", styles.input)

function rangeIssue(
  min: number | undefined,
  max: number | undefined,
  message: string,
): string[] {
  return min !== undefined && max !== undefined && min > max ? [message] : []
}

const placeholderSpec = {
  kind: "text",
  name: "placeholder",
  label: "Placeholder",
  section: "Display",
} as const

export const text = defineFieldType<TextProps>({
  type: "text",
  label: "Text",
  description: "Single line of text",
  icon: <Icon name="text" />,
  defaults: { placeholder: "" },
  properties: [
    placeholderSpec,
    {
      kind: "number",
      name: "minLength",
      label: "Min length",
      min: 0,
      section: "Validation",
    },
    {
      kind: "number",
      name: "maxLength",
      label: "Max length",
      min: 0,
      section: "Validation",
    },
    {
      kind: "text",
      name: "pattern",
      label: "Pattern (regular expression)",
      placeholder: "^[A-Z]{3}[0-9]{4}$",
      mono: true,
      section: "Validation",
    },
  ],
  toJsonSchema: ({ props }) => ({
    type: "string",
    ...defined("minLength", props.minLength),
    ...defined("maxLength", props.maxLength),
    ...validPattern(props.pattern),
  }),
  toUiSchema: ({ props }) => nonEmpty("ui:placeholder", props.placeholder),
  validate: ({ props }) => [
    ...(isValidRegex(props.pattern)
      ? []
      : ["Pattern is not a valid regular expression"]),
    ...rangeIssue(
      props.minLength,
      props.maxLength,
      "Minimum length is greater than maximum length",
    ),
  ],
  Preview: ({ field }) => (
    <input
      className={inputClass}
      type="text"
      placeholder={field.props.placeholder || "Short answer"}
      disabled
    />
  ),
})

export const textarea = defineFieldType<TextareaProps>({
  type: "textarea",
  label: "Text area",
  description: "Multi-line text",
  icon: <Icon name="textarea" />,
  defaults: { placeholder: "", rows: 4 },
  properties: [
    placeholderSpec,
    { kind: "number", name: "rows", label: "Rows", min: 1, section: "Display" },
    {
      kind: "number",
      name: "maxLength",
      label: "Max length",
      min: 0,
      section: "Validation",
    },
  ],
  toJsonSchema: ({ props }) => ({
    type: "string",
    ...defined("maxLength", props.maxLength),
  }),
  toUiSchema: ({ props }) => ({
    "ui:widget": "textarea",
    ...nonEmpty("ui:placeholder", props.placeholder),
    "ui:options": { rows: props.rows ?? 4 },
  }),
  Preview: ({ field }) => (
    <textarea
      className={inputClass}
      rows={field.props.rows ?? 4}
      placeholder={field.props.placeholder || "Long answer"}
      disabled
    />
  ),
})

export const email = defineFieldType<EmailProps>({
  type: "email",
  label: "Email",
  description: "Email address",
  icon: <Icon name="email" />,
  defaults: { placeholder: "" },
  properties: [placeholderSpec],
  toJsonSchema: () => ({ type: "string", format: "email" }),
  toUiSchema: ({ props }) => nonEmpty("ui:placeholder", props.placeholder),
  Preview: ({ field }) => (
    <input
      className={inputClass}
      type="email"
      placeholder={field.props.placeholder || "name@example.com"}
      disabled
    />
  ),
})

export const number = defineFieldType<NumberProps>({
  type: "number",
  label: "Number",
  description: "Numeric value",
  icon: <Icon name="number" />,
  defaults: { placeholder: "", integer: false },
  properties: [
    placeholderSpec,
    { kind: "number", name: "min", label: "Minimum", section: "Validation" },
    { kind: "number", name: "max", label: "Maximum", section: "Validation" },
    {
      kind: "number",
      name: "step",
      label: "Step",
      min: 0,
      step: "any",
      section: "Validation",
    },
    {
      kind: "boolean",
      name: "integer",
      label: "Whole numbers only",
      section: "Validation",
    },
  ],
  toJsonSchema: ({ props }) => ({
    type: props.integer ? "integer" : "number",
    ...defined("minimum", props.min),
    ...defined("maximum", props.max),
    ...(props.step !== undefined && props.step > 0
      ? { multipleOf: props.step }
      : {}),
  }),
  toUiSchema: ({ props }) => nonEmpty("ui:placeholder", props.placeholder),
  validate: ({ props }) =>
    rangeIssue(props.min, props.max, "Minimum is greater than maximum"),
  Preview: ({ field }) => (
    <input
      className={cx(inputClass, styles.narrow)}
      type="number"
      placeholder={field.props.placeholder || "0"}
      disabled
    />
  ),
})

export const date = defineFieldType<DateProps>({
  type: "date",
  label: "Date",
  description: "Calendar date",
  icon: <Icon name="date" />,
  defaults: {},
  toJsonSchema: () => ({ type: "string", format: "date" }),
  Preview: () => (
    <input className={cx(inputClass, styles.narrow)} type="date" disabled />
  ),
})

export const checkbox = defineFieldType<CheckboxProps>({
  type: "checkbox",
  label: "Checkbox",
  description: "Single yes/no",
  icon: <Icon name="checkbox" />,
  defaults: { defaultChecked: false },
  properties: [
    {
      kind: "boolean",
      name: "defaultChecked",
      label: "Checked by default",
      section: "Default",
    },
  ],
  toJsonSchema: ({ props }) => ({
    type: "boolean",
    ...(props.defaultChecked ? { default: true } : {}),
  }),
  Preview: ({ field }) => (
    <label className={styles.choice}>
      <input
        type="checkbox"
        checked={field.props.defaultChecked}
        disabled
        readOnly
      />
      <span>{field.label || "Checkbox"}</span>
    </label>
  ),
})

const optionsSpec = {
  kind: "options",
  name: "options",
  label: "Options",
  section: "Options",
} as const

export const checkboxGroup = defineFieldType<CheckboxGroupProps>({
  type: "checkboxGroup",
  label: "Checkbox group",
  description: "Choose many",
  icon: <Icon name="checkboxGroup" />,
  defaults: () => ({ options: defaultOptions() }),
  properties: [
    optionsSpec,
    {
      kind: "number",
      name: "minSelected",
      label: "Min selected",
      min: 0,
      section: "Validation",
    },
    {
      kind: "number",
      name: "maxSelected",
      label: "Max selected",
      min: 1,
      section: "Validation",
    },
  ],
  toJsonSchema: ({ props, required }) => ({
    type: "array",
    items: { type: "string", ...oneOfOptions(props.options) },
    uniqueItems: true,
    ...defined("minItems", props.minSelected ?? (required ? 1 : undefined)),
    ...defined("maxItems", props.maxSelected),
  }),
  toUiSchema: () => ({ "ui:widget": "checkboxes" }),
  validate: ({ props }) =>
    rangeIssue(
      props.minSelected,
      props.maxSelected,
      "Minimum selected is greater than maximum selected",
    ),
  Preview: ({ field }) => (
    <ChoiceListPreview options={field.props.options ?? []} kind="checkbox" />
  ),
})

export const radio = defineFieldType<ChoiceProps>({
  type: "radio",
  label: "Radio group",
  description: "Choose one",
  icon: <Icon name="radio" />,
  defaults: () => ({ options: defaultOptions() }),
  properties: [optionsSpec],
  toJsonSchema: ({ props }) => ({
    type: "string",
    ...oneOfOptions(props.options),
  }),
  toUiSchema: () => ({ "ui:widget": "radio" }),
  Preview: ({ field }) => (
    <ChoiceListPreview options={field.props.options ?? []} kind="radio" />
  ),
})

export const select = defineFieldType<SelectProps>({
  type: "select",
  label: "Dropdown",
  description: "Choose one from a list",
  icon: <Icon name="select" />,
  defaults: () => ({ options: defaultOptions(), placeholder: "" }),
  properties: [placeholderSpec, optionsSpec],
  toJsonSchema: ({ props }) => ({
    type: "string",
    ...oneOfOptions(props.options),
  }),
  toUiSchema: ({ props }) => nonEmpty("ui:placeholder", props.placeholder),
  Preview: ({ field }) => (
    <select className={inputClass} disabled defaultValue="">
      <option value="">{field.props.placeholder || "Select an option"}</option>
      {(field.props.options ?? []).map((option) => (
        <option key={option.id} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
})

/** All built-in types, in palette order. */
export const builtInFieldTypes: readonly FieldTypeDefinition[] = [
  text,
  textarea,
  email,
  number,
  date,
  checkbox,
  checkboxGroup,
  radio,
  select,
]
