import { Icon } from "../components/Icon"
import { cx } from "../components/cx"
import { defineFieldType, type FieldTypeDefinition } from "../model/fieldType"
import type { FieldOption } from "../model/types"
import { ChoiceListPreview } from "./ChoiceListPreview"
import {
  checkboxCore,
  checkboxGroupCore,
  dateCore,
  emailCore,
  numberCore,
  radioCore,
  selectCore,
  textCore,
  textareaCore,
  type CheckboxGroupProps,
  type CheckboxProps,
  type ChoiceProps,
  type DateProps,
  type EmailProps,
  type NumberProps,
  type SelectProps,
  type TextProps,
  type TextareaProps,
} from "./core"
import {
  CheckboxGroupInput,
  CheckboxInput,
  DateInput,
  EmailInput,
  NumberInput,
  RadioInput,
  SelectInput,
  TextInput,
  TextareaInput,
} from "./inputs"
import styles from "./previews.module.css"

export { defaultOptions } from "./core"

/**
 * The built-in field types as the browser sees them: each is its pure core
 * (see core.ts) plus an icon, a canvas preview and a respondent-facing input.
 * Everything a server relies on — defaults, property specs, schema mapping,
 * validation — comes from the core by spread, so the two registries cannot
 * drift apart.
 */

const inputClass = cx("control", styles.input)

export const text = defineFieldType<TextProps>({
  ...textCore,
  icon: <Icon name="text" />,
  Preview: ({ field }) => (
    <input
      className={inputClass}
      type="text"
      placeholder={field.props.placeholder || "Short answer"}
      disabled
    />
  ),
  Input: TextInput,
})

export const textarea = defineFieldType<TextareaProps>({
  ...textareaCore,
  icon: <Icon name="textarea" />,
  Preview: ({ field }) => (
    <textarea
      className={inputClass}
      rows={field.props.rows ?? 4}
      placeholder={field.props.placeholder || "Long answer"}
      disabled
    />
  ),
  Input: TextareaInput,
})

export const email = defineFieldType<EmailProps>({
  ...emailCore,
  icon: <Icon name="email" />,
  Preview: ({ field }) => (
    <input
      className={inputClass}
      type="email"
      placeholder={field.props.placeholder || "name@example.com"}
      disabled
    />
  ),
  Input: EmailInput,
})

export const number = defineFieldType<NumberProps>({
  ...numberCore,
  icon: <Icon name="number" />,
  Preview: ({ field }) => (
    <input
      className={cx(inputClass, styles.narrow)}
      type="number"
      placeholder={field.props.placeholder || "0"}
      disabled
    />
  ),
  Input: NumberInput,
})

export const date = defineFieldType<DateProps>({
  ...dateCore,
  icon: <Icon name="date" />,
  Preview: () => (
    <input className={cx(inputClass, styles.narrow)} type="date" disabled />
  ),
  Input: DateInput,
})

export const checkbox = defineFieldType<CheckboxProps>({
  ...checkboxCore,
  icon: <Icon name="checkbox" />,
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
  Input: CheckboxInput,
  labelMode: "inline",
})

export const checkboxGroup = defineFieldType<CheckboxGroupProps>({
  ...checkboxGroupCore,
  icon: <Icon name="checkboxGroup" />,
  Preview: ({ field }) => (
    <ChoiceListPreview options={field.props.options ?? []} kind="checkbox" />
  ),
  Input: CheckboxGroupInput,
  labelMode: "group",
})

export const radio = defineFieldType<ChoiceProps>({
  ...radioCore,
  icon: <Icon name="radio" />,
  Preview: ({ field }) => (
    <ChoiceListPreview options={field.props.options ?? []} kind="radio" />
  ),
  Input: RadioInput,
  labelMode: "group",
})

export const select = defineFieldType<SelectProps>({
  ...selectCore,
  icon: <Icon name="select" />,
  Preview: ({ field }) => (
    <select className={inputClass} disabled defaultValue="">
      <option value="">{field.props.placeholder || "Select an option"}</option>
      {((field.props.options ?? []) as FieldOption[]).map((option) => (
        <option key={option.id} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
  Input: SelectInput,
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
