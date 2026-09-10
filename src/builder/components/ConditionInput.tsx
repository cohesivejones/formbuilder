import { useId, useState } from "react"
import type { Condition } from "../conditions/model"
import { parseCondition } from "../conditions/parse"
import { printCondition } from "../conditions/print"
import type { FormField } from "../model/types"
import { cx } from "./cx"
import styles from "./ConditionInput.module.css"

interface ConditionInputProps {
  label: string
  help: string
  field: FormField
  /** Every field on the form, for resolving and suggesting keys. */
  fields: FormField[]
  value: Condition | undefined
  disabled: boolean
  /** `null` clears the rule. Called only with parseable input. */
  onChange: (condition: Condition | null) => void
}

/**
 * One rule, edited as an expression. The text is an editing surface only: a
 * valid parse commits the condition tree, an invalid one shows its error and
 * leaves the last committed rule standing, and blur rewrites the box with the
 * pretty-printed form of whatever is stored.
 */
export function ConditionInput({
  label,
  help,
  field,
  fields,
  value,
  disabled,
  onChange,
}: ConditionInputProps) {
  const id = useId()
  const [draft, setDraft] = useState(() =>
    value ? printCondition(value, fields) : "",
  )
  const [error, setError] = useState<string | null>(null)

  const handleChange = (text: string) => {
    setDraft(text)
    const result = parseCondition(text, { fields, selfId: field.id })
    if (result.ok) {
      setError(null)
      onChange(result.condition)
    } else {
      setError(result.error)
    }
  }

  const handleBlur = () => {
    if (!error) setDraft(value ? printCondition(value, fields) : "")
  }

  return (
    <div className={styles.row}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className={cx("control", styles.input)}
        value={draft}
        placeholder="always"
        spellCheck={false}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => handleChange(event.target.value)}
        onBlur={handleBlur}
      />
      {error ? (
        <p id={`${id}-error`} className={styles.error}>
          {error}
        </p>
      ) : (
        <p className={styles.help}>{help}</p>
      )}
    </div>
  )
}
