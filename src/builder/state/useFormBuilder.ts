import { useEffect, useMemo, useReducer } from "react"
import type { FormDefinition, FormField } from "../model/types"
import { validateForm } from "../model/validate"
import { toJsonSchema } from "../schema/toJsonSchema"
import { builderReducer, initialState } from "./reducer"

const STORAGE_KEY = "formbuilder.form.v1"

function loadForm(): FormDefinition | undefined {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as Partial<FormDefinition>
    if (!parsed || !Array.isArray(parsed.fields)) return undefined
    return {
      title: typeof parsed.title === "string" ? parsed.title : "Untitled form",
      description:
        typeof parsed.description === "string" ? parsed.description : "",
      fields: parsed.fields as FormField[],
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

/**
 * Owns builder state and derives everything the UI needs from it:
 * the selected field, validation issues, and the generated schema.
 * The form is persisted to localStorage so a reload doesn't lose work.
 */
export function useFormBuilder(options: { persist?: boolean } = {}) {
  const persist = options.persist ?? true
  const [state, dispatch] = useReducer(builderReducer, undefined, () =>
    initialState(persist ? loadForm() : undefined),
  )

  useEffect(() => {
    if (persist) saveForm(state.form)
  }, [persist, state.form])

  const selectedField = useMemo(
    () => state.form.fields.find((f) => f.id === state.selectedId) ?? null,
    [state.form.fields, state.selectedId],
  )

  const issues = useMemo(() => validateForm(state.form), [state.form])
  const generated = useMemo(() => toJsonSchema(state.form), [state.form])

  return { state, dispatch, selectedField, issues, generated }
}
