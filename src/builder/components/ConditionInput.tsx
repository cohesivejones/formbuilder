import { useId, useLayoutEffect, useRef, useState } from "react"
import { checkCondition } from "../conditions/check"
import type { Condition } from "../conditions/model"
import { parseCondition } from "../conditions/parse"
import { printCondition } from "../conditions/print"
import type { FormField } from "../model/types"
import { cx } from "./cx"
import { useFieldTypes } from "./builderContext"
import styles from "./ConditionInput.module.css"

interface ConditionInputProps {
  label: string
  /** Rendered at the right of the label line — a view toggle, typically. */
  labelExtra?: React.ReactNode
  help: string
  field: FormField
  /** Every field on the form, for resolving and suggesting keys. */
  fields: FormField[]
  value: Condition | undefined
  disabled: boolean
  /** `null` clears the rule. Called only with input that parses and checks. */
  onChange: (condition: Condition | null) => void
}

/**
 * One rule, edited as an expression. The text is an editing surface only: it
 * commits the condition tree when it both parses and survives the semantic
 * check (real fields, options that exist, comparisons that fit the field's
 * shape); anything less shows its error and leaves the last committed rule
 * standing. Blur rewrites the box with the pretty-printed stored rule, and a
 * partially typed field name offers the keys it could become.
 */
export function ConditionInput({
  label,
  labelExtra,
  help,
  field,
  fields,
  value,
  disabled,
  onChange,
}: ConditionInputProps) {
  const id = useId()
  const registry = useFieldTypes()
  const inputRef = useRef<HTMLInputElement>(null)
  const caretRef = useRef<number | null>(null)
  const [draft, setDraft] = useState(() =>
    value ? printCondition(value, fields) : "",
  )
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [active, setActive] = useState(0)

  // Placing the caret after an accepted suggestion has to wait for the new
  // draft to render into the input.
  useLayoutEffect(() => {
    if (caretRef.current !== null && inputRef.current) {
      inputRef.current.setSelectionRange(caretRef.current, caretRef.current)
      caretRef.current = null
    }
  }, [draft])

  const commit = (text: string) => {
    const result = parseCondition(text, { fields, selfId: field.id })
    if (!result.ok) {
      setError(result.error)
      return
    }
    if (result.condition) {
      const problems = checkCondition(result.condition, fields, registry)
      if (problems.length > 0) {
        setError(problems[0])
        return
      }
    }
    setError(null)
    onChange(result.condition)
  }

  const handleChange = (text: string, caret: number | null) => {
    setDraft(text)
    commit(text)
    setSuggestions(suggestKeys(text, caret, fields, field.id))
    setActive(0)
  }

  const accept = (key: string) => {
    const caret = inputRef.current?.selectionStart ?? draft.length
    const token = tokenBefore(draft, caret)
    if (!token) return
    const next = draft.slice(0, token.start) + key + draft.slice(caret)
    caretRef.current = token.start + key.length
    setSuggestions([])
    setDraft(next)
    commit(next)
    inputRef.current?.focus()
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (suggestions.length === 0) return
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActive((i) => (i + 1) % suggestions.length)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActive((i) => (i - 1 + suggestions.length) % suggestions.length)
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault()
      accept(suggestions[active])
    } else if (event.key === "Escape") {
      setSuggestions([])
    }
  }

  const handleBlur = () => {
    setSuggestions([])
    if (!error) setDraft(value ? printCondition(value, fields) : "")
  }

  const listId = `${id}-suggestions`

  return (
    <div className={styles.row}>
      <div className={styles.labelLine}>
        <label htmlFor={id}>{label}</label>
        {labelExtra}
      </div>
      <div className={styles.inputWrap}>
        <input
          id={id}
          ref={inputRef}
          className={cx("control", styles.input)}
          value={draft}
          placeholder="always"
          spellCheck={false}
          disabled={disabled}
          role="combobox"
          aria-expanded={suggestions.length > 0}
          aria-controls={listId}
          aria-activedescendant={
            suggestions.length > 0 ? `${listId}-${active}` : undefined
          }
          aria-autocomplete="list"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) =>
            handleChange(event.target.value, event.target.selectionStart)
          }
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
        />
        {suggestions.length > 0 && (
          <ul id={listId} className={styles.suggestions} role="listbox">
            {suggestions.map((key, index) => (
              <li
                key={key}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                className={cx(
                  styles.suggestion,
                  index === active && styles.suggestionActive,
                )}
                // Accepting on mousedown beats the input's blur to the punch.
                onMouseDown={(event) => {
                  event.preventDefault()
                  accept(key)
                }}
              >
                {key}
              </li>
            ))}
          </ul>
        )}
      </div>
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

/** The identifier being typed at the caret, if any. */
function tokenBefore(
  text: string,
  caret: number,
): { start: number; word: string } | null {
  const upToCaret = text.slice(0, caret)
  const match = /[A-Za-z_][A-Za-z0-9_]*$/.exec(upToCaret)
  if (!match) return null
  return { start: caret - match[0].length, word: match[0] }
}

const KEYWORDS = new Set([
  "and",
  "or",
  "not",
  "is",
  "empty",
  "contains",
  "true",
  "false",
])

function suggestKeys(
  text: string,
  caret: number | null,
  fields: FormField[],
  selfId: string,
): string[] {
  if (caret === null) return []
  const token = tokenBefore(text, caret)
  if (!token) return []
  // Inside a quoted value nothing is a field name.
  const before = text.slice(0, token.start)
  const inQuotes =
    (before.split("'").length - 1) % 2 === 1 ||
    (before.split('"').length - 1) % 2 === 1
  if (inQuotes) return []

  const word = token.word.toLowerCase()
  if (KEYWORDS.has(word)) return []
  const matches = fields
    .filter(
      (f) =>
        f.key &&
        f.id !== selfId &&
        f.key.toLowerCase().startsWith(word) &&
        f.key !== token.word,
    )
    .map((f) => f.key)
    .sort()
  return matches.slice(0, 6)
}
