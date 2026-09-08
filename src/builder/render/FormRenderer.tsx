import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react"
import { builtInFieldTypes } from "../fieldTypes/builtIns"
import type { FieldTypeDefinition } from "../model/fieldType"
import { createRegistry, type FieldTypeRegistry } from "../model/registry"
import type { FormDefinition, FormField } from "../model/types"
import { toJsonSchema } from "../schema/toJsonSchema"
import { cx } from "../components/cx"
import {
  createSubmissionValidator,
  prune,
  type SubmissionData,
  type SubmissionErrors,
} from "./validateSubmission"
import styles from "./FormRenderer.module.css"

export interface FormRendererProps {
  form: FormDefinition
  /** Must include every type the form uses. Defaults to the built-ins. */
  fieldTypes?: readonly FieldTypeDefinition[]
  /** Called with the pruned answers once they satisfy the generated schema. */
  onSubmit?: (data: SubmissionData) => void
  submitLabel?: string
  /**
   * Offer a Print action, which is also how every browser saves a PDF. Prints
   * the form alone: blank if untouched, filled in if answered. Turn it off when
   * the host provides its own print control.
   */
  printable?: boolean
}

/**
 * Renders a form definition as a working form.
 *
 * Answers are validated against the JSON Schema the builder emits for this same
 * definition, so what a respondent is held to is exactly what the schema says.
 * Errors appear once a field has been left, or on every field after a failed
 * submit.
 */
export function FormRenderer({
  form,
  fieldTypes = builtInFieldTypes,
  onSubmit,
  submitLabel = "Submit",
  printable = true,
}: FormRendererProps) {
  const registry = useMemo(() => createRegistry(fieldTypes), [fieldTypes])
  const [values, setValues] = useState<SubmissionData>(() =>
    initialValues(form, registry),
  )
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [failures, setFailures] = useState(0)
  const summaryRef = useRef<HTMLDivElement>(null)

  const validate = useMemo(() => {
    const { schema } = toJsonSchema(form, registry)
    return createSubmissionValidator(schema)
  }, [form, registry])

  const errors: SubmissionErrors = useMemo(
    () => validate(values),
    [validate, values],
  )

  const setValue = useCallback((key: string, value: unknown) => {
    setSubmitted(false)
    setValues((current) => ({ ...current, [key]: value }))
  }, [])

  // Take the respondent to the summary so they hear what went wrong and can
  // work down the list, rather than hunting for the fields that failed.
  useEffect(() => {
    if (failures > 0) summaryRef.current?.focus()
  }, [failures])

  const reset = () => {
    setValues(initialValues(form, registry))
    setSubmitAttempted(false)
    setSubmitted(false)
    setFailures(0)
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setSubmitAttempted(true)
    if (Object.keys(errors).length > 0) {
      setSubmitted(false)
      setFailures((n) => n + 1)
      return
    }
    setSubmitted(true)
    onSubmit?.(prune(values))
  }

  /**
   * Errors stay hidden until the respondent tries to submit, then update live
   * as each one is fixed. Revealing them on blur instead would grow the form
   * under the pointer at the moment of a click, which silently swallows it.
   */
  const visibleErrors = submitAttempted
    ? form.fields.filter((f) => errors[f.key])
    : []

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <header className={styles.header}>
        <h2 className={styles.title}>{form.title || "Untitled form"}</h2>
        {form.description && <p className={styles.intro}>{form.description}</p>}
      </header>

      {visibleErrors.length > 0 && (
        <div
          className={styles.summary}
          role="alert"
          tabIndex={-1}
          ref={summaryRef}
        >
          <p className={styles.summaryTitle}>
            {visibleErrors.length === 1
              ? "There is 1 answer to fix"
              : `There are ${visibleErrors.length} answers to fix`}
          </p>
          <ul className={styles.summaryList}>
            {visibleErrors.map((f) => (
              <li key={f.id}>
                <span className={styles.summaryField}>{f.label || f.key}</span>
                {": "}
                {errors[f.key]}
              </li>
            ))}
          </ul>
        </div>
      )}

      {form.fields.length === 0 && (
        <p className={styles.blank}>This form has no fields.</p>
      )}

      {form.fields.map((field) => (
        <RenderedField
          key={field.id}
          field={field}
          registry={registry}
          value={values[field.key]}
          error={submitAttempted ? errors[field.key] : undefined}
          onChange={(value) => setValue(field.key, value)}
        />
      ))}

      {form.fields.length > 0 && (
        <div className={styles.actions}>
          <button type="submit" className="btn btn-primary">
            {submitLabel}
          </button>
          <button type="button" className="btn" onClick={reset}>
            Reset
          </button>
          {printable && (
            <button
              type="button"
              className="btn"
              onClick={() => window.print()}
            >
              Print
            </button>
          )}
          {submitted && (
            <span className={styles.submitted} role="status">
              Submitted
            </span>
          )}
        </div>
      )}
    </form>
  )
}

