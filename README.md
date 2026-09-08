# Form Builder

A drag-and-drop form builder written in React and TypeScript, built to replace
Form.io's builder in the platform. You compose a form from a palette of field
types, edit each field's properties, and the host application receives the form
definition on every change. Out of the box it also emits a **JSON Schema**
(draft 2020-12) describing the data plus a **UI schema** carrying presentation
hints such as "render this as radio buttons".

Field types are pluggable: the nine built-ins and any host-defined types share
one `FieldTypeDefinition` contract, so a host can add its own inputs with their
own settings, previews and schema mapping without touching the builder.

## Getting started

```sh
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

| Script               | What it does                          |
| -------------------- | ------------------------------------- |
| `npm test`           | Run the unit and component tests once |
| `npm run test:watch` | Run tests in watch mode               |
| `npm run typecheck`  | Type-check the whole project          |
| `npm run lint`       | Lint with oxlint                      |
| `npm run build`      | Type-check and build to `dist/`       |
| `npm run format`     | Format with Prettier                  |

## Using the builder

- **Palette (left)**: drag a field type onto the canvas, or click it to add the
  field after the currently selected one. Keyboard users can Tab to a palette
  item and press Enter.
- **Canvas (centre)**: click a field to select it. Drag the grip handle to reorder,
  or use the up/down buttons. Each card shows a preview of the input and its
  schema key. The form title and description are edited in place at the top.
- **Inspector (right)**: the **Field** tab edits the selected field. The **Schema**
  tab shows the live JSON Schema and UI schema with copy and download buttons.
  Validation issues (duplicate keys, invalid patterns, empty options) are listed
  there and link back to the offending field.

The form is saved to `localStorage` so a reload does not lose work. **Load sample**
in the top bar loads an example form.

## Embedding in a host application

```tsx
import { Builder, builtInFieldTypes } from "./builder"
import { programQuestionSlot } from "./examples/programQuestionSlot"

// Stable reference: a new array each render would rebuild the registry.
const fieldTypes = [...builtInFieldTypes, programQuestionSlot]

function FeedbackFormEditor({ form, onChange }) {
  return (
    <Builder
      fieldTypes={fieldTypes}
      value={form} // controlled: the host owns the form
      onChange={onChange} // called with the full FormDefinition on every change
      showSchema={false} // hide the JSON Schema tab if the host has its own storage shape
    />
  )
}
```

`Builder` props:

| Prop           | Purpose                                                            |
| -------------- | ------------------------------------------------------------------ |
| `fieldTypes`   | Definitions shown in the palette. Defaults to `builtInFieldTypes`. |
| `value`        | Controlled form definition. Pair with `onChange`.                  |
| `defaultValue` | Initial form when uncontrolled.                                    |
| `onChange`     | Receives the full `FormDefinition` after every change.             |
| `persist`      | Uncontrolled only: keep the form in `localStorage`.                |
| `permissions`  | What the admin may do. See "Restricting what an admin may do".     |
| `showSchema`   | Show the JSON Schema output tab. Default `true`.                   |
| `sample`       | Function returning a form; enables the "Load sample" action.       |
| `title`        | Top bar heading.                                                   |

### The form definition

Every field has the same shape. Type-specific settings live in `props`, whose
meaning is defined by the field's type definition.

```ts
interface FormField {
  id: string // stable internal id
  type: string // a registered field type
  key: string // JSON Schema property name; "" for dataless types
  autoKey: boolean // key follows the label until edited by hand
  label: string
  description?: string
  required: boolean
  props: Record<string, unknown>
  locks?: {
    remove?: boolean
    key?: boolean
    props?: boolean
    required?: boolean
  }
}
```

`locks` let a host protect fields whose identity anchors downstream data. A
locked field can still be reworded, but the reducer refuses to delete or re-key
it and the UI disables those actions. A field of a type that is no longer
registered is preserved, shown with a warning, and flagged by validation.

### Defining a field type

```tsx
import { defineFieldType } from "./builder"

type RatingProps = { max: number } // a type alias, not an interface

