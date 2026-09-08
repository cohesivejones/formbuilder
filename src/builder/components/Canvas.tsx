import { useMemo } from "react"
import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import type { FormDefinition } from "../model/types"
import type { ValidationIssue } from "../model/validate"
import { canAddField } from "../state/reducer"
import { CanvasField, DropLine } from "./CanvasField"
import { cx } from "./cx"
import { CANVAS_ID, type DropIndicator } from "./dnd"
import { useBuilderContext } from "./builderContext"
import styles from "./Canvas.module.css"

interface CanvasProps {
  form: FormDefinition
  selectedId: string | null
  issues: ValidationIssue[]
  dropIndicator: DropIndicator | null
  isPaletteDragging: boolean
  onSelect: (id: string | null) => void
  onUpdateForm: (
    patch: Partial<Pick<FormDefinition, "title" | "description">>,
  ) => void
  onMove: (from: number, to: number) => void
  onDuplicate: (id: string) => void
  onRemove: (id: string) => void
  onLoadSample?: () => void
}

export function Canvas({
  form,
  selectedId,
  issues,
  dropIndicator,
  isPaletteDragging,
  onSelect,
  onUpdateForm,
  onMove,
  onDuplicate,
  onRemove,
  onLoadSample,
}: CanvasProps) {
  const { registry, permissions } = useBuilderContext()
  const { setNodeRef, isOver } = useDroppable({ id: CANVAS_ID })

  const issuesByField = useMemo(() => {
    const map = new Map<string, ValidationIssue[]>()
    for (const issue of issues) {
      if (!issue.fieldId) continue
      map.set(issue.fieldId, [...(map.get(issue.fieldId) ?? []), issue])
    }
    return map
  }, [issues])

  const indicatorFor = (fieldId: string) =>
    dropIndicator?.target === "field" && dropIndicator.fieldId === fieldId
      ? dropIndicator.position
      : null

  const isEmpty = form.fields.length === 0

  return (
    <div
      className={styles.canvas}
      onClick={(event) => {
        if (event.target === event.currentTarget) onSelect(null)
      }}
    >
      <div className={styles.sheet}>
        <header className={styles.formHeader}>
          <input
            className={styles.titleInput}
            value={form.title}
            placeholder="Form title"
            aria-label="Form title"
            readOnly={!permissions.editFormMeta}
            onChange={(event) => onUpdateForm({ title: event.target.value })}
          />
          <textarea
            className={styles.descriptionInput}
            value={form.description}
            rows={2}
            placeholder="Add a description (optional)"
            aria-label="Form description"
            readOnly={!permissions.editFormMeta}
            onChange={(event) =>
              onUpdateForm({ description: event.target.value })
            }
          />
        </header>

        <SortableContext
          items={form.fields.map((f) => f.id)}
          strategy={verticalListSortingStrategy}
        >
          <div
            ref={setNodeRef}
            className={cx(
              styles.fieldList,
              isEmpty && styles.fieldListEmpty,
              isPaletteDragging && styles.fieldListTarget,
              isOver && isPaletteDragging && styles.fieldListOver,
            )}
            data-testid="canvas-drop-area"
          >
            {isEmpty ? (
              <div className={styles.emptyState}>
                <p className={styles.emptyTitle}>
                  {isPaletteDragging ? "Drop it here" : "Your form is empty"}
                </p>
                <p className={styles.emptyHint}>
                  {permissions.addFields
                    ? "Drag a field from the palette or click one to add it"
                    : "This form has no fields"}
                  {onLoadSample ? (
                    <>
                      , or{" "}
                      <button
                        type="button"
                        className={styles.linkButton}
                        onClick={onLoadSample}
                      >
                        load a sample form
                      </button>
                    </>
                  ) : null}
                  .
                </p>
              </div>
            ) : (
              <>
                {form.fields.map((field, index) => (
                  <CanvasField
                    key={field.id}
                    field={field}
                    index={index}
                    count={form.fields.length}
                    selected={field.id === selectedId}
                    canDuplicate={canAddField(
                      registry,
                      form,
                      field.type,
                      permissions,
                    )}
                    issues={issuesByField.get(field.id) ?? []}
                    indicator={indicatorFor(field.id)}
                    onSelect={onSelect}
                    onMove={onMove}
                    onDuplicate={onDuplicate}
                    onRemove={onRemove}
                  />
                ))}
                {dropIndicator?.target === "end" && <DropLine />}
              </>
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  )
}
