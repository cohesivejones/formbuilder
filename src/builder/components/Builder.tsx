import { useCallback, useMemo, useState } from "react"
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core"
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import type { FieldType } from "../model/types"
import { fieldTypeMeta } from "../model/fieldRegistry"
import { createSampleForm } from "../model/sample"
import { useFormBuilder } from "../state/useFormBuilder"
import { Canvas } from "./Canvas"
import { FieldCard } from "./CanvasField"
import { cx } from "./cx"
import {
  CANVAS_ID,
  dragData,
  resolveDrop,
  type ActiveDrag,
  type DropIndicator,
} from "./dnd"
import { Icon } from "./Icon"
import { Palette, PaletteItemGhost } from "./Palette"
import { PropertiesPanel } from "./PropertiesPanel"
import { SchemaOutput } from "./SchemaOutput"
import styles from "./Builder.module.css"

type PanelTab = "field" | "schema"

/**
 * Palette items use pointer position so they can be dropped precisely between
 * fields; sorting uses closest-center so cards swap smoothly. The canvas
 * droppable only participates when nothing more specific is under the pointer.
 */
const collisionDetection: CollisionDetection = (args) => {
  const data = args.active.data.current as { kind?: string } | undefined
  if (data?.kind === "palette") {
    const hits = pointerWithin(args)
    const collisions = hits.length > 0 ? hits : rectIntersection(args)
    const fieldHits = collisions.filter((c) => c.id !== CANVAS_ID)
    return fieldHits.length > 0 ? fieldHits : collisions
  }
  return closestCenter({
    ...args,
    droppableContainers: args.droppableContainers.filter(
      (c) => c.id !== CANVAS_ID,
    ),
  })
}

interface BuilderProps {
  /** Persist the form to localStorage between reloads. Defaults to true. */
  persist?: boolean
}

