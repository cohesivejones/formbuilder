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
import { builtInFieldTypes } from "../fieldTypes/builtIns"
import type { FieldTypeDefinition } from "../model/fieldType"
import { createRegistry } from "../model/registry"
import type { FormDefinition } from "../model/types"
import { canAddField } from "../state/reducer"
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
import { FieldTypesProvider } from "./FieldTypesProvider"
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

export interface BuilderProps {
  /**
   * Field types available in the palette. Defaults to the built-in set. Pass a
   * stable (module-level or memoised) array: a new array each render rebuilds
   * the registry.
   */
  fieldTypes?: readonly FieldTypeDefinition[]
  /** Controlled form. The host owns the state and receives every change via `onChange`. */
  value?: FormDefinition
  /** Initial form when uncontrolled. */
  defaultValue?: FormDefinition
  onChange?: (form: FormDefinition) => void
  /** Uncontrolled only: keep the form in localStorage across reloads. */
  persist?: boolean
  /** Show the JSON Schema output tab. Hosts with their own storage shape can hide it. */
  showSchema?: boolean
  /** Enables the "Load sample" action, producing a form to start from. */
  sample?: () => FormDefinition
  /** Heading shown in the top bar. */
  title?: string
}

export function Builder({
  fieldTypes = builtInFieldTypes,
  value,
  defaultValue,
  onChange,
  persist = false,
  showSchema = true,
  sample,
  title = "Form Builder",
}: BuilderProps) {
  const registry = useMemo(() => createRegistry(fieldTypes), [fieldTypes])
  const { form, selectedId, selectedField, dispatch, issues, generated } =
    useFormBuilder({ registry, value, defaultValue, onChange, persist })

  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null)
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null)
  const [panelTab, setPanelTab] = useState<PanelTab>(
    showSchema ? "schema" : "field",
  )
  const activeTab: PanelTab = showSchema ? panelTab : "field"

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
    (fieldType: string, index?: number) => {
      if (!canAddField(registry, form, fieldType)) return
      const selectedIndex = form.fields.findIndex((f) => f.id === selectedId)
      dispatch({
        type: "addField",
        fieldType,
        index: index ?? (selectedIndex === -1 ? undefined : selectedIndex + 1),
      })
      setPanelTab("field")
    },
    [dispatch, form, registry, selectedId],
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
      addField(data.fieldType, index)
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
      const d = data as { kind?: string; fieldType?: string } | undefined
      if (d?.kind === "palette" && d.fieldType) {
        return `new ${registry.resolve(d.fieldType).label} field`
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
  }, [form.fields, registry])

  const removableCount = form.fields.filter((f) => !f.locks?.remove).length

  const clearForm = () => {
    if (removableCount === 0) return
    if (window.confirm("Remove all fields from this form?")) {
      dispatch({ type: "clearForm" })
    }
  }

  const loadSample = sample
    ? () => dispatch({ type: "replaceForm", form: sample() })
    : undefined

  const selectedIssues = selectedField
    ? issues.filter((i) => i.fieldId === selectedField.id)
    : []

  return (
    <FieldTypesProvider registry={registry}>
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
            <h1 className={styles.brand}>{title}</h1>
            <span className={styles.meta}>
              {form.fields.length}{" "}
              {form.fields.length === 1 ? "field" : "fields"}
            </span>
            <div className={styles.topbarActions}>
              {loadSample && (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={loadSample}
                >
                  Load sample
                </button>
              )}
              <button
                type="button"
                className="btn btn-sm btn-danger"
                onClick={clearForm}
                disabled={removableCount === 0}
              >
                <Icon name="trash" size={14} />
                Clear
              </button>
            </div>
          </header>

          <div className={styles.body}>
            <aside className={styles.paletteColumn} aria-label="Field palette">
              <Palette form={form} onAdd={(type) => addField(type)} />
            </aside>

            <main className={styles.canvasColumn}>
              <Canvas
                form={form}
                selectedId={selectedId}
                issues={issues}
                dropIndicator={dropIndicator}
                isPaletteDragging={activeDrag?.kind === "palette"}
                onSelect={selectField}
                onUpdateForm={(patch) =>
                  dispatch({ type: "updateForm", patch })
                }
                onMove={(from, to) => dispatch({ type: "moveField", from, to })}
                onDuplicate={(id) => dispatch({ type: "duplicateField", id })}
                onRemove={(id) => dispatch({ type: "removeField", id })}
                onLoadSample={loadSample}
              />
            </main>

            <aside className={styles.sideColumn} aria-label="Inspector">
              {showSchema && (
                <div className={styles.tabs} role="tablist">
                  <button
                    type="button"
                    role="tab"
                    id="tab-field"
                    aria-selected={activeTab === "field"}
                    aria-controls="panel-field"
                    className={cx(
                      styles.tab,
                      activeTab === "field" && styles.tabActive,
                    )}
                    onClick={() => setPanelTab("field")}
                  >
                    Field
                  </button>
                  <button
                    type="button"
                    role="tab"
                    id="tab-schema"
                    aria-selected={activeTab === "schema"}
                    aria-controls="panel-schema"
                    className={cx(
                      styles.tab,
                      activeTab === "schema" && styles.tabActive,
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
              )}
              <div
                className={styles.panelBody}
                role={showSchema ? "tabpanel" : undefined}
                id={activeTab === "field" ? "panel-field" : "panel-schema"}
                aria-labelledby={
                  showSchema
                    ? activeTab === "field"
                      ? "tab-field"
                      : "tab-schema"
                    : undefined
                }
              >
                {activeTab === "field" ? (
                  <PropertiesPanel
                    field={selectedField}
                    issues={selectedIssues}
                    canDuplicate={
                      selectedField
                        ? canAddField(registry, form, selectedField.type)
                        : false
                    }
                    onChange={(patch) =>
                      selectedField &&
                      dispatch({
                        type: "updateField",
                        id: selectedField.id,
                        patch,
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
    </FieldTypesProvider>
  )
}
