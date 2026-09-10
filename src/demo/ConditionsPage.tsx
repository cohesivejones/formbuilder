import { useMemo, useState } from "react"
import {
  FormRenderer,
  printCondition,
  type FormDefinition,
  type FormField,
  type SubmissionData,
} from "../builder"
import { createConditionsForm } from "../examples/conditionsForm"
import styles from "./ConditionsPage.module.css"

/**
 * Conditional logic, live: the form on the left reacts to its own answers,
 * the sidebar shows the rules exactly as they are written on the fields.
 */
export function ConditionsPage() {
  const form = useMemo(() => createConditionsForm(), [])
  const [submission, setSubmission] = useState<SubmissionData | null>(null)

  const ruled = form.fields.filter((f) => f.visibleWhen || f.requiredWhen)

  return (
    <div className={styles.page}>
      <main className={styles.preview}>
        <FormRenderer form={form} onSubmit={setSubmission} />
      </main>

      <aside className={styles.sidebar} aria-label="The rules">
        <h2 className={styles.heading}>The rules</h2>
        <p className={styles.hint}>
          Each rule lives on its field as data and is written in the condition
          language. Try it: choose "Please phone me", tick the allergies box, or
          pick "Something else" under services.
        </p>

        <ul className={styles.ruleList}>
          {ruled.map((field) => (
            <RuleCard key={field.id} field={field} fields={form.fields} />
          ))}
        </ul>

        <p className={styles.hint}>
          Rules are edited per field in the full builder, under Conditions. A
          hidden field keeps its answer on screen but never submits it, and a
          printed copy shows every question with a note saying when it applies.
        </p>

        {submission && (
          <section className={styles.result}>
            <h3 className={styles.resultTitle}>Submitted answers</h3>
            <p className={styles.hint}>
              Note what is absent: answers to hidden questions do not leave the
              form.
            </p>
            <pre className={styles.code} data-testid="conditions-submission">
              <code>{JSON.stringify(submission, null, 2)}</code>
            </pre>
          </section>
        )}
      </aside>
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
