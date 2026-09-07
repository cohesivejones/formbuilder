import { useEffect, useMemo, useState } from "react"
import type { FormDefinition } from "../model/types"
import { slugifyKey } from "../model/keys"
import type { ValidationIssue } from "../model/validate"
import type { GeneratedSchema } from "../schema/jsonSchemaTypes"
import { cx } from "./cx"
import { Icon } from "./Icon"
import styles from "./SchemaOutput.module.css"

type View = "schema" | "uiSchema"

interface SchemaOutputProps {
  form: FormDefinition
  generated: GeneratedSchema
  issues: ValidationIssue[]
  onSelectField: (id: string) => void
}

export function SchemaOutput({
  form,
  generated,
  issues,
  onSelectField,
}: SchemaOutputProps) {
  const [view, setView] = useState<View>("schema")
  const [copied, setCopied] = useState(false)

  const json = useMemo(
    () =>
      JSON.stringify(
        view === "schema" ? generated.schema : generated.uiSchema,
        null,
        2,
      ),
    [generated, view],
  )

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1500)
    return () => window.clearTimeout(timer)
  }, [copied])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json)
      setCopied(true)
    } catch {
      // Clipboard can be unavailable (insecure context, permissions); fail quietly.
    }
  }

  const download = () => {
    const base = slugifyKey(form.title) || "form"
    const suffix = view === "schema" ? "schema" : "ui-schema"
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `${base}.${suffix}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const fieldLabel = (id: string | null) =>
    form.fields.find((f) => f.id === id)?.label ?? "Form"

  return (
    <div className={styles.output}>
      {issues.length > 0 && (
        <div
          className={styles.issues}
          role="status"
          data-testid="schema-issues"
        >
          <p className={styles.issuesTitle}>
            <Icon name="warning" size={14} />
            {issues.length} {issues.length === 1 ? "issue" : "issues"} to fix
            before this schema is reliable
          </p>
          <ul>
            {issues.map((issue, i) => (
              <li key={`${issue.fieldId}-${i}`}>
                {issue.fieldId ? (
                  <button
                    type="button"
                    className={styles.issueLink}
                    onClick={() => onSelectField(issue.fieldId!)}
                  >
                    {fieldLabel(issue.fieldId) || "Untitled"}
                  </button>
                ) : (
                  <span>Form</span>
                )}
                <span>{issue.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.toolbar}>
        <div className={styles.segmented} role="tablist" aria-label="Output">
          <button
            type="button"
            role="tab"
            aria-selected={view === "schema"}
            className={cx(
              styles.segment,
              view === "schema" && styles.segmentActive,
            )}
            onClick={() => setView("schema")}
          >
            JSON Schema
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "uiSchema"}
            className={cx(
              styles.segment,
              view === "uiSchema" && styles.segmentActive,
            )}
            onClick={() => setView("uiSchema")}
          >
            UI Schema
          </button>
        </div>
        <div className={styles.actions}>
          <button type="button" className="btn btn-sm" onClick={copy}>
            <Icon name={copied ? "check" : "copy"} size={14} />
            {copied ? "Copied" : "Copy"}
          </button>
          <button type="button" className="btn btn-sm" onClick={download}>
            <Icon name="download" size={14} />
            Download
          </button>
        </div>
      </div>

      <pre className={styles.code} data-testid="schema-json" tabIndex={0}>
        <code>{json}</code>
      </pre>
    </div>
  )
}
