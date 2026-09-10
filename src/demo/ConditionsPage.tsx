import { useState } from "react"
import {
  Builder,
  FormRenderer,
  printCondition,
  type FormDefinition,
  type FormField,
  type SubmissionData,
} from "../builder"
import { cx } from "../builder/components/cx"
import { createConditionsForm } from "../examples/conditionsForm"
import styles from "./ConditionsPage.module.css"

type View = "try" | "edit"

/**
 * Conditional logic from both sides of the fence, over one definition held in
 * page state. "Try the form" fills it in and watches fields come and go;
 * "Edit the rules" is the real builder, where each rule is written in the
 * expression language under the field's Conditions section. An edit in one
 * view is live in the other.
 */
export function ConditionsPage() {
  const [form, setForm] = useState<FormDefinition>(createConditionsForm)
  const [view, setView] = useState<View>("try")
  const [submission, setSubmission] = useState<SubmissionData | null>(null)

  const ruled = form.fields.filter((f) => f.visibleWhen || f.requiredWhen)

  return (
    <div className={styles.shell}>
      <div className={styles.viewBar}>
        <div className={styles.segmented} role="tablist" aria-label="View">
          <button
            type="button"
            role="tab"
            aria-selected={view === "try"}
            className={cx(
              styles.segment,
              view === "try" && styles.segmentActive,
            )}
            onClick={() => setView("try")}
          >
            Try the form
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "edit"}
            className={cx(
              styles.segment,
              view === "edit" && styles.segmentActive,
            )}
            onClick={() => setView("edit")}
          >
            Edit the rules
          </button>
        </div>
        <span className={styles.viewHint}>
          {view === "try"
            ? "One definition drives both views: rules edited over there apply here at once."
            : "Select a field and write its rules under Conditions, in the expression language."}
        </span>
      </div>

      {view === "edit" ? (
        <div className={styles.builder}>
          <Builder value={form} onChange={setForm} title="Conditional logic" />
        </div>
      ) : (
        <div className={styles.page}>
          <main className={styles.preview}>
            <FormRenderer form={form} onSubmit={setSubmission} />
          </main>

          <aside className={styles.sidebar} aria-label="The rules">
            <h2 className={styles.heading}>The rules</h2>
            <p className={styles.hint}>
              Each rule lives on its field as data and is written in the
              condition language. Try it: choose "Please phone me", tick the
              allergies box, or pick "Something else" under services.
            </p>

            <ul className={styles.ruleList}>
              {ruled.map((field) => (
                <RuleCard key={field.id} field={field} fields={form.fields} />
              ))}
            </ul>

            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setView("edit")}
            >
              Edit these rules in the builder
            </button>

            {ruled[0] && (
              <details className={styles.stored}>
                <summary className={styles.storedSummary}>
                  How a rule is stored
                </summary>
                <p className={styles.hint}>
                  Rules live on their field inside the form definition as
                  condition trees referencing other fields by stable id — the
                  expression text is only how they are edited, so this is what
                  persists, exports and reaches a server:
                </p>
                <pre className={styles.code} data-testid="stored-rule">
                  <code>{JSON.stringify(ruled[0], null, 2)}</code>
                </pre>
              </details>
            )}
            <p className={styles.hint}>
              A hidden field keeps its answer on screen but never submits it,
              and a printed copy shows every question with a note saying when it
              applies.
            </p>

            {submission && (
              <section className={styles.result}>
                <h3 className={styles.resultTitle}>Submitted answers</h3>
                <p className={styles.hint}>
                  Note what is absent: answers to hidden questions do not leave
                  the form.
                </p>
                <pre
                  className={styles.code}
                  data-testid="conditions-submission"
                >
                  <code>{JSON.stringify(submission, null, 2)}</code>
                </pre>
              </section>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}

function RuleCard({
  field,
  fields,
}: {
  field: FormField
  fields: FormDefinition["fields"]
}) {
  return (
    <li className={styles.ruleCard}>
      <span className={styles.ruleField}>{field.label || field.key}</span>
      {field.visibleWhen && (
        <span className={styles.ruleLine}>
          <span className={styles.ruleKind}>visible when</span>
          <code>{printCondition(field.visibleWhen, fields)}</code>
        </span>
      )}
      {field.requiredWhen && (
        <span className={styles.ruleLine}>
          <span className={styles.ruleKind}>required when</span>
          <code>{printCondition(field.requiredWhen, fields)}</code>
        </span>
      )}
    </li>
  )
}