export const rating = defineFieldType<RatingProps>({
  type: "rating",
  label: "Rating",
  description: "1 to N stars",
  icon: "★",
  defaults: { max: 5 },
  properties: [
    { kind: "number", name: "max", label: "Maximum", min: 2, max: 10 },
  ],
  toJsonSchema: ({ props }) => ({
    type: "integer",
    minimum: 1,
    maximum: props.max,
  }),
  toUiSchema: () => ({ "ui:widget": "radio" }),
  Preview: ({ field }) => <span>{"★".repeat(field.props.max)}</span>,
  validate: ({ props }) =>
    props.max < 2 ? ["Maximum must be at least 2"] : [],
})
```

Definition fields:

- **`defaults`**: initial `props`. Use a function when values need fresh ids.
- **`properties`**: declarative settings the inspector renders. Kinds: `text`,
  `number`, `boolean`, `select`, and `options` (a label/value list editor).
  Group them with `section`.
- **`PropertiesEditor`**: escape hatch component for settings the declarative
  kinds cannot express.
- **`Preview`**: read-only rendering on the canvas card.
- **`toJsonSchema` / `toUiSchema`**: the type-specific part of the output. The
  builder adds `title` and `description` and handles `required`.
- **`validate`**: extra problems to surface.
- **`dataless`**: the field carries no data. It gets no key, cannot be required
  and emits no schema property. Use it for placeholders and static content.
- **`maxInstances`**: cap per form. The palette item disables when reached.
- **`baseProperties`**: which of `label`, `description`, `required` the
  inspector shows. Pass `[]` for a fixed-label field.

### Example: the program question slot

[programQuestionSlot.tsx](src/examples/programQuestionSlot.tsx) reproduces the
feedback platform's Form.io custom component as a definition: dataless, at most
one per form, a fixed label, and a single `select` setting for the answer scale
that the card preview reflects. The demo app registers it alongside the
built-ins. A host maps `field.props.fieldType` to its own storage shape the way
`formioMapping.ts` does today.

## Restricting what an admin may do

A Builder instance can be narrowed with `permissions`. Everything is allowed by
default, so an unrestricted builder needs no configuration.

```tsx
// One fixed form: reword fields, reorder them, delete them, nothing else.
<Builder
  value={form}
  onChange={save}
  showSchema={false}
  permissions={{
    addFields: false,
    editKeys: false,
    editProps: false,
    editRequired: false,
    editFormMeta: false,
    // editLabels, reorderFields and removeFields stay on by default
  }}
/>
```

| Permission      | Governs                                        |
| --------------- | ---------------------------------------------- |
| `addFields`     | The palette, duplicating, and loading a sample |
| `removeFields`  | Deleting a field and clearing the form         |
| `reorderFields` | Dragging and the move up/down actions          |
| `editLabels`    | Field labels and help text                     |
| `editKeys`      | The JSON Schema key                            |
| `editProps`     | Type-specific settings                         |
| `editRequired`  | The required flag                              |
| `editFormMeta`  | The form's own title and description           |

Per-field `locks` narrow things further for individual fields, using the same
names plus `remove` and `reorder`. The more restrictive of the two always wins,
so a host can permit deletion generally and still pin one field:

```ts
{ id: "…", key: "serviceListened", label: "The service listened to me",
  locks: { remove: true, key: true, reorder: true } }
