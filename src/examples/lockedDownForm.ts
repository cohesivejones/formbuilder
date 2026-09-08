import { createField } from "../builder"
import { builtInFieldTypes } from "../builder/fieldTypes/builtIns"
import { newId } from "../builder/model/keys"
import { createRegistry } from "../builder/model/registry"
import type {
  BuilderPermissions,
  FieldLocks,
  FieldProps,
  FormDefinition,
  FormField,
} from "../builder"
import { programQuestionSlot } from "./programQuestionSlot"

export const lockedDownFieldTypes = [...builtInFieldTypes, programQuestionSlot]

const registry = createRegistry(lockedDownFieldTypes)

function make(
  type: string,
  key: string,
  overrides: Partial<Pick<FormField, "label" | "required" | "locks">> & {
    props?: FieldProps
  } = {},
): FormField {
  const definition = registry.get(type)
  if (!definition) throw new Error(`Unknown field type ${type}`)
  const { props, ...base } = overrides
  const field = createField(definition, key)
  return { ...field, ...base, props: { ...field.props, ...props } }
}

/** The 1 to 5 agreement scale the outcome questions are answered on. */
function agreementScale() {
  return [
    ["Strongly disagree", "1"],
    ["Disagree", "2"],
    ["Neutral", "3"],
    ["Agree", "4"],
    ["Strongly agree", "5"],
  ].map(([label, value]) => ({ id: newId("o"), label, value }))
}

/** Pinned: the key anchors the downstream export, so it may be reworded only. */
const ANCHORED: FieldLocks = { remove: true, reorder: true }

/**
 * A fixed form of the kind a host would hand to a service administrator,
 * modelled on the feedback platform's client feedback form.
 *
 * The three outcome questions are pinned because their keys anchor the funder
 * export. The program question slot and the free-text comment carry no such
 * meaning, so they can be moved and removed like ordinary fields.
 */
export function createLockedDownForm(): FormDefinition {
  return {
    title: "Client feedback",
    description:
      "Thank you for taking a moment to tell us how we did. Your answers are anonymous.",
    fields: [
      make("radio", "serviceListened", {
        label: "The service listened to me",
        required: true,
        locks: ANCHORED,
        props: { options: agreementScale() },
      }),
      make("radio", "serviceReceived", {
        label: "I received the service I needed",
        required: true,
        locks: ANCHORED,
        props: { options: agreementScale() },
      }),
      make("radio", "situationImproved", {
        label: "My situation has improved",
        required: true,
        locks: ANCHORED,
        props: { options: agreementScale() },
      }),
      make("programQuestionSlot", ""),
      make("textarea", "additionalComments", {
        label: "Anything else you would like to tell us?",
        props: { rows: 4, maxLength: 1000 },
      }),
    ],
  }
}

/**
 * What a service administrator may do to the form above: reword the questions,
 * reorder them and remove the ones that are not pinned. Everything structural
 * stays with the host.
 */
export const WORDING_ONLY: BuilderPermissions = {
  addFields: false,
  editKeys: false,
  editProps: false,
  editRequired: false,
  editFormMeta: false,
}
