import { useState } from "react"
import { Builder, type FormDefinition } from "../builder"
import {
  createLockedDownForm,
  lockedDownFieldTypes,
  WORDING_ONLY,
} from "../examples/lockedDownForm"

/**
 * One fixed form as a service administrator would see it. The host owns the
 * definition and receives every change, which is how a real embedding works;
 * here the latest version is simply held in state.
 *
 * Two layers of restriction are on show. The permissions remove the palette and
 * every structural setting, so only wording, order and deletion remain. On top
 * of that, the three outcome questions carry their own locks, so they alone
 * cannot be moved or deleted.
 */
export function LockedDownFormPage() {
  const [form, setForm] = useState<FormDefinition>(createLockedDownForm)

  return (
    <Builder
      fieldTypes={lockedDownFieldTypes}
      value={form}
      onChange={setForm}
      permissions={WORDING_ONLY}
      showSchema={false}
      title="Client feedback"
    />
  )
}
