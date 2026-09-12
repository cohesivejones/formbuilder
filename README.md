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

The demo has two routes:

| Route          | What it shows                                              |
| -------------- | ---------------------------------------------------------- |
| `/`            | The full builder, every capability enabled                 |
| `/locked-down` | One fixed form an admin may only reword, reorder and prune |

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
  visibleWhen?: Condition // shown only while this holds — see conditional logic
  requiredWhen?: Condition // an answer demanded only while this holds
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

## Rendering a form

`FormRenderer` turns a definition into a working form. Answers are validated
against the JSON Schema generated from that same definition, so respondents are
held to exactly what the schema describes rather than a parallel set of rules.

```tsx
import { FormRenderer } from "./builder"

;<FormRenderer
  form={definition}
  fieldTypes={fieldTypes} // must cover every type the form uses
  onSubmit={(answers) => save(answers)}
  submitLabel="Send feedback"
/>
```

`printable` adds a Print action, described under printing and PDF below.

`onSubmit` receives the answers with blanks removed, so an untouched field is
absent rather than an empty string. The shape matches the emitted schema, which
means the same document can validate the submission again server-side.

A field type supplies its control through `Input`, the counterpart to the
builder's `Preview`:

```tsx
Input: ({ field, value, onChange, id, describedBy, invalid }) => (
  <input
    id={id}
    className="control"
    value={typeof value === "string" ? value : ""}
    aria-describedby={describedBy}
    aria-invalid={invalid || undefined}
    onChange={(event) => onChange(event.target.value)}
  />
),
labelMode: "control",
```

The renderer owns the label, help text and error message and passes the `id` and
`describedBy` that tie them together, so an `Input` renders only the control.
`labelMode` says how to label it: `control` puts a `<label for>` above (the
default), `inline` places it beside a lone checkbox, and `group` wraps a set of
radios or checkboxes in a fieldset and legend. A type with no `Input` collects
nothing and renders its `Preview` instead, which is how a `dataless` placeholder
explains itself to a respondent.

Errors stay hidden until the first submit, then update live as each is fixed.
That is deliberate: revealing an error when a field loses focus grows the form
at the moment of a click, and the button moving out from under the pointer
swallows the press.

### Printing, paper fallback and PDF

The renderer carries a print stylesheet, so **Print** in the actions row (or
Ctrl/Cmd+P) produces the form on its own: the demo nav, the definition sidebar
and the buttons drop away, the page grows to its natural height instead of the
fixed app shell, and no question is split across a page break. Every browser's
print dialogue offers "Save as PDF", so that is the PDF path too, with nothing
to install. Pass `printable={false}` if the host supplies its own print control.

The output is built to be **completed by hand**, for the case where a site keeps
printed forms on file against a dropped connection. Print before answering for a
blank form, or after answering for a record of what was submitted. Three things
differ on paper:

- **A dropdown becomes a tick list of every option.** Printed as-is it would
  show only its current value, leaving nobody anything to choose from. Whatever
  is selected on screen is ticked, so a completed form still prints its answer.
- **Placeholders are hidden.** On screen "Jane Citizen" is a hint; on paper it
  reads as an answer somebody already wrote. A date field keeps its own
  `dd/mm/yyyy`, which is a format hint rather than an example, and loses only
  its calendar button.
- **Boxes are sized for handwriting** rather than for a pointer.

Chrome's print dialogue leaves "background graphics" off by default. Field
borders, empty tick boxes and ticked controls all survive that, so a printed
form is usable either way; the tick marks on a printed dropdown are drawn as
text for the same reason. This was checked by generating PDFs both ways through
headless Chromium.

Generating PDFs unattended, on a server or without a person pressing Print, is a
different job. That wants headless Chromium rendering this same page, which the
print stylesheet already makes straightforward.

Filling forms offline in the browser, rather than on paper, is a different
problem again: it needs the app installable and its submissions queued for
later, not a print stylesheet.

## Conditional logic

A field can carry two rules: `visibleWhen` and `requiredWhen`. Rules are stored
as small expression trees referencing other fields by their stable internal id,
never as code, so nothing is evaluated with `eval`, the same rule runs on a
CSP-locked kiosk or a server, and the builder can reason about rules — flagging
one that refers to a deleted field, or a set of visibility rules that form a
loop.

Admins author rules in an expression language, edited per field under
**Conditions** in the inspector:

```
contactMethod = 'phone'
hasAllergies = true and householdSize >= 3
services contains 'other'
not (region is empty)
```

Comparisons are `=`, `!=`, `>`, `>=`, `<`, `<=`, `contains`, `is empty` and
`is not empty`, combined with `and`, `or`, `not` and parentheses; values are
quoted strings, numbers, `true` or `false`. Fields are referred to by key, with
completions offered as one is typed and a suggestion on a typo. The text is
parsed into the tree on every keystroke and never stored: renaming a field later
breaks nothing, and the box re-displays the rule with current keys.

