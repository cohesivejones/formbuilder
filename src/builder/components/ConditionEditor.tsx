import { useState } from "react"
import type { Condition } from "../conditions/model"
import type { FormField } from "../model/types"
import { isBuilderEditable } from "../conditions/model"
import { ConditionBuilder } from "./ConditionBuilder"
import { ConditionInput } from "./ConditionInput"
import { cx } from "./cx"
import styles from "./ConditionEditor.module.css"

interface ConditionEditorProps {
  label: string
  help: string
  field: FormField
  fields: FormField[]
  value: Condition | undefined
  disabled: boolean
  onChange: (condition: Condition | null) => void
}

/**
 * One rule, two surfaces over the same stored tree: the expression for speed,
 * rule rows for structure. Rows make grouping explicit and pick everything
 * from what exists, so the typed language's precedence and typo hazards cannot
 * arise there; the expression view remains the fast path and the only one able
 * to edit a `not`.
 */
export function ConditionEditor({
  label,
  help,
  field,
  fields,
  value,
  disabled,
  onChange,
}: ConditionEditorProps) {
  const [mode, setMode] = useState<"expression" | "rules">("expression")
  const rowsCanEdit = !value || isBuilderEditable(value)
  const activeMode = mode === "rules" && rowsCanEdit ? "rules" : "expression"

  const toggle = (
    <span className={styles.toggle} role="group" aria-label={`${label} view`}>
      <button
        type="button"
        className={cx(
          styles.mode,
          activeMode === "expression" && styles.modeActive,
        )}
        aria-pressed={activeMode === "expression"}
        onClick={() => setMode("expression")}
      >
        Expression
      </button>
      <button
        type="button"
        className={cx(styles.mode, activeMode === "rules" && styles.modeActive)}
        aria-pressed={activeMode === "rules"}
        disabled={!rowsCanEdit}
        title={
          rowsCanEdit
            ? undefined
            : 'This rule uses "not", which only the expression view can edit.'
        }
        onClick={() => setMode("rules")}
      >
        Rules
      </button>
    </span>
  )

  if (activeMode === "rules") {
    return (
      <div className={styles.editor} role="group" aria-label={label}>
        <div className={styles.labelLine}>
          <span className={styles.label}>{label}</span>
          {toggle}
        </div>
        <ConditionBuilder
          field={field}
          fields={fields}
          value={value}
          disabled={disabled}
          onChange={onChange}
        />
        <p className={styles.help}>{help}</p>
      </div>
    )
  }

  return (
    <ConditionInput
      label={label}
      labelExtra={toggle}
      help={help}
      field={field}
      fields={fields}
      value={value}
      disabled={disabled}
      onChange={onChange}
    />
  )
}