```

Two rules govern the result:

- **Enforcement is in the reducer, not the UI.** Disabled controls are
  presentation; the reducer refuses the action regardless of how it is
  dispatched. Your server-side policy remains the real backstop.
- **A capability the whole form forbids is hidden; a capability only one field
  forbids is shown disabled.** So an admin who can never reorder sees no drag
  handles at all, while one pinned field among many shows a "Locked" badge and
  greyed controls against its editable siblings.

Try it in the demo with `?mode=restricted`.

## Supported field types

| Palette item   | JSON Schema                                                             | UI schema                                |
| -------------- | ----------------------------------------------------------------------- | ---------------------------------------- |
| Text           | `string` with `minLength`, `maxLength`, `pattern`                       | `ui:placeholder`                         |
| Text area      | `string` with `maxLength`                                               | `ui:widget: textarea`, `ui:options.rows` |
| Email          | `string`, `format: email`                                               | `ui:placeholder`                         |
| Number         | `number` or `integer`, `minimum`, `maximum`, `multipleOf`               | `ui:placeholder`                         |
| Date           | `string`, `format: date`                                                |                                          |
| Checkbox       | `boolean`, optional `default: true`                                     |                                          |
| Checkbox group | `array` of `string` with `oneOf`, `uniqueItems`, `minItems`, `maxItems` | `ui:widget: checkboxes`                  |
| Radio group    | `string` with `oneOf: [{ const, title }]`                               | `ui:widget: radio`                       |
| Dropdown       | `string` with `oneOf: [{ const, title }]`                               | `ui:placeholder`                         |

Notes on the mapping:

- Each field becomes a property named by its **key**. Keys are derived from the
  label (`"First name"` becomes `firstName`) until you edit the key by hand.
- Choice fields use `oneOf` with `const` and `title` so option labels survive
  in the schema. Duplicate option values are dropped from the output and flagged.
- A **required checkbox group** means at least one option must be selected
  (`minItems: 1`). A required single checkbox only requires the property to be
  present, not to be `true`.
- The top-level object sets `additionalProperties: false`.
- The UI schema follows [react-jsonschema-form](https://rjsf-team.github.io/react-jsonschema-form/)
  conventions (`ui:order`, `ui:widget`, `ui:placeholder`, `ui:options`) so the
  output can be rendered directly with RJSF, but it is plain JSON any renderer
  can read.

## Example output

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Client intake",
  "type": "object",
  "properties": {
    "fullName": { "title": "Full name", "type": "string", "maxLength": 120 },
    "contactMethod": {
      "title": "Preferred contact method",
      "type": "string",
      "oneOf": [
        { "const": "phone", "title": "Phone" },
        { "const": "email", "title": "Email" }
      ]
    }
  },
  "required": ["fullName", "contactMethod"],
  "additionalProperties": false
}
```

```json
{
  "ui:order": ["fullName", "contactMethod"],
  "fullName": { "ui:placeholder": "Jane Citizen" },
  "contactMethod": { "ui:widget": "radio" }
}
```

## Project layout

```
src/
  App.tsx                         Demo host: built-ins + the program question slot
  examples/
    programQuestionSlot.tsx       A host-defined field type
  builder/
    index.ts                      Public surface for hosts
    model/
      types.ts                    FormDefinition, FormField, FieldLocks
      fieldType.ts                FieldTypeDefinition, PropertySpec, defineFieldType
      registry.ts                 FieldTypeRegistry with unknown-type placeholders
      permissions.ts              Form-wide capabilities resolved against field locks
      keys.ts                     Label → key slugging, uniqueness, ids
      validate.ts                 Issues that would make the output wrong
      sample.ts                   Example form
    fieldTypes/
      builtIns.tsx                The nine standard definitions
    schema/
      jsonSchemaTypes.ts          The JSON Schema subset we emit
      helpers.ts                  Spread helpers for writing mappers
      toJsonSchema.ts             FormDefinition + registry → { schema, uiSchema }
    state/
      reducer.ts                  All builder actions; enforces permissions and locks
      useFormBuilder.ts           Controlled/uncontrolled state + derived data
    components/
      Builder.tsx                 Layout, DndContext wiring, host props
      Palette.tsx                 Draggable field types
      Canvas.tsx / CanvasField.tsx  Sortable field cards
      PropertiesPanel.tsx         Generic inspector driven by PropertySpecs
      OptionsEditor.tsx           Label/value editor for choice fields
      SchemaOutput.tsx            JSON output, copy, download, issues
```

Drag and drop is built on [dnd-kit](https://dndkit.com/): palette items are
`useDraggable`, canvas cards are `useSortable`, and the canvas is a `useDroppable`
so dropping in empty space appends.

## Tests

Pure logic (schema conversion, reducer, validation, registry, key slugging) is
unit tested, including compiling the generated schema with Ajv in strict 2020-12
mode and validating sample data against it. The `Builder` component is tested
with Testing Library through click-to-add, editing, reordering, option editing,
custom types, locks, permissions and controlled mode. Pointer drag-and-drop is
not exercised in jsdom.

## Ideas for the next cut

- Adapter in the feedback repo mapping `FormDefinition` to the shared Zod schema,
  plus `rating` and `rating-pictogram` definitions with locked DEX fields
- Import an existing JSON Schema back into the builder
- Static content blocks (headings, paragraphs) as dataless types, sections or pages
- Conditional visibility (`if`/`then` or `dependencies`)
- Undo/redo
