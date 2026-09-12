import { fieldValueInfo, type FieldValueInfo } from "../conditions/check"
import type { Condition, Literal } from "../conditions/model"
import type { FieldTypeRegistry } from "../model/registry"
import type { FormField } from "../model/types"
import { useFieldTypes } from "./builderContext"
import { cx } from "./cx"
import styles from "./ConditionBuilder.module.css"

type Group = Extract<Condition, { op: "and" | "or" }>
type Comparison = Exclude<Condition, Group | { op: "not" }>

function isGroup(condition: Condition): condition is Group {
  return condition.op === "and" || condition.op === "or"
}

/**
 * Collapses editing artifacts: an empty group is no rule at all, and a group
 * of one is just its child. What is stored never contains either.
 */
function normalize(condition: Condition): Condition | null {
  if (!isGroup(condition)) return condition
  const children = condition.conditions
    .map(normalize)
    .filter((child): child is Condition => child !== null)
  if (children.length === 0) return null
  if (children.length === 1) return children[0]
  return { op: condition.op, conditions: children }
}

interface ConditionBuilderProps {
  /** The field the rule belongs to; it is not offered as a reference. */
  field: FormField
  fields: FormField[]
  value: Condition | undefined
  disabled: boolean
  onChange: (condition: Condition | null) => void
}

/**
 * The structured view over a condition tree: rows of field, comparison and
 * value dropdowns, grouped under all/any connectives, groups nestable. It
 * edits the same tree the expression view does, so the two stay two surfaces
 * over one rule — and because every choice here is picked from what exists,
 * a rule built this way cannot reference a missing field or option, and the
 * grouping ambiguity of a typed `a and b or c` cannot arise.
 */
export function ConditionBuilder({
  field,
  fields,
  value,
  disabled,
  onChange,
}: ConditionBuilderProps) {
  const registry = useFieldTypes()
  const eligible = fields.filter((f) => f.key && f.id !== field.id)

  const commit = (next: Condition | null) => onChange(next && normalize(next))

  if (eligible.length === 0) {
    return <p className={styles.empty}>No other fields to refer to yet.</p>
  }

  if (!value) {
    return (
      <div className={styles.emptyState}>
        <span className={styles.empty}>Always</span>
        <button
          type="button"
          className="btn btn-sm"
          disabled={disabled}
          onClick={() => commit(defaultRow(eligible[0], registry))}
        >
          Add a rule
        </button>
      </div>
    )
  }

  // A lone comparison renders as a one-row group; normalize undoes the wrap.
  const root: Group = isGroup(value)
    ? value
    : { op: "and", conditions: [value] }

  return (
    <GroupView
      group={root}
      isRoot
      eligible={eligible}
      registry={registry}
      disabled={disabled}
      onChange={commit}
    />
  )
}

interface GroupViewProps {
  group: Group
  isRoot?: boolean
  eligible: FormField[]
  registry: FieldTypeRegistry
  disabled: boolean
  onChange: (next: Condition | null) => void
}

function GroupView({
  group,
  isRoot = false,
  eligible,
  registry,
  disabled,
  onChange,
}: GroupViewProps) {
  const replaceChild = (index: number, next: Condition | null) => {
    const children = [...group.conditions]
    if (next === null) children.splice(index, 1)
    else children[index] = next
    onChange(
      children.length === 0 ? null : { op: group.op, conditions: children },
    )
  }

  const append = (child: Condition) =>
    onChange({ op: group.op, conditions: [...group.conditions, child] })

  return (
    <div className={cx(styles.group, !isRoot && styles.nested)}>
      <div className={styles.groupHeader}>
        <select
          className={cx("control", styles.connective)}
          aria-label="Match"
          value={group.op}
          disabled={disabled}
          onChange={(event) =>
            onChange({
              op: event.target.value as Group["op"],
              conditions: group.conditions,
            })
          }
        >
          <option value="and">all</option>
          <option value="or">any</option>
        </select>
        <span className={styles.groupCaption}>of the following are true</span>
        {!isRoot && (
          <button
            type="button"
            className="icon-btn icon-btn-danger"
            aria-label="Remove group"
            disabled={disabled}
            onClick={() => onChange(null)}
          >
            ✕
          </button>
        )}
      </div>

      <ul className={styles.children}>
        {group.conditions.map((child, index) => (
          <li key={index} className={styles.child}>
            {isGroup(child) ? (
              <GroupView
                group={child}
                eligible={eligible}
                registry={registry}
                disabled={disabled}
                onChange={(next) => replaceChild(index, next)}
              />
            ) : child.op === "not" ? (
              // Only reachable through hand-built data; rows never produce it.
              <span className={styles.empty}>
                A "not" clause — edit this rule in the expression view.
              </span>
            ) : (
              <RowView
                row={child}
                eligible={eligible}
                registry={registry}
                disabled={disabled}
                onChange={(next) => replaceChild(index, next)}
              />
            )}
          </li>
        ))}
      </ul>

      <div className={styles.groupActions}>
        <button
          type="button"
          className="btn btn-sm"
          disabled={disabled}
          onClick={() => append(defaultRow(eligible[0], registry))}
        >
          + Rule
        </button>
        <button
          type="button"
          className="btn btn-sm"
          disabled={disabled}
          onClick={() =>
            append({
              op: group.op === "and" ? "or" : "and",
              conditions: [defaultRow(eligible[0], registry)],
            })
          }
        >
          + Group
        </button>
      </div>
    </div>
  )
}

