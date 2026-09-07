/**
 * Public surface for hosts embedding the builder.
 */
export { Builder, type BuilderProps } from "./components/Builder"
export { builtInFieldTypes } from "./fieldTypes/builtIns"
export {
  defineFieldType,
  createField,
  type FieldTypeDefinition,
  type PropertySpec,
  type PreviewProps,
  type PropertiesEditorProps,
} from "./model/fieldType"
export { createRegistry, FieldTypeRegistry } from "./model/registry"
export type {
  FieldLocks,
  FieldOption,
  FieldProps,
  FormDefinition,
  FormField,
} from "./model/types"
export { validateForm, type ValidationIssue } from "./model/validate"
export { toJsonSchema } from "./schema/toJsonSchema"
export type {
  GeneratedSchema,
  JsonSchema,
  UiSchema,
  UiFieldSchema,
} from "./schema/jsonSchemaTypes"
export * from "./schema/helpers"
