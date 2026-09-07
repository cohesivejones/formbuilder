import { Builder } from "./builder"
import { builtInFieldTypes } from "./builder/fieldTypes/builtIns"
import { createSampleForm } from "./builder/model/sample"
import { programQuestionSlot } from "./examples/programQuestionSlot"

// The demo host: every built-in type plus one custom, dataless, single-instance
// type modelled on the feedback platform's program-question slot.
const fieldTypes = [...builtInFieldTypes, programQuestionSlot]

function App() {
  return <Builder fieldTypes={fieldTypes} persist sample={createSampleForm} />
}

export default App
