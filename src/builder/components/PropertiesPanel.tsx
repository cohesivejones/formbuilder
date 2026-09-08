import { useId, type ReactNode } from "react"
import { baseProperties, type PropertySpec } from "../model/fieldType"
import { effectiveLocks } from "../model/permissions"
import { isValidKey, slugifyKey } from "../model/keys"
import type { FieldOption, FieldProps, FormField } from "../model/types"
import type { ValidationIssue } from "../model/validate"
import type { FieldPatch } from "../state/reducer"
import { cx } from "./cx"
import { useBuilderContext } from "./builderContext"
import { Icon } from "./Icon"
import { OptionsEditor } from "./OptionsEditor"
import styles from "./PropertiesPanel.module.css"

interface PropertiesPanelProps {
  field: FormField | null
  issues: ValidationIssue[]
  canDuplicate: boolean
  onChange: (patch: FieldPatch) => void
  onDuplicate: () => void
  onRemove: () => void
}

const DEFAULT_SECTION = "Settings"

/**
 * Edits the selected field. Generic settings come first; type-specific ones are
 * rendered from the field type's declarative `properties`, grouped by section,
 * followed by the type's custom editor component if it has one.
 */
export function PropertiesPanel({
  field,
  issues,
  canDuplicate,
  onChange,
  onDuplicate,
  onRemove,
}: PropertiesPanelProps) {
  const { registry, permissions } = useBuilderContext()

  if (!field) {
    return (
      <div className={styles.empty}>
        <p>Select a field on the canvas to edit its properties.</p>
      </div>
    )
  }

  const definition = registry.resolve(field.type)
  const base = baseProperties(definition)
  const locks = effectiveLocks(field, permissions)

  // A control the whole form forbids is dropped, since the canvas card already
  // shows what the field is. A control only this field forbids stays visible
  // but disabled, so the admin can see it is protected while its siblings
  // are not.
  const showLabel = base.has("label") && permissions.editLabels
  const showDescription = base.has("description") && permissions.editLabels
  const showRequired = base.has("required") && permissions.editRequired
  const showKey = !definition.dataless && permissions.editKeys
  const showGeneral = showLabel || showDescription || showRequired || showKey
  const sections = permissions.editProps
    ? groupBySection(definition.properties ?? [])
    : []
  const Editor = permissions.editProps ? definition.PropertiesEditor : undefined
  const readOnly = !showGeneral && sections.length === 0 && Editor === undefined

  const setProp = (name: string, value: unknown) =>
    onChange({ props: { [name]: value } })

  return (
    <div className={styles.panel} key={field.id}>
      <div className={styles.typeRow}>
        <span className={styles.typeBadge}>
          <span className={styles.typeIcon}>{definition.icon}</span>
          {definition.label}
        </span>
        {(field.locks?.remove || field.locks?.key || field.locks?.props) && (
          <span
            className={styles.lockNote}
            title="Some settings are fixed by the host application"
          >
            Locked
          </span>
        )}
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

      {readOnly && (
        <p className={styles.help}>This field has no editable settings.</p>
      )}

      {showGeneral && (
        <Section title="General">
          {showLabel && (
            <TextRow
              label="Label"
              value={field.label}
              disabled={locks.label}
              onChange={(label) => onChange({ label })}
              autoFocus
            />
          )}
          {showKey && (
            <KeyRow field={field} locked={locks.key} onChange={onChange} />
          )}
          {showDescription && (
            <TextRow
              label="Help text"
              value={field.description ?? ""}
              placeholder="Shown under the label"
              disabled={locks.label}
              onChange={(description) => onChange({ description })}
              multiline
            />
          )}
          {showRequired && (
            <CheckRow
              label="Required"
              checked={field.required}
              disabled={locks.required}
              onChange={(required) => onChange({ required })}
            />
          )}
        </Section>
      )}

      {sections.map(([title, specs]) => (
        <Section key={title} title={title}>
          {renderSpecs(specs, field.props, locks.props, setProp)}
        </Section>
      ))}

      {Editor && (
        <Section title="More settings">
          <Editor
            field={field}
            disabled={locks.props}
            onChange={(props) => onChange({ props })}
          />
        </Section>
      )}

      {(permissions.addFields || permissions.removeFields) && (
        <div className={styles.footer}>
          {permissions.addFields && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={onDuplicate}
              disabled={!canDuplicate}
            >
              <Icon name="copy" size={14} />
              Duplicate
            </button>
          )}
          {permissions.removeFields && (
            <button
              type="button"
              className="btn btn-sm btn-danger"
              onClick={onRemove}
              disabled={locks.remove}
              title={locks.remove ? "This field is locked" : undefined}
            >
              <Icon name="trash" size={14} />
              Delete field
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function groupBySection(
  specs: PropertySpec[],
): Array<[string, PropertySpec[]]> {
  const groups = new Map<string, PropertySpec[]>()
  for (const spec of specs) {
    const section = spec.section ?? DEFAULT_SECTION
    groups.set(section, [...(groups.get(section) ?? []), spec])
  }
  return [...groups.entries()]
}

/**
 * Renders a section's specs. Runs of two or more consecutive number specs are
 * laid out side by side, which suits min/max style pairs.
 */
function renderSpecs(
  specs: PropertySpec[],
  props: FieldProps,
  disabled: boolean,
  setProp: (name: string, value: unknown) => void,
): ReactNode[] {
  const nodes: ReactNode[] = []
  let i = 0
  while (i < specs.length) {
    if (specs[i].kind === "number") {
      let j = i
      while (j < specs.length && specs[j].kind === "number") j += 1
      if (j - i >= 2) {
        nodes.push(
          <div key={`pair-${specs[i].name}`} className={styles.pair}>
            {specs.slice(i, j).map((spec) => (
              <PropertyControl
                key={spec.name}
                spec={spec}
                value={props[spec.name]}
                disabled={disabled}
                onChange={(value) => setProp(spec.name, value)}
              />
            ))}
          </div>,
        )
        i = j
        continue
      }
    }
    const spec = specs[i]
    nodes.push(
      <PropertyControl
        key={spec.name}
        spec={spec}
        value={props[spec.name]}
        disabled={disabled}
        onChange={(value) => setProp(spec.name, value)}
      />,
    )
    i += 1
  }
  return nodes
}

function PropertyControl({
  spec,
  value,
  disabled,
  onChange,
}: {
  spec: PropertySpec
  value: unknown
  disabled: boolean
  onChange: (value: unknown) => void
}) {
  switch (spec.kind) {
    case "text":
      return (
        <TextRow
          label={spec.label}
          help={spec.help}
          value={typeof value === "string" ? value : ""}
          placeholder={spec.placeholder}
          multiline={spec.multiline}
          mono={spec.mono}
          disabled={disabled}
          onChange={onChange}
        />
      )
    case "number":
      return (
        <NumberRow
          label={spec.label}
          help={spec.help}
          value={typeof value === "number" ? value : undefined}
          min={spec.min}
          max={spec.max}
          step={spec.step}
          disabled={disabled}
          onChange={onChange}
        />
      )
    case "boolean":
      return (
        <CheckRow
          label={spec.label}
          checked={value === true}
          disabled={disabled}
          onChange={onChange}
        />
      )
    case "select":
      return (
        <SelectRow
          label={spec.label}
          help={spec.help}
          value={typeof value === "string" ? value : ""}
          options={spec.options}
          disabled={disabled}
          onChange={onChange}
        />
      )
    case "options":
      return (
        <OptionsEditor
          options={Array.isArray(value) ? (value as FieldOption[]) : []}
          disabled={disabled}
          onChange={onChange}
        />
      )
  }
}

function KeyRow({
  field,
  locked,
  onChange,
}: {
  field: FormField
  locked: boolean
  onChange: (patch: FieldPatch) => void
}) {
  const id = useId()
  const invalid = field.key !== "" && !isValidKey(field.key)
  return (
    <div className={styles.row}>
      <div className={styles.labelLine}>
        <label htmlFor={id}>Key</label>
        {locked ? (
          <span className={styles.badge}>fixed</span>
        ) : field.autoKey ? (
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
        className={cx("control", styles.mono)}
        value={field.key}
        spellCheck={false}
        disabled={locked}
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
  help,
  value,
  placeholder,
  multiline = false,
  mono = false,
  disabled = false,
  autoFocus = false,
  onChange,
}: {
  label: string
  help?: string
  value: string
  placeholder?: string
  multiline?: boolean
  mono?: boolean
  disabled?: boolean
  autoFocus?: boolean
  onChange: (value: string) => void
}) {
  const id = useId()
  const className = cx("control", mono && styles.mono)
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
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          id={id}
          className={className}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {help && <p className={styles.help}>{help}</p>}
    </div>
  )
}

function NumberRow({
  label,
  help,
  value,
  min,
  max,
  step,
  disabled = false,
  onChange,
}: {
  label: string
  help?: string
  value: number | undefined
  min?: number
  max?: number
  step?: number | "any"
  disabled?: boolean
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
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => onChange(parseNumber(event.target.value))}
      />
      {help && <p className={styles.help}>{help}</p>}
    </div>
  )
}

function SelectRow({
  label,
  help,
  value,
  options,
  disabled = false,
  onChange,
}: {
  label: string
  help?: string
  value: string
  options: { label: string; value: string }[]
  disabled?: boolean
  onChange: (value: string) => void
}) {
  const id = useId()
  return (
    <div className={styles.row}>
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        className="control"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {help && <p className={styles.help}>{help}</p>}
    </div>
  )
}

function CheckRow({
  label,
  checked,
  disabled = false,
  onChange,
}: {
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  const id = useId()
  return (
    <div className={styles.checkRow}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
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
