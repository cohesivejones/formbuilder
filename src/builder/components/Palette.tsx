import { useDraggable } from "@dnd-kit/core"
import type { FieldType } from "../model/types"
import type { FieldTypeMeta } from "../model/fieldRegistry"
import { FIELD_TYPES, fieldTypeMeta } from "../model/fieldRegistry"
import { cx } from "./cx"
import { Icon, type IconName } from "./Icon"
import { paletteId, type DragData } from "./dnd"
import styles from "./Palette.module.css"

const HINT_ID = "palette-hint"

interface PaletteProps {
  onAdd: (type: FieldType) => void
}

export function Palette({ onAdd }: PaletteProps) {
  return (
    <div className={styles.palette}>
      <h2 className={styles.heading}>Fields</h2>
      <p id={HINT_ID} className={styles.hint}>
        Drag a field onto the canvas, or press Enter to add it after the
        selected field.
      </p>
      <ul className={styles.list}>
        {FIELD_TYPES.map((meta) => (
          <li key={meta.type}>
            <PaletteItem meta={meta} onAdd={onAdd} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function PaletteItem({
  meta,
  onAdd,
}: {
  meta: FieldTypeMeta
  onAdd: (type: FieldType) => void
}) {
  const data: DragData = { kind: "palette", fieldType: meta.type }
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: paletteId(meta.type),
    data,
  })

  // Keyboard activation adds the field directly (a plain button press) instead
  // of starting a keyboard drag, which is awkward from a palette.
  const { onKeyDown, ...pointerListeners } = listeners ?? {}
  void onKeyDown

  return (
    <button
      type="button"
      ref={setNodeRef}
      className={cx(styles.item, isDragging && styles.itemDragging)}
      aria-label={`Add ${meta.label} field`}
      aria-describedby={HINT_ID}
      onClick={() => onAdd(meta.type)}
      {...pointerListeners}
    >
      <PaletteItemContent meta={meta} />
    </button>
  )
}

export function PaletteItemContent({ meta }: { meta: FieldTypeMeta }) {
  return (
    <>
      <span className={styles.itemIcon}>
        <Icon name={meta.icon as IconName} size={18} />
      </span>
      <span className={styles.itemText}>
        <span className={styles.itemLabel}>{meta.label}</span>
        <span className={styles.itemDescription}>{meta.description}</span>
      </span>
    </>
  )
}

/** Rendered inside the DragOverlay while a palette item is being dragged. */
export function PaletteItemGhost({ type }: { type: FieldType }) {
  return (
    <div className={cx(styles.item, styles.itemGhost)}>
      <PaletteItemContent meta={fieldTypeMeta(type)} />
    </div>
  )
}