interface RenderedFieldProps {
  field: FormField
  registry: FieldTypeRegistry
  value: unknown
  error: string | undefined
  onChange: (value: unknown) => void
}

function RenderedField({
  field,
  registry,
  value,
  error,
  onChange,
}: RenderedFieldProps) {
  const reactId = useId()
  const controlId = `${reactId}-control`
  const helpId = `${reactId}-help`
  const errorId = `${reactId}-error`
  const definition = registry.resolve(field.type)

  if (!registry.has(field.type)) {
    return (
      <div className={styles.field}>
        <p className={styles.unsupported}>
          This form uses a field type this renderer does not know about
          {": "}
          <code>{field.type}</code>
        </p>
      </div>
    )
  }

  const Input = definition.Input
  const help = field.description
  const describedBy =
    [help ? helpId : null, error ? errorId : null].filter(Boolean).join(" ") ||
    undefined

  // A field that collects nothing still belongs on the page: show whatever the
  // type renders read-only, which is how a placeholder explains itself.
  if (!Input) {
    const Preview = definition.Preview
    return (
      <div className={styles.field}>
        {Preview && <Preview field={field} />}
        {help && <p className={styles.help}>{help}</p>}
      </div>
    )
  }

  const labelMode = definition.labelMode ?? "control"
  const labelText = (
    <>
      {field.label}
      {field.required && (
        <span className={styles.required} aria-hidden="true">
          {" *"}
        </span>
      )}
    </>
  )

  const control = (
    <Input
      field={field}
      value={value}
      onChange={onChange}
      id={controlId}
      describedBy={describedBy}
      invalid={Boolean(error)}
    />
  )

  const body = (
    <>
      {help && (
        <p id={helpId} className={styles.help}>
          {help}
        </p>
      )}
      {control}
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </>
  )

  if (labelMode === "group") {
    return (
      <fieldset className={cx(styles.field, styles.group)}>
        <legend className={styles.legend}>{labelText}</legend>
        {body}
      </fieldset>
    )
  }

  if (labelMode === "inline") {
    return (
      <div className={styles.field}>
        <div className={styles.inline}>
          {control}
          <label htmlFor={controlId} className={styles.inlineLabel}>
            {labelText}
          </label>
        </div>
        {help && (
          <p id={helpId} className={styles.help}>
            {help}
          </p>
        )}
        {error && (
          <p id={errorId} className={styles.error}>
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className={styles.field}>
      <label htmlFor={controlId} className={styles.label}>
        {labelText}
      </label>
      {body}
    </div>
  )
}

function initialValues(
  form: FormDefinition,
  registry: FieldTypeRegistry,
): SubmissionData {
  const values: SubmissionData = {}
  for (const field of form.fields) {
    const definition = registry.resolve(field.type)
    if (!definition.Input) continue
    const initial = definition.initialValue?.(field)
    if (initial !== undefined) values[field.key] = initial
  }
  return values
}
