import { useId, type ReactNode } from "react"
import type { FieldOption, FormField } from "../model/types"
import { fieldTypeMeta } from "../model/fieldRegistry"
import { isValidKey, slugifyKey } from "../model/keys"
import type { ValidationIssue } from "../model/validate"
import type { FieldPatch } from "../state/reducer"
import { Icon, type IconName } from "./Icon"
import { OptionsEditor } from "./OptionsEditor"
import styles from "./PropertiesPanel.module.css"

interface PropertiesPanelProps {
  field: FormField | null
  issues: ValidationIssue[]
  onChange: (patch: FieldPatch) => void
  onSetOptions: (options: FieldOption[]) => void
  onDuplicate: () => void
  onRemove: () => void
}

export function PropertiesPanel({
  field,
  issues,
  onChange,
  onSetOptions,
  onDuplicate,
  onRemove,
}: PropertiesPanelProps) {
  if (!field) {
    return (
      <div className={styles.empty}>
        <p>Select a field on the canvas to edit its properties.</p>
      </div>
    )
  }

  const meta = fieldTypeMeta(field.type)

  return (
    <div className={styles.panel} key={field.id}>
      <div className={styles.typeRow}>
        <span className={styles.typeBadge}>
          <Icon name={meta.icon as IconName} size={14} />
          {meta.label}
        </span>
      </div>

      {issues.length > 0 && (
        <ul className={styles.issues} aria-label="Problems with this field">
          {issues.map((issue) => (
            <li key={issue.message}>
              <Icon name="warning" size={14} />
              {issue.message}
            </li>
          ))}
        </ul>
      )}

      <Section title="General">
        <TextRow
          label="Label"
          value={field.label}
          onChange={(label) => onChange({ label })}
          autoFocus
        />
        <KeyRow field={field} onChange={onChange} />
        <TextRow
          label="Help text"
          value={field.description ?? ""}
          placeholder="Shown under the label"
          onChange={(description) =>
            onChange({ description: description || undefined })
          }
          multiline
        />
        <CheckRow
          label="Required"
          checked={field.required}
          onChange={(required) => onChange({ required })}
        />
      </Section>

      <TypeSpecific
        field={field}
        onChange={onChange}
        onSetOptions={onSetOptions}
      />

      <div className={styles.footer}>
        <button type="button" className="btn btn-sm" onClick={onDuplicate}>
          <Icon name="copy" size={14} />
          Duplicate
        </button>
        <button
          type="button"
          className="btn btn-sm btn-danger"
          onClick={onRemove}
        >
          <Icon name="trash" size={14} />
          Delete field
        </button>
      </div>
    </div>
  )
}

