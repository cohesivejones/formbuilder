import { useState } from "react"
import {
  FormRenderer,
  readPersistedForm,
  type FormDefinition,
  type SubmissionData,
} from "../builder"
import { createSampleForm } from "../builder/model/sample"
import { lockedDownFieldTypes } from "../examples/lockedDownForm"
import { parseFormDefinition } from "./parseFormDefinition"
import styles from "./RendererPage.module.css"

const PLACEHOLDER = `{
  "title": "…",
  "fields": [ … ]
}`

/**
 * The other half of the builder: a form definition rendered as a working form.
 *
 * Answers are checked against the JSON Schema generated from the very same
 * definition, so this page doubles as a demonstration that the emitted schema
 * is real rather than decorative.
 */
export function RendererPage() {
  const [form, setForm] = useState<FormDefinition>(createSampleForm)
  const [draft, setDraft] = useState(() => toJson(createSampleForm()))
  const [error, setError] = useState<string | null>(null)
  const [submission, setSubmission] = useState<SubmissionData | null>(null)

  const load = (next: FormDefinition) => {
    setForm(next)
    setDraft(toJson(next))
    setError(null)
    setSubmission(null)
  }

  const apply = () => {
    const result = parseFormDefinition(draft)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setForm(result.form)
    setError(null)
    setSubmission(null)
  }

  const loadFromBuilder = () => {
    const saved = readPersistedForm()
    if (!saved) {
      setError(
        "The builder has not saved a form yet. Open the full builder first.",
      )
      return
    }
    load(saved)
  }

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar} aria-label="Form definition">
        <h2 className={styles.heading}>Form definition</h2>
        <p className={styles.hint}>
          Paste a definition, or pull in whatever the full builder last saved.
        </p>

        <div className={styles.buttons}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={loadFromBuilder}
          >
            Load from builder
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => load(createSampleForm())}
          >
            Load sample
          </button>
        </div>

        <label className="visually-hidden" htmlFor="definition-json">
          Form definition JSON
        </label>
        <textarea
          id="definition-json"
          className={styles.editor}
          value={draft}
          spellCheck={false}
          placeholder={PLACEHOLDER}
          aria-invalid={error ? true : undefined}
          onChange={(event) => {
            setDraft(event.target.value)
            setError(null)
          }}
        />

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <button type="button" className="btn btn-primary" onClick={apply}>
          Render this form
        </button>

        {submission && (
          <section className={styles.result}>
            <h3 className={styles.resultTitle}>Submitted answers</h3>
            <pre className={styles.code}>
              <code>{JSON.stringify(submission, null, 2)}</code>
            </pre>
          </section>
        )}
      </aside>

      <main className={styles.preview}>
        <FormRenderer
          key={formKey(form)}
          form={form}
          fieldTypes={lockedDownFieldTypes}
          onSubmit={setSubmission}
        />
      </main>
    </div>
  )
}

function toJson(form: FormDefinition): string {
  return JSON.stringify(form, null, 2)
}

/** Loading a different definition starts a fresh set of answers. */
function formKey(form: FormDefinition): string {
  return form.fields.map((f) => f.id).join("|")
}
