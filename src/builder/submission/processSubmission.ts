import { resolveVisibility, visibleValues } from "../conditions/evaluate"
import type { FieldTypeDefinition } from "../model/fieldType"
import { createRegistry } from "../model/registry"
import type { FormDefinition } from "../model/types"
import { toJsonSchema } from "../schema/toJsonSchema"
import type { GeneratedSchema } from "../schema/jsonSchemaTypes"
import {
  createSubmissionValidator,
  prune,
  type SubmissionData,
  type SubmissionErrors,
} from "./validateSubmission"

export interface ProcessedSubmission {
  /**
   * The answers as they should be stored: hidden fields' answers and blanks
   * removed. Valid exactly when `errors` is empty.
   */
  data: SubmissionData
  /** Error messages by field key, in the words a respondent would be shown. */
  errors: SubmissionErrors
  /** Ids of the fields visible given these answers. */
  visible: ReadonlySet<string>
}

export interface ProcessOptions {
  /**
   * Report answers to questions the form did not ask — a currently hidden
   * field's, or a key the form never declared — instead of silently dropping
   * them. The default drops, which is what the renderer's own behaviour
   * amounts to; rejection suits an API that prefers loud failure over
   * discarding what a client sent.
   */
  rejectUnasked?: boolean
}

export interface SubmissionProcessor extends GeneratedSchema {
  process(raw: SubmissionData, options?: ProcessOptions): ProcessedSubmission
}

/**
 * The one pipeline a submission goes through, wherever it arrives.
 *
 * The renderer runs this on every change, and a server runs the identical
 * function on what the API receives, so a submission bypassing the browser is
 * held to exactly the rules the form shows: visibility is resolved from the
 * answers themselves (cascading, so hiding a controller hides its dependents),
 * hidden and blank answers are removed, and what remains is validated against
 * the JSON Schema generated from this same definition — conditional
 * requirements included, since the exporter folds visibility into them.
 *
 * Everything reachable from here is plain TypeScript: no React, CSS or DOM,
 * which the server-entry test enforces. Use `coreFieldTypes` for `fieldTypes`
 * on a server; the browser's `builtInFieldTypes` are those cores plus
 * rendering, so both sides compute the same result.
 */
export function createSubmissionProcessor(
  form: FormDefinition,
  fieldTypes: readonly FieldTypeDefinition[],
): SubmissionProcessor {
  const registry = createRegistry(fieldTypes)
  const { schema, uiSchema } = toJsonSchema(form, registry)
  const validate = createSubmissionValidator(schema)

  return {
    schema,
    uiSchema,
    process(raw, options = {}) {
      const visible = resolveVisibility(form.fields, raw)
      const data = prune(visibleValues(form.fields, raw, visible))
      const errors = validate(data)

      if (options.rejectUnasked) {
        const asked = new Set(
          form.fields
            .filter((f) => f.key && visible.has(f.id))
            .map((f) => f.key),
        )
        for (const [key, answer] of Object.entries(raw)) {
          if (asked.has(key) || errors[key]) continue
          const blank =
            answer === undefined ||
            answer === null ||
            answer === "" ||
            (Array.isArray(answer) && answer.length === 0)
          if (!blank) {
            errors[key] = "This answers a question the form did not ask"
          }
        }
      }

      return { data, errors, visible }
    },
  }
}