function TypeSpecific({
  field,
  onChange,
  onSetOptions,
}: {
  field: FormField
  onChange: (patch: FieldPatch) => void
  onSetOptions: (options: FieldOption[]) => void
}) {
  switch (field.type) {
    case "text":
      return (
        <Section title="Validation">
          <TextRow
            label="Placeholder"
            value={field.placeholder ?? ""}
            onChange={(placeholder) => onChange({ placeholder })}
          />
          <div className={styles.pair}>
            <NumberRow
              label="Min length"
              value={field.minLength}
              min={0}
              onChange={(minLength) => onChange({ minLength })}
            />
            <NumberRow
              label="Max length"
              value={field.maxLength}
              min={0}
              onChange={(maxLength) => onChange({ maxLength })}
            />
          </div>
          <TextRow
            label="Pattern (regular expression)"
            value={field.pattern ?? ""}
            placeholder="^[A-Z]{3}[0-9]{4}$"
            mono
            invalid={!isValidRegex(field.pattern)}
            onChange={(pattern) => onChange({ pattern: pattern || undefined })}
          />
        </Section>
      )
    case "email":
      return (
        <Section title="Display">
          <TextRow
            label="Placeholder"
            value={field.placeholder ?? ""}
            onChange={(placeholder) => onChange({ placeholder })}
          />
        </Section>
      )
    case "number":
      return (
        <Section title="Validation">
          <TextRow
            label="Placeholder"
            value={field.placeholder ?? ""}
            onChange={(placeholder) => onChange({ placeholder })}
          />
          <div className={styles.pair}>
            <NumberRow
              label="Minimum"
              value={field.min}
              onChange={(min) => onChange({ min })}
            />
            <NumberRow
              label="Maximum"
              value={field.max}
              onChange={(max) => onChange({ max })}
            />
          </div>
          <NumberRow
            label="Step"
            value={field.step}
            min={0}
            step="any"
            onChange={(step) => onChange({ step })}
          />
          <CheckRow
            label="Whole numbers only"
            checked={field.integer}
            onChange={(integer) => onChange({ integer })}
          />
        </Section>
      )
    case "textarea":
      return (
        <Section title="Display and validation">
          <TextRow
            label="Placeholder"
            value={field.placeholder ?? ""}
            onChange={(placeholder) => onChange({ placeholder })}
          />
          <div className={styles.pair}>
            <NumberRow
              label="Rows"
              value={field.rows}
              min={1}
              onChange={(rows) => onChange({ rows: rows ?? 3 })}
            />
            <NumberRow
              label="Max length"
              value={field.maxLength}
              min={0}
              onChange={(maxLength) => onChange({ maxLength })}
            />
          </div>
        </Section>
      )
    case "checkbox":
      return (
        <Section title="Default">
          <CheckRow
            label="Checked by default"
            checked={field.defaultChecked}
            onChange={(defaultChecked) => onChange({ defaultChecked })}
          />
        </Section>
      )
    case "date":
      return null
    case "select":
      return (
        <>
          <Section title="Display">
            <TextRow
              label="Placeholder"
              value={field.placeholder ?? ""}
              onChange={(placeholder) => onChange({ placeholder })}
            />
          </Section>
          <Section title="Options">
            <OptionsEditor options={field.options} onChange={onSetOptions} />
          </Section>
        </>
      )
    case "radio":
      return (
        <Section title="Options">
          <OptionsEditor options={field.options} onChange={onSetOptions} />
        </Section>
      )
    case "checkboxGroup":
      return (
        <>
          <Section title="Options">
            <OptionsEditor options={field.options} onChange={onSetOptions} />
          </Section>
          <Section title="Validation">
            <div className={styles.pair}>
              <NumberRow
                label="Min selected"
                value={field.minSelected}
                min={0}
                onChange={(minSelected) => onChange({ minSelected })}
              />
              <NumberRow
                label="Max selected"
                value={field.maxSelected}
                min={1}
                onChange={(maxSelected) => onChange({ maxSelected })}
              />
            </div>
          </Section>
        </>
      )
  }
}

function KeyRow({
  field,
  onChange,
}: {
  field: FormField
  onChange: (patch: FieldPatch) => void
}) {
  const id = useId()
  const invalid = field.key !== "" && !isValidKey(field.key)
  return (
    <div className={styles.row}>
      <div className={styles.labelLine}>
        <label htmlFor={id}>Key</label>
        {field.autoKey ? (
          <span className={styles.badge}>from label</span>
        ) : (
          <button
            type="button"
            className={styles.inlineButton}
            onClick={() =>
              onChange({ key: slugifyKey(field.label), autoKey: true })
            }
          >
            <Icon name="reset" size={12} />
            Derive from label
          </button>
        )}
      </div>
      <input
        id={id}
        className={`control ${styles.mono}`}
        value={field.key}
        spellCheck={false}
        aria-invalid={invalid || undefined}
        onChange={(event) => onChange({ key: event.target.value })}
      />
      <p className={styles.help}>Property name in the JSON Schema.</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {children}
    </section>
  )
}

function TextRow({
  label,
  value,
  placeholder,
  multiline = false,
  mono = false,
  invalid = false,
  autoFocus = false,
  onChange,
}: {
  label: string
  value: string
  placeholder?: string
  multiline?: boolean
  mono?: boolean
  invalid?: boolean
  autoFocus?: boolean
  onChange: (value: string) => void
}) {
  const id = useId()
  const className = `control ${mono ? styles.mono : ""}`
  return (
    <div className={styles.row}>
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea
          id={id}
          className={className}
          rows={2}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          id={id}
          className={className}
          value={value}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          autoFocus={autoFocus}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  )
}

function NumberRow({
  label,
  value,
  min,
  step,
  onChange,
}: {
  label: string
  value: number | undefined
  min?: number
  step?: number | "any"
  onChange: (value: number | undefined) => void
}) {
  const id = useId()
  return (
    <div className={styles.row}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="control"
        type="number"
        inputMode="decimal"
        value={value ?? ""}
        min={min}
        step={step}
        onChange={(event) => onChange(parseNumber(event.target.value))}
      />
    </div>
  )
}

function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  const id = useId()
  return (
    <div className={styles.checkRow}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <label htmlFor={id}>{label}</label>
    </div>
  )
}

function parseNumber(raw: string): number | undefined {
  if (raw.trim() === "") return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

function isValidRegex(pattern: string | undefined): boolean {
  if (!pattern) return true
  try {
    new RegExp(pattern)
    return true
  } catch {
    return false
  }
}