interface RowViewProps {
  row: Comparison
  eligible: FormField[]
  registry: FieldTypeRegistry
  disabled: boolean
  onChange: (next: Condition | null) => void
}

function RowView({
  row,
  eligible,
  registry,
  disabled,
  onChange,
}: RowViewProps) {
  const referenced = eligible.find((f) => f.id === row.field)
  const info: FieldValueInfo = referenced
    ? fieldValueInfo(referenced, registry)
    : { kind: "unknown", noun: "an unknown value" }
  const operators = operatorsFor(info)

  const changeField = (id: string) => {
    const nextField = eligible.find((f) => f.id === id)
    if (!nextField) return
    const nextInfo = fieldValueInfo(nextField, registry)
    const keepOp = operatorsFor(nextInfo).some((o) => o.op === row.op)
    onChange(
      keepOp && "value" in row
        ? retarget(row, id, nextInfo)
        : defaultRow(nextField, registry),
    )
  }

  const changeOperator = (op: string) => {
    if (op === "empty" || op === "notEmpty") {
      onChange({ op, field: row.field })
      return
    }
    onChange(withValue(row.field, op, currentValue(row) ?? defaultValue(info)))
  }

  return (
    <div className={styles.row} data-testid="condition-row">
      <select
        className={cx("control", styles.rowControl)}
        aria-label="Rule field"
        value={referenced ? row.field : ""}
        disabled={disabled}
        onChange={(event) => changeField(event.target.value)}
      >
        {!referenced && (
          <option value="" disabled>
            (missing field)
          </option>
        )}
        {eligible.map((f) => (
          <option key={f.id} value={f.id}>
            {f.key}
          </option>
        ))}
      </select>

      <select
        className={cx("control", styles.rowControl)}
        aria-label="Rule comparison"
        value={row.op}
        disabled={disabled || !referenced}
        onChange={(event) => changeOperator(event.target.value)}
      >
        {operators.map((o) => (
          <option key={o.op} value={o.op}>
            {o.label}
          </option>
        ))}
      </select>

      <ValueControl
        row={row}
        info={info}
        disabled={disabled || !referenced}
        onChange={onChange}
      />

      <button
        type="button"
        className="icon-btn icon-btn-danger"
        aria-label="Remove rule"
        disabled={disabled}
        onClick={() => onChange(null)}
      >
        ✕
      </button>
    </div>
  )
}

