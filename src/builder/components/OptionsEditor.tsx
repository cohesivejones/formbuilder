import { arrayMove } from "@dnd-kit/sortable"
import type { FieldOption } from "../model/types"
import { newId, slugifyKey, uniqueKey } from "../model/keys"
import { Icon } from "./Icon"
import styles from "./OptionsEditor.module.css"

interface OptionsEditorProps {
  options: FieldOption[]
  disabled?: boolean
  onChange: (options: FieldOption[]) => void
}

/**
 * Edits the label/value pairs of a choice field. A value follows its label
 * (camelCased) until the user edits the value directly.
 */
export function OptionsEditor({
  options,
  disabled = false,
  onChange,
}: OptionsEditorProps) {
  const updateLabel = (id: string, label: string) => {
    onChange(
      options.map((option) => {
        if (option.id !== id) return option
        const valueWasDerived = option.value === slugifyKey(option.label)
        return {
          ...option,
          label,
          value: valueWasDerived ? slugifyKey(label) : option.value,
        }
      }),
    )
  }

  const updateValue = (id: string, value: string) => {
    onChange(options.map((o) => (o.id === id ? { ...o, value } : o)))
  }

  const add = () => {
    const n = options.length + 1
    onChange([
      ...options,
      {
        id: newId("o"),
        label: `Option ${n}`,
        value: uniqueKey(
          `option${n}`,
          options.map((o) => o.value),
        ),
      },
    ])
  }

  const remove = (id: string) => onChange(options.filter((o) => o.id !== id))

  const move = (from: number, to: number) => {
    if (to < 0 || to >= options.length) return
    onChange(arrayMove(options, from, to))
  }

  return (
    <div className={styles.editor}>
      {options.length > 0 && (
        <div className={styles.headerRow} aria-hidden="true">
          <span>Label</span>
          <span>Value</span>
        </div>
      )}
      <ul className={styles.list}>
        {options.map((option, index) => (
          <li key={option.id} className={styles.row}>
            <input
              className="control"
              value={option.label}
              aria-label={`Option ${index + 1} label`}
              disabled={disabled}
              onChange={(event) => updateLabel(option.id, event.target.value)}
            />
            <input
              className={`control ${styles.valueInput}`}
              value={option.value}
              aria-label={`Option ${index + 1} value`}
              aria-invalid={option.value.trim() === "" || undefined}
              disabled={disabled}
              onChange={(event) => updateValue(option.id, event.target.value)}
            />
            <span className={styles.rowActions}>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Move option ${index + 1} up`}
                disabled={disabled || index === 0}
                onClick={() => move(index, index - 1)}
              >
                <Icon name="up" size={14} />
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Move option ${index + 1} down`}
                disabled={disabled || index === options.length - 1}
                onClick={() => move(index, index + 1)}
              >
                <Icon name="down" size={14} />
              </button>
              <button
                type="button"
                className="icon-btn icon-btn-danger"
                aria-label={`Remove option ${index + 1}`}
                disabled={disabled}
                onClick={() => remove(option.id)}
              >
                <Icon name="close" size={14} />
              </button>
            </span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="btn btn-sm"
        onClick={add}
        disabled={disabled}
      >
        <Icon name="plus" size={14} />
        Add option
      </button>
    </div>
  )
}
