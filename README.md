# Form Builder

A drag-and-drop form builder written in React and TypeScript. You compose a form
from a palette of input types, edit each field's properties, and the builder emits
a **JSON Schema** (draft 2020-12) describing the data plus a **UI schema** carrying
presentation hints such as "render this as radio buttons".

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
  App.tsx                         Mounts the builder
  builder/
    model/
      types.ts                    FormDefinition and the FormField union
      fieldRegistry.ts            Palette entries and per-type defaults
      keys.ts                     Label → key slugging, uniqueness, ids
      validate.ts                 Issues that would make the schema wrong
      sample.ts                   Example form
    schema/
      jsonSchemaTypes.ts          The JSON Schema subset we emit
      toJsonSchema.ts             FormDefinition → { schema, uiSchema }
    state/
      reducer.ts                  All builder actions (add, move, update…)
      useFormBuilder.ts           Reducer + derived data + localStorage
    components/
      Builder.tsx                 Layout and DndContext wiring
      Palette.tsx                 Draggable field types
      Canvas.tsx / CanvasField.tsx  Sortable field cards
      FieldPreview.tsx            Read-only rendering of each input type
      PropertiesPanel.tsx         Field editor
      OptionsEditor.tsx           Label/value editor for choice fields
      SchemaOutput.tsx            JSON output, copy, download, issues
```

Drag and drop is built on [dnd-kit](https://dndkit.com/): palette items are
`useDraggable`, canvas cards are `useSortable`, and the canvas is a `useDroppable`
so dropping in empty space appends.

## Tests

Pure logic (schema conversion, reducer, validation, key slugging) is unit tested,
including compiling the generated schema with Ajv in strict 2020-12 mode and
validating sample data against it. The `Builder` component is tested with
Testing Library through click-to-add, editing, reordering and option editing.
Pointer drag-and-drop is not exercised in jsdom.

## Ideas for the next cut

- Import an existing JSON Schema back into the builder
- Static content blocks (headings, paragraphs) and sections or pages
- Conditional visibility (`if`/`then` or `dependencies`)
- Undo/redo
- A renderer that turns the emitted schema back into a live form for preview
