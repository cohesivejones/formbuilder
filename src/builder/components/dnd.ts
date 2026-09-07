import type { Active, Over } from "@dnd-kit/core"
import type { FormField } from "../model/types"

/** Droppable id for the canvas list itself (dropping here appends). */
export const CANVAS_ID = "canvas"

const PALETTE_PREFIX = "palette:"

export function paletteId(type: string): string {
  return `${PALETTE_PREFIX}${type}`
}

/** Attached to draggables via `data` so handlers know what is being dragged. */
export type DragData =
  { kind: "palette"; fieldType: string } | { kind: "field" }

export function dragData(active: Active): DragData | undefined {
  return active.data.current as DragData | undefined
}

/** What the DragOverlay should render. */
export type ActiveDrag =
  { kind: "palette"; fieldType: string } | { kind: "field"; field: FormField }

/** Where a palette item would land if dropped right now. */
export type DropIndicator =
  | { target: "end" }
  | { target: "field"; fieldId: string; position: "before" | "after" }

/**
 * Works out the insertion index for a palette item dropped over `over`.
 * Dropping over a field inserts before or after it depending on whether the
 * dragged item's midpoint is above or below the field's midpoint.
 */
export function resolveDrop(
  active: Active,
  over: Over,
  fields: FormField[],
): { index: number; indicator: DropIndicator } {
  const overIndex = fields.findIndex((f) => f.id === over.id)
  if (over.id === CANVAS_ID || overIndex === -1) {
    return { index: fields.length, indicator: { target: "end" } }
  }

  const dragged = active.rect.current.translated
  const overMidpoint = over.rect.top + over.rect.height / 2
  const draggedMidpoint = dragged
    ? dragged.top + dragged.height / 2
    : overMidpoint
  const after = draggedMidpoint > overMidpoint

  return {
    index: after ? overIndex + 1 : overIndex,
    indicator: {
      target: "field",
      fieldId: String(over.id),
      position: after ? "after" : "before",
    },
  }
}
