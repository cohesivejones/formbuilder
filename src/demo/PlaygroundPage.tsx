import { useMemo, useState } from "react"
import {
  builtInFieldTypes,
  conditionToSchema,
  conditionWithKeys,
  createRegistry,
  evaluateCondition,
  parseCondition,
  type Condition,
  type FormField,
  FULL_PERMISSIONS,
} from "../builder"
import { BuilderProvider } from "../builder/components/BuilderProvider"
import { ConditionInput } from "../builder/components/ConditionInput"
import { createConditionsForm } from "../examples/conditionsForm"
import styles from "./PlaygroundPage.module.css"

const registry = createRegistry(builtInFieldTypes)

/** A stand-in for "the field this rule belongs to"; it owns no key, so it can
 * never be referenced and self-reference checks stay inert. */
const PLAYGROUND_FIELD: FormField = {
  id: "__playground__",
  type: "text",
  key: "",
  autoKey: false,
  label: "Playground",
  required: false,
  props: {},
}

const PRESETS = [
  "contactMethod = 'phone'",
  "hasAllergies = true and householdSize >= 3",
  // The same clauses twice: and binds tighter than or, parentheses regroup.
  "services contains 'other' and contactMethod = 'phone' or finalComments contains 'urgent'",
  "services contains 'other' and (contactMethod = 'phone' or finalComments contains 'urgent')",
]

const DEFAULT_ANSWERS = `{
  "contactMethod": "phone",
  "hasAllergies": true,
  "householdSize": 2,
  "services": ["counselling", "other"],
  "finalComments": "nothing urgent"
}`

/**
 * The condition language, taken apart: one expression shown as what it parses
 * to, what it compiles to, and what it decides against sample answers. The
 * input is the same component the inspector uses, so completions and the
 * semantic checks behave identically here.
 */
