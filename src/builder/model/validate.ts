import type { FieldTypeRegistry } from "./registry"
import type { FieldOption, FormDefinition, FormField } from "./types"
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
export function validateForm(
  form: FormDefinition,
  registry: FieldTypeRegistry,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const keyCounts = new Map<string, number>()
  const typeCounts = new Map<string, number>()

  for (const field of form.fields) {
    if (!registry.resolve(field.type).dataless) {
      keyCounts.set(field.key, (keyCounts.get(field.key) ?? 0) + 1)
    }
    typeCounts.set(field.type, (typeCounts.get(field.type) ?? 0) + 1)
  }

  for (const field of form.fields) {
    const definition = registry.resolve(field.type)
    const push = (message: string) =>
      issues.push({ fieldId: field.id, message })

    if (!registry.has(field.type)) {
      push(`Field type "${field.type}" is not registered`)
    }

    if (!field.label.trim()) push("Label is empty")

    if (!definition.dataless) {
      if (!field.key.trim()) {
        push("Key is empty")
      } else if (!isValidKey(field.key)) {
        push(
          `Key "${field.key}" must be a valid identifier (letters, digits, underscore)`,
        )
      } else if ((keyCounts.get(field.key) ?? 0) > 1) {
        push(`Key "${field.key}" is used by more than one field`)
      }
    }

    if (
      definition.maxInstances !== undefined &&
      (typeCounts.get(field.type) ?? 0) > definition.maxInstances
    ) {
      push(
        definition.maxInstances === 1
          ? `Only one ${definition.label} field is allowed`
          : `At most ${definition.maxInstances} ${definition.label} fields are allowed`,
      )
    }

    for (const spec of definition.properties ?? []) {
      if (spec.kind === "options") {
        for (const message of validateOptions(field, spec.name)) push(message)
      }
    }

    if (registry.has(field.type) && definition.validate) {
      for (const message of definition.validate(field)) push(message)
    }
  }

  return issues
}

function validateOptions(field: FormField, name: string): string[] {
  const options = field.props[name]
  if (!Array.isArray(options)) return []
  const list = options as FieldOption[]
  const messages: string[] = []

  if (list.length === 0) messages.push("Has no options")

  const values = new Set<string>()
  for (const option of list) {
    if (values.has(option.value)) {
      messages.push(`Option value "${option.value}" is duplicated`)
      break
    }
    values.add(option.value)
  }

  if (list.some((o) => !o.value.trim())) {
    messages.push("An option has an empty value")
  }

  return messages
}
