import type { FieldOfType, FieldType, FormDefinition } from "./types"
import { createField } from "./fieldRegistry"
import { newId } from "./keys"

function make<T extends FieldType>(
  type: T,
  key: string,
  overrides: Partial<FieldOfType<T>>,
): FieldOfType<T> {
  return { ...(createField(type, key) as FieldOfType<T>), ...overrides }
}

function options(...pairs: [label: string, value: string][]) {
  return pairs.map(([label, value]) => ({ id: newId("o"), label, value }))
}

/** A small example form used by the empty-state "Load a sample" action. */
export function createSampleForm(): FormDefinition {
  return {
    title: "Client intake",
    description:
      "Tell us a little about yourself so we can match you with the right service.",
    fields: [
      make("text", "fullName", {
        label: "Full name",
        required: true,
        placeholder: "Jane Citizen",
        maxLength: 120,
      }),
      make("email", "email", {
        label: "Email address",
        required: true,
        placeholder: "you@example.com",
      }),
      make("date", "dateOfBirth", { label: "Date of birth" }),
      make("radio", "contactMethod", {
        label: "Preferred contact method",
        required: true,
        options: options(
          ["Phone", "phone"],
          ["Email", "email"],
          ["SMS", "sms"],
        ),
      }),
      make("select", "region", {
        label: "Region",
        placeholder: "Select a region",
        options: options(
          ["Metro", "metro"],
          ["South West", "southWest"],
          ["Great Southern", "greatSouthern"],
          ["Goldfields", "goldfields"],
        ),
      }),
      make("checkboxGroup", "services", {
        label: "Services you are interested in",
        description: "Choose as many as apply.",
        required: true,
        options: options(
          ["Counselling", "counselling"],
          ["Mediation", "mediation"],
          ["Parenting courses", "parenting"],
          ["Workshops", "workshops"],
        ),
      }),
      make("number", "householdSize", {
        label: "People in your household",
        integer: true,
        min: 1,
        max: 20,
      }),
      make("textarea", "notes", {
        label: "Anything else you would like us to know?",
        rows: 4,
        maxLength: 1000,
      }),
      make("checkbox", "consent", {
        label: "I agree to be contacted about my enquiry",
        required: true,
      }),
    ],
  }
}