export function PlaygroundPage() {
  const fields = useMemo(() => createConditionsForm().fields, [])
  const [condition, setCondition] = useState<Condition | null>(() => {
    const seed = parseCondition(PRESETS[2], { fields })
    return seed.ok ? seed.condition : null
  })
  const [answersText, setAnswersText] = useState(DEFAULT_ANSWERS)
  // Remounting the input is how a preset replaces its draft.
  const [inputVersion, setInputVersion] = useState(0)

  const loadPreset = (text: string) => {
    const result = parseCondition(text, { fields })
    if (result.ok) {
      setCondition(result.condition)
      setInputVersion((v) => v + 1)
    }
  }

  const answers = useMemo(() => {
    try {
      const parsed: unknown = JSON.parse(answersText)
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        return { error: "Answers must be a JSON object keyed by field key." }
      }
      return { data: parsed as Record<string, unknown> }
    } catch (error) {
      return { error: `Not valid JSON: ${(error as Error).message}` }
    }
  }, [answersText])

  const verdict =
    condition && answers.data
      ? evaluateCondition(
          condition,
          answers.data,
          new Map(fields.filter((f) => f.key).map((f) => [f.id, f.key])),
        )
      : null

  const schemaFragment = useMemo(() => {
    if (!condition) return null
    return conditionToSchema(condition, {
      keyOf: (id) => fields.find((f) => f.id === id)?.key || undefined,
      isArrayField: (id) => {
        const target = fields.find((f) => f.id === id)
        if (!target) return false
        return (
          registry.resolve(target.type).toJsonSchema?.(target)?.type === "array"
        )
      },
    })
  }, [condition, fields])

  return (
    <div className={styles.page}>
      <section className={styles.column} aria-label="Write a condition">
        <h2 className={styles.heading}>Write a condition</h2>

        <BuilderProvider registry={registry} permissions={FULL_PERMISSIONS}>
          <ConditionInput
            key={inputVersion}
            label="Expression"
            help="Referencing the fields below. Completions appear as you type a field name."
            field={PLAYGROUND_FIELD}
            fields={fields}
            value={condition ?? undefined}
            disabled={false}
            onChange={setCondition}
          />
        </BuilderProvider>

        <div className={styles.presets}>
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className={styles.preset}
              onClick={() => loadPreset(preset)}
            >
              {preset}
            </button>
          ))}
        </div>

        <h3 className={styles.subheading}>The language</h3>
        <table className={styles.cheatsheet}>
          <tbody>
            <tr>
              <th scope="row">compare</th>
              <td>
                <code>= != &gt; &gt;= &lt; &lt;=</code>
              </td>
            </tr>
            <tr>
              <th scope="row">membership</th>
              <td>
                <code>services contains 'other'</code>
              </td>
            </tr>
            <tr>
              <th scope="row">presence</th>
              <td>
                <code>finalComments is empty</code> · <code>is not empty</code>
              </td>
            </tr>
            <tr>
              <th scope="row">combine</th>
              <td>
                <code>and</code> · <code>or</code> · <code>not</code> ·{" "}
                <code>( )</code>
              </td>
            </tr>
            <tr>
              <th scope="row">values</th>
              <td>
                <code>'text'</code> · <code>3</code> · <code>true</code>
              </td>
            </tr>
          </tbody>
        </table>
        <p className={styles.note}>
          <code>and</code> binds tighter than <code>or</code>: the third and
          fourth examples above hold the same clauses and mean different things.
          Parentheses make the grouping yours.
        </p>

        <h3 className={styles.subheading}>Fields you can reference</h3>
        <table className={styles.fieldTable}>
          <tbody>
            {fields
              .filter((f) => f.key)
              .map((f) => (
                <tr key={f.id}>
                  <th scope="row">
                    <code>{f.key}</code>
                  </th>
                  <td>{describeField(f)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>

      <section className={styles.column} aria-label="What it becomes">
        <h2 className={styles.heading}>What it becomes</h2>

        <div className={styles.output}>
          <h3 className={styles.subheading}>Against these answers</h3>
          <textarea
            className={styles.answers}
            value={answersText}
            spellCheck={false}
            rows={8}
            aria-label="Sample answers JSON"
            onChange={(event) => setAnswersText(event.target.value)}
          />
          <p
            className={
              verdict === null
                ? styles.verdictUnknown
                : verdict
                  ? styles.verdictTrue
                  : styles.verdictFalse
            }
            data-testid="playground-verdict"
            role="status"
          >
            {answers.error
              ? answers.error
              : condition === null
                ? "No rule yet — the field would always show."
                : verdict
                  ? "Matches: the field would be shown, or its answer required."
                  : "No match: the field would be hidden, or its answer optional."}
          </p>
        </div>

        <div className={styles.output}>
          <h3 className={styles.subheading}>Stored on the field</h3>
          <p className={styles.note}>
            The expression is never saved. This tree is — with field ids in
            place of the keys shown here — so renaming a field breaks nothing.
          </p>
          <pre className={styles.code} data-testid="playground-tree">
            <code>
              {condition
                ? JSON.stringify(conditionWithKeys(condition, fields), null, 2)
                : "—"}
            </code>
          </pre>
        </div>

        <div className={styles.output}>
          <h3 className={styles.subheading}>Compiled for the JSON Schema</h3>
          <p className={styles.note}>
            Used inside <code>if</code>, so a server holds submissions to the
            same rule without knowing the language.
          </p>
          <pre className={styles.code} data-testid="playground-schema">
            <code>
              {schemaFragment ? JSON.stringify(schemaFragment, null, 2) : "—"}
            </code>
          </pre>
        </div>
      </section>
    </div>
  )
}

function describeField(field: FormField): string {
  const schema = registry.resolve(field.type).toJsonSchema?.(field)
  const values = Array.isArray(field.props.options)
    ? (field.props.options as Array<{ value: string }>).map(
        (o) => `'${o.value}'`,
      )
    : []

  switch (schema?.type) {
    case "number":
    case "integer":
      return "a number"
    case "boolean":
      return "true or false"
    case "array":
      return values.length > 0 ? `a list of ${values.join(", ")}` : "a list"
    case "string":
      if (schema.format === "date") return "a date"
      if (schema.format === "email") return "an email address"
      return values.length > 0 ? `one of ${values.join(", ")}` : "text"
    default:
      return "unknown"
  }
}
