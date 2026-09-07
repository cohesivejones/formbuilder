import type { ReactNode } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import type { FormField } from "../model/types"
import { fieldTypeMeta } from "../model/fieldRegistry"
import type { ValidationIssue } from "../model/validate"
import { cx } from "./cx"
import type { DragData } from "./dnd"
import { FieldPreview } from "./FieldPreview"
import { Icon, type IconName } from "./Icon"
import styles from "./CanvasField.module.css"

interface CanvasFieldProps {
  field: FormField
  index: number
  count: number
  selected: boolean
  issues: ValidationIssue[]
  indicator: "before" | "after" | null
  onSelect: (id: string) => void
  onMove: (from: number, to: number) => void
  onDuplicate: (id: string) => void
  onRemove: (id: string) => void
}

export function CanvasField({
  field,
  index,
  count,
  selected,
  issues,
  indicator,
  onSelect,
  onMove,
  onDuplicate,
  onRemove,
}: CanvasFieldProps) {
  const data: DragData = { kind: "field" }
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id, data })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const stop = (handler: () => void) => (event: React.MouseEvent) => {
    event.stopPropagation()
    handler()
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cx(styles.wrapper, isDragging && styles.dragging)}
      data-testid={`canvas-field-${field.key}`}
    >
      {indicator === "before" && <DropLine />}
      <FieldCard
        field={field}
        selected={selected}
        issues={issues}
        onSelect={() => onSelect(field.id)}
        handle={
          <button
            type="button"
            ref={setActivatorNodeRef}
            className={cx("icon-btn", styles.handle)}
            aria-label={`Drag to reorder ${field.label}`}
            {...attributes}
            {...listeners}
          >
            <Icon name="grip" />
          </button>
        }
        actions={
          <>
            <button
              type="button"
              className="icon-btn"
              aria-label={`Move ${field.label} up`}
              disabled={index === 0}
              onClick={stop(() => onMove(index, index - 1))}
            >
              <Icon name="up" />
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label={`Move ${field.label} down`}
              disabled={index === count - 1}
              onClick={stop(() => onMove(index, index + 1))}
            >
              <Icon name="down" />
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label={`Duplicate ${field.label}`}
              onClick={stop(() => onDuplicate(field.id))}
            >
              <Icon name="copy" />
            </button>
            <button
              type="button"
              className="icon-btn icon-btn-danger"
              aria-label={`Delete ${field.label}`}
              onClick={stop(() => onRemove(field.id))}
            >
              <Icon name="trash" />
            </button>
          </>
        }
      />
      {indicator === "after" && <DropLine />}
    </div>
  )
}

export function DropLine() {
  return <div className={styles.dropLine} role="presentation" />
}

interface FieldCardProps {
  field: FormField
  selected?: boolean
  issues?: ValidationIssue[]
  handle?: ReactNode
  actions?: ReactNode
  onSelect?: () => void
  className?: string
}

/**
 * Presentational card for a field. Used on the canvas and, without handlers,
 * inside the DragOverlay.
 */
export function FieldCard({
  field,
  selected = false,
  issues = [],
  handle,
  actions,
  onSelect,
  className,
}: FieldCardProps) {
  const meta = fieldTypeMeta(field.type)
  const hasIssues = issues.length > 0

  return (
    <div
      className={cx(
        styles.card,
        selected && styles.selected,
        hasIssues && styles.hasIssues,
        className,
      )}
      onClick={onSelect}
    >
      <div className={styles.header}>
        {handle ?? (
          <span className={cx("icon-btn", styles.handle)}>
            <Icon name="grip" />
          </span>
        )}
        <button
          type="button"
          className={styles.title}
          onClick={(event) => {
            event.stopPropagation()
            onSelect?.()
          }}
          aria-pressed={selected}
          aria-label={`Edit ${field.label || "untitled field"}`}
        >
          <span className={styles.label}>
            {field.label || <em className={styles.untitled}>Untitled</em>}
          </span>
          {field.required && (
            <span className={styles.required} title="Required">
              *
            </span>
          )}
        </button>
        <span className={styles.typeBadge}>
          <Icon name={meta.icon as IconName} size={13} />
          {meta.label}
        </span>
        {hasIssues && (
          <span
            className={styles.issueBadge}
            title={issues.map((i) => i.message).join("\n")}
            aria-label={`${issues.length} issue${issues.length === 1 ? "" : "s"}`}
          >
            <Icon name="warning" size={14} />
          </span>
        )}
        {actions && <span className={styles.actions}>{actions}</span>}
      </div>
      {field.description && (
        <p className={styles.description}>{field.description}</p>
      )}
      <FieldPreview field={field} />
      <div className={styles.footer}>
        <code className={styles.key}>{field.key}</code>
      </div>
    </div>
  )
}