function ValueControl({
  row,
  info,
  disabled,
  onChange,
}: {
  row: Comparison
  info: FieldValueInfo
  disabled: boolean
  onChange: (next: Condition) => void
}) {
  if (row.op === "empty" || row.op === "notEmpty") return null
  const value = currentValue(row)

  if (info.kind === "boolean") {
    return (
      <select
        className={cx("control", styles.rowControl)}
        aria-label="Rule value"
        value={String(value === true)}
        disabled={disabled}
        onChange={(event) =>
          onChange(withValue(row.field, row.op, event.target.value === "true"))
        }
      >
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    )
  }

  if (
    info.options &&
    (row.op === "eq" || row.op === "ne" || row.op === "contains")
  ) {
    const known = info.options.some((o) => o === value)
    return (
      <select
        className={cx("control", styles.rowControl)}
        aria-label="Rule value"
        value={String(value ?? "")}
        disabled={disabled}
        onChange={(event) =>
          onChange(withValue(row.field, row.op, event.target.value))
        }
      >
        {!known && value !== undefined && (
          <option value={String(value)}>{`${String(value)} (missing)`}</option>
        )}
        {info.options.map((option) => (
          <option key={String(option)} value={String(option)}>
            {String(option)}
          </option>
        ))}
      </select>
    )
  }

  if (info.kind === "number") {
    return (
      <input
        className={cx("control", styles.rowControl, styles.numberControl)}
        aria-label="Rule value"
        type="number"
        value={typeof value === "number" ? value : 0}
        disabled={disabled}
        onChange={(event) => {
          const parsed = Number(event.target.value)
          onChange(
            withValue(row.field, row.op, Number.isFinite(parsed) ? parsed : 0),
          )
        }}
      />
    )
  }

  return (
    <input
      className={cx("control", styles.rowControl)}
      aria-label="Rule value"
      type="text"
      value={typeof value === "string" ? value : ""}
      disabled={disabled}
      onChange={(event) =>
        onChange(withValue(row.field, row.op, event.target.value))
      }
    />
  )
}

interface OperatorChoice {
  op: Comparison["op"]
  label: string
}

function operatorsFor(info: FieldValueInfo): OperatorChoice[] {
  switch (info.kind) {
    case "boolean":
      return [{ op: "eq", label: "=" }]
    case "number":
      return [
        { op: "eq", label: "=" },
        { op: "ne", label: "!=" },
        { op: "gt", label: ">" },
        { op: "gte", label: ">=" },
        { op: "lt", label: "<" },
        { op: "lte", label: "<=" },
        { op: "empty", label: "is empty" },
        { op: "notEmpty", label: "is not empty" },
      ]
    case "list":
      return [
        { op: "contains", label: "contains" },
        { op: "empty", label: "is empty" },
        { op: "notEmpty", label: "is not empty" },
      ]
    case "text":
      return [
        { op: "eq", label: "=" },
        { op: "ne", label: "!=" },
        ...(info.options
          ? []
          : [{ op: "contains", label: "contains" } as OperatorChoice]),
        { op: "empty", label: "is empty" },
        { op: "notEmpty", label: "is not empty" },
      ]
    default:
      return [
        { op: "eq", label: "=" },
        { op: "ne", label: "!=" },
      ]
  }
}

/** A complete, valid row for a field: its first operator with a fitting value. */
function defaultRow(field: FormField, registry: FieldTypeRegistry): Condition {
  const info = fieldValueInfo(field, registry)
  if (info.kind === "list") {
    return {
      op: "contains",
      field: field.id,
      value: String(defaultValue(info)),
    }
  }
  return { op: "eq", field: field.id, value: defaultValue(info) }
}

function defaultValue(info: FieldValueInfo): Literal {
  if (info.options && info.options.length > 0) return info.options[0]
  if (info.kind === "number") return 0
  if (info.kind === "boolean") return true
  return ""
}

function currentValue(row: Comparison): Literal | undefined {
  return "value" in row ? row.value : undefined
}

/** Rebuilds a comparison, keeping the operator, for a typed value. */
function withValue(field: string, op: string, value: Literal): Condition {
  if (op === "gt" || op === "gte" || op === "lt" || op === "lte") {
    return { op, field, value: typeof value === "number" ? value : 0 }
  }
  if (op === "contains") {
    return {
      op,
      field,
      value: typeof value === "string" ? value : String(value),
    }
  }
  return { op: op === "ne" ? "ne" : "eq", field, value }
}

/** The same row pointed at a different field, coercing the value to fit. */
function retarget(
  row: Comparison,
  field: string,
  info: FieldValueInfo,
): Condition {
  const value = currentValue(row)
  if (row.op === "empty" || row.op === "notEmpty") return { op: row.op, field }
  const fits =
    value !== undefined &&
    (info.options
      ? info.options.includes(value)
      : typeof value === typeofFor(info))
  return withValue(field, row.op, fits ? value : defaultValue(info))
}

function typeofFor(info: FieldValueInfo): "string" | "number" | "boolean" {
  if (info.kind === "number") return "number"
  if (info.kind === "boolean") return "boolean"
  return "string"
}
