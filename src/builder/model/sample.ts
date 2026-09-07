import { builtInFieldTypes } from "../fieldTypes/builtIns"
import { createField } from "./fieldType"
import { newId } from "./keys"
import { createRegistry } from "./registry"
import type { FieldProps, FormDefinition, FormField } from "./types"

const registry = createRegistry(builtInFieldTypes)

function make(
  type: string,
  key: string,
  overrides: Partial<Pick<FormField, "label" | "description" | "required">> & {
    props?: FieldProps
  } = {},
): FormField {
  const definition = registry.get(type)
  if (!definition) throw new Error(`Unknown sample field type ${type}`)
  const { props, ...base } = overrides
  const field = createField(definition, key)
  return { ...field, ...base, props: { ...field.props, ...props } }
}

function options(...pairs: [label: string, value: string][]) {
  return pairs.map(([label, value]) => ({ id: newId("o"), label, value }))
}

/** A small example form used by the "Load sample" action. */
export function createSampleForm(): FormDefinition {
  return {
    title: "Client intake",
    description:
      "Tell us a little about yourself so we can match you with the right service.",
    fields: [
      make("text", "fullName", {
        label: "Full name",
        required: true,
        props: { placeholder: "Jane Citizen", maxLength: 120 },
      }),
      make("email", "email", {
        label: "Email address",
        required: true,
        props: { placeholder: "you@example.com" },
      }),
      make("date", "dateOfBirth", { label: "Date of birth" }),
      make("radio", "contactMethod", {
        label: "Preferred contact method",
        required: true,
        props: {
          options: options(
            ["Phone", "phone"],
            ["Email", "email"],
            ["SMS", "sms"],
          ),
        },
      }),
      make("select", "region", {
        label: "Region",
        props: {
          placeholder: "Select a region",
          options: options(
            ["Metro", "metro"],
            ["South West", "southWest"],
            ["Great Southern", "greatSouthern"],
            ["Goldfields", "goldfields"],
          ),
        },
      }),
      make("checkboxGroup", "services", {
        label: "Services you are interested in",
        description: "Choose as many as apply.",
        required: true,
        props: {
          options: options(
            ["Counselling", "counselling"],
            ["Mediation", "mediation"],
            ["Parenting courses", "parenting"],
            ["Workshops", "workshops"],
          ),
        },
      }),
      make("number", "householdSize", {
        label: "People in your household",
        props: { integer: true, min: 1, max: 20 },
      }),
      make("textarea", "notes", {
        label: "Anything else you would like us to know?",
        props: { rows: 4, maxLength: 1000 },
      }),
      make("checkbox", "consent", {
        label: "I agree to be contacted about my enquiry",
        required: true,
      }),
    ],
  }
}
