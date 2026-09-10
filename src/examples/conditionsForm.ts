import { createField, parseCondition } from "../builder"
import { builtInFieldTypes } from "../builder/fieldTypes/builtIns"
import { newId } from "../builder/model/keys"
import { createRegistry } from "../builder/model/registry"
import type { FieldProps, FormDefinition, FormField } from "../builder"

const registry = createRegistry(builtInFieldTypes)

function make(
  type: string,
  key: string,
  overrides: Partial<Pick<FormField, "label" | "description" | "required">> & {
    props?: FieldProps
  } = {},
): FormField {
  const definition = registry.get(type)
  if (!definition) throw new Error(`Unknown field type ${type}`)
  const { props, ...base } = overrides
  const field = createField(definition, key)
  return { ...field, ...base, props: { ...field.props, ...props } }
}

function options(...pairs: [label: string, value: string][]) {
  return pairs.map(([label, value]) => ({ id: newId("o"), label, value }))
}

/**
 * Attaches rules written in the expression language, exactly as an admin would
 * type them. Parsing here rather than hand-building trees keeps the example
 * honest: if the language changes, this file fails loudly.
 */
function rule(
  fields: FormField[],
  key: string,
  rules: { visibleWhen?: string; requiredWhen?: string },
): void {
  const field = fields.find((f) => f.key === key)
  if (!field) throw new Error(`No field with key ${key}`)
  for (const [name, text] of Object.entries(rules)) {
    const result = parseCondition(text, { fields, selfId: field.id })
    if (!result.ok) throw new Error(`${key} ${name}: ${result.error}`)
    if (!result.condition) throw new Error(`${key} ${name}: blank rule`)
    field[name as "visibleWhen" | "requiredWhen"] = result.condition
  }
}

/** The form behind the conditional logic demo page. */
export function createConditionsForm(): FormDefinition {
  const fields: FormField[] = [
    make("radio", "contactMethod", {
      label: "How should we follow up?",
      required: true,
      props: {
        options: options(
          ["Please phone me", "phone"],
          ["Please email me", "email"],
          ["No follow-up", "none"],
        ),
      },
    }),
    make("text", "phoneNumber", {
      label: "Best phone number",
      required: true,
      props: { placeholder: "04xx xxx xxx" },
    }),
    make("email", "contactEmail", {
      label: "Best email address",
      required: true,
    }),
    make("checkbox", "hasAllergies", {
      label: "Do you have any allergies we should know about?",
    }),
    make("textarea", "allergyDetails", {
      label: "Please list your allergies",
      props: { rows: 3 },
    }),
    make("checkboxGroup", "services", {
      label: "Which services have you used?",
      props: {
        options: options(
          ["Counselling", "counselling"],
          ["Mediation", "mediation"],
          ["Something else", "other"],
        ),
      },
    }),
    make("text", "otherService", {
      label: "What was the other service?",
    }),
    make("number", "householdSize", {
      label: "People in your household",
      props: { integer: true, min: 1 },
    }),
    make("textarea", "finalComments", {
      label: "Anything else?",
      description: "If we cannot follow up, please tell us everything here.",
      props: { rows: 3 },
    }),
  ]

  // Statically required fields that exist only for their contact method: the
  // exporter folds the visibility into the requirement, so a submission is
  // never asked for a number the form itself withheld.
  rule(fields, "phoneNumber", { visibleWhen: "contactMethod = 'phone'" })
  rule(fields, "contactEmail", { visibleWhen: "contactMethod = 'email'" })
  rule(fields, "allergyDetails", {
    visibleWhen: "hasAllergies = true",
    requiredWhen: "hasAllergies = true",
  })
  rule(fields, "otherService", { visibleWhen: "services contains 'other'" })
  // A required-only rule: the field is always on show, but a person we cannot
  // follow up with must not leave silently.
  rule(fields, "finalComments", { requiredWhen: "contactMethod = 'none'" })

  return {
    title: "Follow-up preferences",
    description:
      "A demonstration of conditional logic: answers change which questions exist and which are required.",
    fields,
  }
}
