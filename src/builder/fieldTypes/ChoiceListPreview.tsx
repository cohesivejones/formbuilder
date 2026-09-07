import type { FieldOption } from "../model/types"
import styles from "./previews.module.css"

/** Read-only list of radio buttons or checkboxes for choice-type previews. */
export function ChoiceListPreview({
  options,
  kind,
}: {
  options: FieldOption[]
  kind: "radio" | "checkbox"
}) {
  return (
    <div className={styles.choices}>
      {options.length === 0 && (
        <span className={styles.empty}>No options yet</span>
      )}
      {options.map((option) => (
        <label key={option.id} className={styles.choice}>
          <input type={kind} disabled />
          <span>{option.label || option.value || "Option"}</span>
        </label>
      ))}
    </div>
  )
}