The input is semantically checked as well as parsed, using each field's own
schema mapping as the source of type truth. A rule that could never match is
refused with the reason: `contactMethod = 'phome'` gets "contactMethod has no
option 'phome' — its options are 'phone', 'email', 'none'", an ordering
comparison against a date or text field is rejected, and equality against a
multi-choice field points to `contains`. Form validation runs the same check on
stored rules, so a rule invalidated later — say by renaming an option it names —
is flagged rather than silently never matching.

The semantics are the ones that keep data honest:

- A hidden field keeps its answer on screen, so toggling a checkbox twice loses
  nothing, but the answer takes no part in validation and never leaves the form
  in a submission.
- A hidden field is never required, whatever its other settings say.
- Visibility cascades: if X shows Y and Y shows Z, hiding X takes Z down too,
  because rules are evaluated only against the answers of visible fields.
- On paper, where nothing can react, every question prints — hidden ones under
  an italic "Only if:" note stating when they apply.

Requiredness rides the exported JSON Schema as `if`/`then` clauses with
visibility folded in, so the renderer's Ajv path and any server enforce the
same conditions from the same document, with no knowledge of the rule language.
Visibility itself is presentation and travels in the UI schema as
`ui:visibleWhen`, the condition tree with keys in place of ids. One deliberate
limit: comparisons are always against literal values, never between two fields,
which is exactly the subset JSON Schema can express.

`/playground` takes a single expression apart: the tree it parses to, the
schema fragment it compiles to, and its verdict against editable sample
answers — including a preset pair showing that `and` binds tighter than `or`
and parentheses regroup. The `/conditions` demo shows both sides over one
definition: fill the form in
and watch fields come and go, or switch to "Edit the rules" for the real
builder, where the sidebar's expressions are written. It also shows how a rule
is stored: as data on its field inside the definition, which is what persists,
pastes and exports — the expression text itself is never saved.

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

The demo has a worked example at `/locked-down`: a fixed client feedback form
whose three outcome questions are pinned because their keys anchor a downstream
export, while the program question slot and the free-text comment stay movable
and removable. See [lockedDownForm.ts](src/examples/lockedDownForm.ts).

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
  App.tsx                         Demo routes
  demo/
    DemoNav.tsx                   Route switcher
    FullBuilderPage.tsx           Unrestricted builder
    LockedDownFormPage.tsx        Restricted builder, host-owned state
    RendererPage.tsx              Paste a definition and fill it in
    ConditionsPage.tsx            Conditional logic, live, with its rules shown
  examples/
    programQuestionSlot.tsx       A host-defined field type
    lockedDownForm.ts             A fixed form with pinned fields
  builder/
    index.ts                      Public surface for hosts
    conditions/
      model.ts                    Condition trees, the stored form of a rule
      parse.ts                    The expression language admins type
      print.ts                    Trees back to expressions, keys or labels
      evaluate.ts                 Evaluation, visibility fixpoint, pruning
      toSchema.ts                 Conditions compiled to JSON Schema fragments
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
      inputs.tsx                  Their interactive controls, for the renderer
    render/
      FormRenderer.tsx            A definition rendered as a working form
      validateSubmission.ts       Answers checked against the emitted schema
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

There are two layers. Unit and component tests run in jsdom with `npm test`.
Real-browser checks live in [checks/](checks/) and run with
`npm run check:browser` (or `npm run check:browser -- dnd` for one): the runner
starts a dev server, drives headless Chromium through pointer drag-and-drop,
printing to PDF, the permission-restricted page, conditional logic and the
playground, and writes its screenshots and PDFs to `checks/output` for
inspection. The checks are TypeScript like everything else, run directly by
Node's type stripping; `playwright` is a devDependency, and its browser
binaries come from the shared `ms-playwright` cache (`npx playwright install
chromium` fetches them if missing).

Pure logic (schema conversion, reducer, validation, registry, key slugging) is
unit tested, including compiling the generated schema with Ajv in strict 2020-12
mode and validating sample data against it. The renderer is tested through
filling in every built-in type, the errors each constraint produces, and the
answers it finally submits. The `Builder` component is tested
with Testing Library through click-to-add, editing, reordering, option editing,
custom types, locks, permissions and controlled mode. Pointer drag-and-drop is
not exercised in jsdom.

## Ideas for the next cut

- Adapter in the feedback repo mapping `FormDefinition` to the shared Zod schema,
  plus `rating` and `rating-pictogram` definitions with locked DEX fields
- Import an existing JSON Schema back into the builder
- Static content blocks (headings, paragraphs) as dataless types, sections or pages
- Named predicates: developer-registered functions a rule can reference for
  logic beyond the expression language
- Undo/redo
- A live preview pane in the builder, reusing `FormRenderer`
- Server-side PDF generation for unattended exports
