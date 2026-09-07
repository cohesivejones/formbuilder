import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import type { FieldTypeRegistry } from "../model/registry"
import type { FormDefinition, FormField } from "../model/types"
import { validateForm } from "../model/validate"
import { toJsonSchema } from "../schema/toJsonSchema"
import { createBuilderReducer, emptyForm, type BuilderAction } from "./reducer"

const STORAGE_KEY = "formbuilder.form.v2"

export interface UseFormBuilderOptions {
  registry: FieldTypeRegistry
  /** Controlled form. When set, every change is reported via `onChange` and the host owns the state. */
  value?: FormDefinition
  /** Initial form for the uncontrolled mode. */
  defaultValue?: FormDefinition
  onChange?: (form: FormDefinition) => void
  /** Uncontrolled mode only: keep the form in localStorage across reloads. */
  persist?: boolean
}

/**
 * Owns builder state and derives everything the UI needs from it: the selected
 * field, validation issues and the generated schema. Works controlled (`value`
 * + `onChange`) for hosts that store the form themselves, or uncontrolled.
 */
export function useFormBuilder({
  registry,
  value,
  defaultValue,
  onChange,
  persist = false,
}: UseFormBuilderOptions) {
  const controlled = value !== undefined

  const [internalForm, setInternalForm] = useState<FormDefinition>(
    () => (persist ? loadForm() : undefined) ?? defaultValue ?? emptyForm(),
  )
  const [rawSelectedId, setSelectedId] = useState<string | null>(null)
  const form = controlled ? value : internalForm
  // A selection only counts while its field exists (the host may replace the form).
  const selectedId =
    rawSelectedId && form.fields.some((f) => f.id === rawSelectedId)
      ? rawSelectedId
      : null

  const reducer = useMemo(() => createBuilderReducer(registry), [registry])

  // Latest values for dispatch, so several dispatches in one tick compose
  // correctly and the controlled value is always the base for the next change.
  const formRef = useRef(form)
  const selectedRef = useRef(selectedId)
  const onChangeRef = useRef(onChange)
  useLayoutEffect(() => {
    formRef.current = form
    selectedRef.current = selectedId
    onChangeRef.current = onChange
  })

  const dispatch = useCallback(
    (action: BuilderAction) => {
      const next = reducer(
        { form: formRef.current, selectedId: selectedRef.current },
        action,
      )
      if (next.form !== formRef.current) {
        formRef.current = next.form
        if (!controlled) setInternalForm(next.form)
        onChangeRef.current?.(next.form)
      }
      if (next.selectedId !== selectedRef.current) {
        selectedRef.current = next.selectedId
        setSelectedId(next.selectedId)
      }
    },
    [reducer, controlled],
  )

  useEffect(() => {
    if (persist && !controlled) saveForm(form)
  }, [persist, controlled, form])

  const selectedField = useMemo(
    () => form.fields.find((f) => f.id === selectedId) ?? null,
    [form.fields, selectedId],
  )
  const issues = useMemo(() => validateForm(form, registry), [form, registry])
  const generated = useMemo(
    () => toJsonSchema(form, registry),
    [form, registry],
  )

  return { form, selectedId, selectedField, dispatch, issues, generated }
}

function loadForm(): FormDefinition | undefined {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as Partial<FormDefinition>
    if (!parsed || !Array.isArray(parsed.fields)) return undefined
    const fields = (parsed.fields as Partial<FormField>[])
      .filter((f) => typeof f?.type === "string" && typeof f.id === "string")
      .map((f): FormField => ({
        id: f.id as string,
        type: f.type as string,
        key: typeof f.key === "string" ? f.key : "",
        autoKey: f.autoKey ?? false,
        label: typeof f.label === "string" ? f.label : "",
        description: f.description,
        required: f.required ?? false,
        props:
          f.props && typeof f.props === "object" && !Array.isArray(f.props)
            ? f.props
            : {},
        ...(f.locks ? { locks: f.locks } : {}),
      }))
    return {
      title: typeof parsed.title === "string" ? parsed.title : "Untitled form",
      description:
        typeof parsed.description === "string" ? parsed.description : "",
      fields,
    }
  } catch {
    return undefined
  }
}

function saveForm(form: FormDefinition) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(form))
  } catch {
    // Storage may be unavailable (private mode, quota); the builder still works.
  }
}
