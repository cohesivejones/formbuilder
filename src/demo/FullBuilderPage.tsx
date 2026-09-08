import { Builder } from "../builder"
import { createSampleForm } from "../builder/model/sample"
import { lockedDownFieldTypes } from "../examples/lockedDownForm"

/**
 * The unrestricted builder: every built-in field type plus the custom
 * program-question slot, with the form kept in localStorage between reloads.
 */
export function FullBuilderPage() {
  return (
    <Builder
      fieldTypes={lockedDownFieldTypes}
      persist
      sample={createSampleForm}
      title="Full builder"
    />
  )
}
