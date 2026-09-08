import { Builder } from "./builder"
import { builtInFieldTypes } from "./builder/fieldTypes/builtIns"
import { createSampleForm } from "./builder/model/sample"
import { programQuestionSlot } from "./examples/programQuestionSlot"

// The demo host: every built-in type plus one custom, dataless, single-instance
// type modelled on the feedback platform's program-question slot.
const fieldTypes = [...builtInFieldTypes, programQuestionSlot]

// A locked-down instance for one fixed form: an admin may reword fields,
// reorder them and delete them, and nothing else. Open with ?mode=restricted.
const WORDING_ONLY = {
  addFields: false,
  editKeys: false,
  editProps: false,
  editRequired: false,
  editFormMeta: false,
}

function App() {
  const restricted =
    new URLSearchParams(window.location.search).get("mode") === "restricted"

  if (restricted) {
    return (
      <Builder
        fieldTypes={fieldTypes}
        defaultValue={createSampleForm()}
        permissions={WORDING_ONLY}
        showSchema={false}
        title="Edit form wording"
      />
    )
  }

  return <Builder fieldTypes={fieldTypes} persist sample={createSampleForm} />
}

export default App
