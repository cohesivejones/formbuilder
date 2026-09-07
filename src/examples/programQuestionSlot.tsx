import { defineFieldType } from "../builder/model/fieldType"
import styles from "./programQuestionSlot.module.css"

/**
 * Example of a host-defined field type: the feedback platform's program-question
 * slot. It is a placeholder the server fills in per program at serve time, so it
 * carries no data of its own (dataless), a form may contain at most one, and its
 * only setting is the answer scale the resolved question is rendered on.
 *
 * A host maps this to its own storage shape; for the feedback platform that is
 * `{ type: "programQuestionSlot", fieldType }` in the shared Zod schema.
 */

export type ProgramQuestionScale = "rating" | "rating-pictogram"

export type ProgramQuestionSlotProps = { fieldType: ProgramQuestionScale }

export const SCALE_LABELS: Record<ProgramQuestionScale, string> = {
  rating: "Rating (1 to 5)",
  "rating-pictogram": "Pictogram (smiley faces)",
}

export const programQuestionSlot = defineFieldType<ProgramQuestionSlotProps>({
  type: "programQuestionSlot",
  label: "Program question",
  description: "Resolved per program at serve time",
  icon: "🧩",
  dataless: true,
  maxInstances: 1,
  // The label is fixed and there is nothing to describe: the question itself is
  // managed elsewhere. Only the answer scale is authored here.
  baseProperties: [],
  defaults: { fieldType: "rating" },
  properties: [
    {
      kind: "select",
      name: "fieldType",
      label: "Answer scale",
      help: "How clients answer this program question on this form.",
      options: [
        { label: SCALE_LABELS.rating, value: "rating" },
        { label: SCALE_LABELS["rating-pictogram"], value: "rating-pictogram" },
      ],
    },
  ],
  Preview: ({ field }) => (
    <div className={styles.slot}>
      <span className={styles.icon} aria-hidden="true">
        🧩
      </span>
      <div className={styles.text}>
        <span className={styles.body}>
          Dynamic. Resolved per program at serve time and managed on the Program
          Questions page.
        </span>
        <span className={styles.scale}>
          Answer scale:{" "}
          {SCALE_LABELS[field.props.fieldType] ?? field.props.fieldType}
        </span>
      </div>
    </div>
  ),
})
