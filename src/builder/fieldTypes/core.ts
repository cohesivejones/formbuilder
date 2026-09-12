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

/**
 * The pure half of every built-in field type: defaults, inspector property
 * specs, schema mapping and validation — everything a server needs to generate
 * a form's JSON Schema, validate a definition on write, or process a
 * submission, with no React, CSS or DOM anywhere in the import graph.
 *
 * builtIns.tsx layers the browser half (icon, preview, input) over these; the
 * two must never diverge, which the core-parity test pins down.
 */

export type TextProps = {
  placeholder: string
  minLength?: number
  maxLength?: number
  pattern?: string
}
export type EmailProps = { placeholder: string }
export type NumberProps = {
  placeholder: string
  min?: number
  max?: number
  step?: number
  integer: boolean
}
export type TextareaProps = {
  placeholder: string
  rows?: number
  maxLength?: number
}
export type CheckboxProps = { defaultChecked: boolean }
export type ChoiceProps = { options: FieldOption[] }
export type CheckboxGroupProps = ChoiceProps & {
  minSelected?: number
  maxSelected?: number
}
export type SelectProps = ChoiceProps & { placeholder: string }
export type DateProps = Record<string, never>

export function defaultOptions(count = 3): FieldOption[] {
  return Array.from({ length: count }, (_, i) => ({
    id: newId("o"),
    label: `Option ${i + 1}`,
    value: `option${i + 1}`,
  }))
}

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

const optionsSpec = {
  kind: "options",
  name: "options",
  label: "Options",
  section: "Options",
} as const

export const textCore: FieldTypeDefinition<TextProps> = {
  type: "text",
  label: "Text",
  description: "Single line of text",
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
}

export const textareaCore: FieldTypeDefinition<TextareaProps> = {
  type: "textarea",
  label: "Text area",
  description: "Multi-line text",
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
}

export const emailCore: FieldTypeDefinition<EmailProps> = {
  type: "email",
  label: "Email",
  description: "Email address",
  defaults: { placeholder: "" },
  properties: [placeholderSpec],
  toJsonSchema: () => ({ type: "string", format: "email" }),
  toUiSchema: ({ props }) => nonEmpty("ui:placeholder", props.placeholder),
}

export const numberCore: FieldTypeDefinition<NumberProps> = {
  type: "number",
  label: "Number",
  description: "Numeric value",
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
}

export const dateCore: FieldTypeDefinition<DateProps> = {
  type: "date",
  label: "Date",
  description: "Calendar date",
  defaults: {},
  toJsonSchema: () => ({ type: "string", format: "date" }),
}

export const checkboxCore: FieldTypeDefinition<CheckboxProps> = {
  type: "checkbox",
  label: "Checkbox",
  description: "Single yes/no",
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
  initialValue: ({ props }) => props.defaultChecked === true || undefined,
}

export const checkboxGroupCore: FieldTypeDefinition<CheckboxGroupProps> = {
  type: "checkboxGroup",
  label: "Checkbox group",
  description: "Choose many",
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
}

export const radioCore: FieldTypeDefinition<ChoiceProps> = {
  type: "radio",
  label: "Radio group",
  description: "Choose one",
  defaults: () => ({ options: defaultOptions() }),
  properties: [optionsSpec],
  toJsonSchema: ({ props }) => ({
    type: "string",
    ...oneOfOptions(props.options),
  }),
  toUiSchema: () => ({ "ui:widget": "radio" }),
}

export const selectCore: FieldTypeDefinition<SelectProps> = {
  type: "select",
  label: "Dropdown",
  description: "Choose one from a list",
  defaults: () => ({ options: defaultOptions(), placeholder: "" }),
  properties: [placeholderSpec, optionsSpec],
  toJsonSchema: ({ props }) => ({
    type: "string",
    ...oneOfOptions(props.options),
  }),
  toUiSchema: ({ props }) => nonEmpty("ui:placeholder", props.placeholder),
}

/**
 * The built-in types without their browser layer, in the same palette order as
 * `builtInFieldTypes`. This is the registry a server uses: schema generation,
 * definition validation and submission processing all behave identically to
 * the browser's, because the browser definitions are these plus rendering.
 */
export const coreFieldTypes: readonly FieldTypeDefinition[] = [
  defineFieldType(textCore),
  defineFieldType(textareaCore),
  defineFieldType(emailCore),
  defineFieldType(numberCore),
  defineFieldType(dateCore),
  defineFieldType(checkboxCore),
  defineFieldType(checkboxGroupCore),
  defineFieldType(radioCore),
  defineFieldType(selectCore),
]
