import type { FormDefinition } from "./types"
import { hasOptions } from "./types"
import { isValidKey } from "./keys"

export interface ValidationIssue {
  /** Id of the offending field, or null for form-level issues. */
  fieldId: string | null
  message: string
}

/**
 * Checks a form definition for problems that would make the generated schema
 * wrong or surprising. The builder never blocks on these; it surfaces them.
 */
export function validateForm(form: FormDefinition): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const keyCounts = new Map<string, number>()

  for (const field of form.fields) {
    keyCounts.set(field.key, (keyCounts.get(field.key) ?? 0) + 1)
  }

  for (const field of form.fields) {
    const push = (message: string) =>
      issues.push({ fieldId: field.id, message })

    if (!field.label.trim()) push("Label is empty")

    if (!field.key.trim()) {
      push("Key is empty")
    } else if (!isValidKey(field.key)) {
      push(
        `Key "${field.key}" must be a valid identifier (letters, digits, underscore)`,
      )
    } else if ((keyCounts.get(field.key) ?? 0) > 1) {
      push(`Key "${field.key}" is used by more than one field`)
    }

    if (field.type === "text" && field.pattern) {
      try {
        new RegExp(field.pattern)
      } catch {
        push("Pattern is not a valid regular expression")
      }
    }

    if (
      field.type === "text" &&
      field.minLength !== undefined &&
      field.maxLength !== undefined &&
      field.minLength > field.maxLength
    ) {
      push("Minimum length is greater than maximum length")
    }

    if (
      field.type === "number" &&
      field.min !== undefined &&
      field.max !== undefined &&
      field.min > field.max
    ) {
      push("Minimum is greater than maximum")
    }

    if (hasOptions(field)) {
      if (field.options.length === 0) push("Has no options")

      const values = new Set<string>()
      for (const option of field.options) {
        if (values.has(option.value)) {
          push(`Option value "${option.value}" is duplicated`)
          break
        }
        values.add(option.value)
      }

      if (field.options.some((o) => !o.value.trim())) {
        push("An option has an empty value")
      }

      if (
        field.type === "checkboxGroup" &&
        field.minSelected !== undefined &&
        field.maxSelected !== undefined &&
        field.minSelected > field.maxSelected
      ) {
        push("Minimum selected is greater than maximum selected")
      }
    }
  }

  return issues
}
