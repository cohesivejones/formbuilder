import type { FieldInputProps } from "../model/fieldType"
import type { FieldOption } from "../model/types"
import { cx } from "../components/cx"
import styles from "./inputs.module.css"

/**
 * The interactive controls the renderer shows to a respondent. Each one renders
 * only the control: the renderer supplies the label, help text and error, and
 * passes the `id` and `describedBy` that tie them together.
 */

function asString(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function options(field: { props: { options?: unknown } }): FieldOption[] {
  return Array.isArray(field.props.options)
    ? (field.props.options as FieldOption[])
    : []
}

/** Shared props for a plain single control. */
function controlProps({ id, describedBy, invalid }: FieldInputProps) {
  return {
    id,
    className: cx("control", invalid && styles.invalid),
    "aria-describedby": describedBy,
    "aria-invalid": invalid || undefined,
  }
}

export function TextInput(props: FieldInputProps) {
  const { field, value, onChange } = props
  return (
    <input
      {...controlProps(props)}
      type="text"
      value={asString(value)}
      placeholder={asString(field.props.placeholder)}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

export function EmailInput(props: FieldInputProps) {
  const { field, value, onChange } = props
  return (
    <input
      {...controlProps(props)}
      type="email"
      value={asString(value)}
      placeholder={asString(field.props.placeholder)}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

export function TextareaInput(props: FieldInputProps) {
  const { field, value, onChange } = props
  const rows = typeof field.props.rows === "number" ? field.props.rows : 4
  return (
    <textarea
      {...controlProps(props)}
      rows={rows}
      value={asString(value)}
      placeholder={asString(field.props.placeholder)}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

export function NumberInput(props: FieldInputProps) {
  const { field, value, onChange } = props
  return (
    <input
      {...controlProps(props)}
      className={cx("control", styles.narrow, props.invalid && styles.invalid)}
      type="number"
      inputMode="decimal"
      value={typeof value === "number" ? value : ""}
      placeholder={asString(field.props.placeholder)}
      step={field.props.integer === true ? 1 : undefined}
      onChange={(event) => {
        // An empty box means "no answer", not zero.
        const raw = event.target.value
        if (raw.trim() === "") return onChange(undefined)
        const parsed = Number(raw)
        onChange(Number.isFinite(parsed) ? parsed : raw)
      }}
    />
  )
}

export function DateInput(props: FieldInputProps) {
  const { value, onChange } = props
  return (
    <input
      {...controlProps(props)}
      className={cx("control", styles.narrow, props.invalid && styles.invalid)}
      type="date"
      value={asString(value)}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

export function SelectInput(props: FieldInputProps) {
  const { field, value, onChange } = props
  return (
    <select
      {...controlProps(props)}
      value={asString(value)}
      onChange={(event) => onChange(event.target.value || undefined)}
    >
      <option value="">
        {asString(field.props.placeholder) || "Select an option"}
      </option>
      {options(field).map((option) => (
        <option key={option.id} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

export function CheckboxInput(props: FieldInputProps) {
  const { value, onChange, id, describedBy } = props
  return (
    <input
      id={id}
      type="checkbox"
      className={styles.check}
      checked={value === true}
      aria-describedby={describedBy}
      aria-invalid={props.invalid || undefined}
      onChange={(event) => onChange(event.target.checked)}
    />
  )
}

export function RadioInput(props: FieldInputProps) {
  const { field, value, onChange, id } = props
  const list = options(field)
  if (list.length === 0) return <p className={styles.empty}>No options</p>
  return (
    <div className={styles.choices}>
      {list.map((option) => (
        <label key={option.id} className={styles.choice}>
          <input
            type="radio"
            name={id}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          <span>{option.label || option.value}</span>
        </label>
      ))}
    </div>
  )
}

export function CheckboxGroupInput(props: FieldInputProps) {
  const { field, value, onChange } = props
  const list = options(field)
  if (list.length === 0) return <p className={styles.empty}>No options</p>
  const selected = Array.isArray(value) ? (value as string[]) : []

  const toggle = (optionValue: string, checked: boolean) => {
    // Keep the answer in the order the options are declared, so the submitted
    // array reads the same way the form does.
    const next = list
      .map((o) => o.value)
      .filter((v) => (v === optionValue ? checked : selected.includes(v)))
    onChange(next)
  }

  return (
    <div className={styles.choices}>
      {list.map((option) => (
        <label key={option.id} className={styles.choice}>
          <input
            type="checkbox"
            value={option.value}
            checked={selected.includes(option.value)}
            onChange={(event) => toggle(option.value, event.target.checked)}
          />
          <span>{option.label || option.value}</span>
        </label>
      ))}
    </div>
  )
}