export function Builder({ persist = true }: BuilderProps) {
  const { state, dispatch, selectedField, issues, generated } = useFormBuilder({
    persist,
  })
  const { form, selectedId } = state

  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null)
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null)
  const [panelTab, setPanelTab] = useState<PanelTab>("schema")

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const selectField = useCallback(
    (id: string | null) => {
      dispatch({ type: "selectField", id })
      if (id) setPanelTab("field")
    },
    [dispatch],
  )

  const addField = useCallback(
    (fieldType: FieldType) => {
      const selectedIndex = form.fields.findIndex((f) => f.id === selectedId)
      dispatch({
        type: "addField",
        fieldType,
        index: selectedIndex === -1 ? undefined : selectedIndex + 1,
      })
      setPanelTab("field")
    },
    [dispatch, form.fields, selectedId],
  )

  const handleDragStart = ({ active }: DragStartEvent) => {
    const data = dragData(active)
    if (data?.kind === "palette") {
      setActiveDrag({ kind: "palette", fieldType: data.fieldType })
      return
    }
    const field = form.fields.find((f) => f.id === active.id)
    if (field) setActiveDrag({ kind: "field", field })
  }

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (dragData(active)?.kind !== "palette") return
    setDropIndicator(
      over ? resolveDrop(active, over, form.fields).indicator : null,
    )
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const data = dragData(active)
    setActiveDrag(null)
    setDropIndicator(null)
    if (!over) return

    if (data?.kind === "palette") {
      const { index } = resolveDrop(active, over, form.fields)
      dispatch({ type: "addField", fieldType: data.fieldType, index })
      setPanelTab("field")
      return
    }

    if (over.id === active.id) return
    const from = form.fields.findIndex((f) => f.id === active.id)
    const to = form.fields.findIndex((f) => f.id === over.id)
    if (from !== -1 && to !== -1) dispatch({ type: "moveField", from, to })
  }

  const handleDragCancel = () => {
    setActiveDrag(null)
    setDropIndicator(null)
  }

  const announcements = useMemo<Announcements>(() => {
    const describe = (id: UniqueIdentifier, data: unknown) => {
      const d = data as { kind?: string; fieldType?: FieldType } | undefined
      if (d?.kind === "palette" && d.fieldType) {
        return `new ${fieldTypeMeta(d.fieldType).label} field`
      }
      const field = form.fields.find((f) => f.id === id)
      return field ? `field ${field.label}` : "item"
    }
    const describeOver = (id: UniqueIdentifier) => {
      if (id === CANVAS_ID) return "the end of the form"
      const index = form.fields.findIndex((f) => f.id === id)
      return index === -1
        ? "the form"
        : `position ${index + 1} of ${form.fields.length}`
    }
    return {
      onDragStart: ({ active }) =>
        `Picked up ${describe(active.id, active.data.current)}.`,
      onDragOver: ({ active, over }) =>
        over
          ? `${describe(active.id, active.data.current)} is over ${describeOver(over.id)}.`
          : `${describe(active.id, active.data.current)} is no longer over a drop area.`,
      onDragEnd: ({ active, over }) =>
        over
          ? `${describe(active.id, active.data.current)} was dropped at ${describeOver(over.id)}.`
          : `${describe(active.id, active.data.current)} was dropped.`,
      onDragCancel: ({ active }) =>
        `Dragging ${describe(active.id, active.data.current)} was cancelled.`,
    }
  }, [form.fields])

  const clearForm = () => {
    if (form.fields.length === 0) return
    if (window.confirm("Remove all fields from this form?")) {
      dispatch({ type: "clearForm" })
    }
  }

  const selectedIssues = selectedField
    ? issues.filter((i) => i.fieldId === selectedField.id)
    : []

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      accessibility={{ announcements }}
    >
      <div className={styles.app}>
        <header className={styles.topbar}>
          <h1 className={styles.brand}>Form Builder</h1>
          <span className={styles.meta}>
            {form.fields.length} {form.fields.length === 1 ? "field" : "fields"}
          </span>
          <div className={styles.topbarActions}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() =>
                dispatch({ type: "replaceForm", form: createSampleForm() })
              }
            >
              Load sample
            </button>
            <button
              type="button"
              className="btn btn-sm btn-danger"
              onClick={clearForm}
              disabled={form.fields.length === 0}
            >
              <Icon name="trash" size={14} />
              Clear
            </button>
          </div>
        </header>

        <div className={styles.body}>
          <aside className={styles.paletteColumn} aria-label="Field palette">
            <Palette onAdd={addField} />
          </aside>

          <main className={styles.canvasColumn}>
            <Canvas
              form={form}
              selectedId={selectedId}
              issues={issues}
              dropIndicator={dropIndicator}
              isPaletteDragging={activeDrag?.kind === "palette"}
              onSelect={selectField}
              onUpdateForm={(patch) => dispatch({ type: "updateForm", patch })}
              onMove={(from, to) => dispatch({ type: "moveField", from, to })}
              onDuplicate={(id) => dispatch({ type: "duplicateField", id })}
              onRemove={(id) => dispatch({ type: "removeField", id })}
              onLoadSample={() =>
                dispatch({ type: "replaceForm", form: createSampleForm() })
              }
            />
          </main>

          <aside className={styles.sideColumn} aria-label="Inspector">
            <div className={styles.tabs} role="tablist">
              <button
                type="button"
                role="tab"
                id="tab-field"
                aria-selected={panelTab === "field"}
                aria-controls="panel-field"
                className={cx(
                  styles.tab,
                  panelTab === "field" && styles.tabActive,
                )}
                onClick={() => setPanelTab("field")}
              >
                Field
              </button>
              <button
                type="button"
                role="tab"
                id="tab-schema"
                aria-selected={panelTab === "schema"}
                aria-controls="panel-schema"
                className={cx(
                  styles.tab,
                  panelTab === "schema" && styles.tabActive,
                )}
                onClick={() => setPanelTab("schema")}
              >
                Schema
                {issues.length > 0 && (
                  <span
                    className={styles.tabBadge}
                    aria-label={`${issues.length} issues`}
                  >
                    {issues.length}
                  </span>
                )}
              </button>
            </div>
            <div
              className={styles.panelBody}
              role="tabpanel"
              id={panelTab === "field" ? "panel-field" : "panel-schema"}
              aria-labelledby={
                panelTab === "field" ? "tab-field" : "tab-schema"
              }
            >
              {panelTab === "field" ? (
                <PropertiesPanel
                  field={selectedField}
                  issues={selectedIssues}
                  onChange={(patch) =>
                    selectedField &&
                    dispatch({
                      type: "updateField",
                      id: selectedField.id,
                      patch,
                    })
                  }
                  onSetOptions={(options) =>
                    selectedField &&
                    dispatch({
                      type: "setOptions",
                      id: selectedField.id,
                      options,
                    })
                  }
                  onDuplicate={() =>
                    selectedField &&
                    dispatch({ type: "duplicateField", id: selectedField.id })
                  }
                  onRemove={() =>
                    selectedField &&
                    dispatch({ type: "removeField", id: selectedField.id })
                  }
                />
              ) : (
                <SchemaOutput
                  form={form}
                  generated={generated}
                  issues={issues}
                  onSelectField={selectField}
                />
              )}
            </div>
          </aside>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDrag?.kind === "palette" && (
          <PaletteItemGhost type={activeDrag.fieldType} />
        )}
        {activeDrag?.kind === "field" && (
          <FieldCard field={activeDrag.field} className={styles.dragGhost} />
        )}
      </DragOverlay>
    </DndContext>
  )
}
