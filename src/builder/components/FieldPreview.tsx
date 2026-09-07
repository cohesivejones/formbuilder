import type { FormField } from "../model/types"
import { cx } from "./cx"
import styles from "./FieldPreview.module.css"

/**
 * A non-interactive rendering of what the field will look like to a respondent.
 * Hidden from assistive tech: the card header already names the field.
 */
export function FieldPreview({ field }: { field: FormField }) {
  return (
    <div className={styles.preview} aria-hidden="true">
      <PreviewControl field={field} />
    </div>
  )
}

function PreviewControl({ field }: { field: FormField }) {
  const inputClass = cx("control", styles.input)

  switch (field.type) {
    case "text":
      return (
        <input
          className={inputClass}
          type="text"
          placeholder={field.placeholder || "Short answer"}
          disabled
        />
      )
    case "email":
      return (
        <input
          className={inputClass}
          type="email"
          placeholder={field.placeholder || "name@example.com"}
          disabled
        />
      )
    case "number":
      return (
        <input
          className={cx(inputClass, styles.narrow)}
          type="number"
          placeholder={field.placeholder || "0"}
          disabled
        />
      )
    case "date":
      return (
        <input className={cx(inputClass, styles.narrow)} type="date" disabled />
      )
    case "textarea":
      return (
        <textarea
          className={inputClass}
          rows={field.rows}
          placeholder={field.placeholder || "Long answer"}
          disabled
        />
      )
    case "checkbox":
      return (
        <label className={styles.choice}>
          <input
            type="checkbox"
            checked={field.defaultChecked}
            disabled
            readOnly
          />
          <span>{field.label || "Checkbox"}</span>
        </label>
      )
    case "radio":
    case "checkboxGroup":
      return (
        <div className={styles.choices}>
          {field.options.length === 0 && (
            <span className={styles.empty}>No options yet</span>
          )}
          {field.options.map((option) => (
            <label key={option.id} className={styles.choice}>
              <input
                type={field.type === "radio" ? "radio" : "checkbox"}
                disabled
              />
              <span>{option.label || option.value || "Option"}</span>
            </label>
          ))}
        </div>
      )
    case "select":
      return (
        <select className={inputClass} disabled defaultValue="">
          <option value="">{field.placeholder || "Select an option"}</option>
          {field.options.map((option) => (
            <option key={option.id} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )
  }
}
