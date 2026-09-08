import { useDraggable } from "@dnd-kit/core"
import type { FieldTypeDefinition } from "../model/fieldType"
import type { FormDefinition } from "../model/types"
import { canAddField } from "../state/reducer"
import { cx } from "./cx"
import { paletteId, type DragData } from "./dnd"
import { useBuilderContext } from "./builderContext"
import styles from "./Palette.module.css"

const HINT_ID = "palette-hint"

interface PaletteProps {
  form: FormDefinition
  onAdd: (type: string) => void
}

export function Palette({ form, onAdd }: PaletteProps) {
  const { registry, permissions } = useBuilderContext()
  return (
    <div className={styles.palette}>
      <h2 className={styles.heading}>Fields</h2>
      <p id={HINT_ID} className={styles.hint}>
        Drag a field onto the canvas, or press Enter to add it after the
        selected field.
      </p>
      <ul className={styles.list}>
        {registry.all().map((definition) => (
          <li key={definition.type}>
            <PaletteItem
              definition={definition}
              disabled={
                !canAddField(registry, form, definition.type, permissions)
              }
              onAdd={onAdd}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

function PaletteItem({
  definition,
  disabled,
  onAdd,
}: {
  definition: FieldTypeDefinition
  disabled: boolean
  onAdd: (type: string) => void
}) {
  const data: DragData = { kind: "palette", fieldType: definition.type }
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: paletteId(definition.type),
    data,
    disabled,
  })

  // Keyboard activation adds the field directly (a plain button press) instead
  // of starting a keyboard drag, which is awkward from a palette.
  const { onKeyDown, ...pointerListeners } = listeners ?? {}
  void onKeyDown

  const limitReached = disabled && definition.maxInstances !== undefined

  return (
    <button
      type="button"
      ref={setNodeRef}
      className={cx(styles.item, isDragging && styles.itemDragging)}
      aria-label={`Add ${definition.label} field`}
      aria-describedby={HINT_ID}
      disabled={disabled}
      title={
        limitReached
          ? definition.maxInstances === 1
            ? "Already added. Only one is allowed."
            : `Limit of ${definition.maxInstances} reached.`
          : undefined
      }
      onClick={() => onAdd(definition.type)}
      {...pointerListeners}
    >
      <PaletteItemContent definition={definition} />
      {limitReached && <span className={styles.limit}>Added</span>}
    </button>
  )
}

export function PaletteItemContent({
  definition,
}: {
  definition: FieldTypeDefinition
}) {
  return (
    <>
      <span className={styles.itemIcon}>{definition.icon}</span>
      <span className={styles.itemText}>
        <span className={styles.itemLabel}>{definition.label}</span>
        {definition.description && (
          <span className={styles.itemDescription}>
            {definition.description}
          </span>
        )}
      </span>
    </>
  )
}

/** Rendered inside the DragOverlay while a palette item is being dragged. */
export function PaletteItemGhost({ type }: { type: string }) {
  const { registry } = useBuilderContext()
  return (
    <div className={cx(styles.item, styles.itemGhost)}>
      <PaletteItemContent definition={registry.resolve(type)} />
    </div>
  )
}
