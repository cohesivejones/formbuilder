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
  type FieldInputProps,
  type LabelMode,
} from "./model/fieldType"
export {
  effectiveLocks,
  resolvePermissions,
  FULL_PERMISSIONS,
  type BuilderPermissions,
  type ResolvedPermissions,
  type ResolvedLocks,
} from "./model/permissions"
export { createRegistry, FieldTypeRegistry } from "./model/registry"
export type {
  FieldLocks,
  FieldOption,
  FieldProps,
  FormDefinition,
  FormField,
} from "./model/types"
export { validateForm, type ValidationIssue } from "./model/validate"
export { readPersistedForm } from "./state/useFormBuilder"
export { FormRenderer, type FormRendererProps } from "./render/FormRenderer"
export {
  createSubmissionValidator,
  prune,
  type SubmissionData,
  type SubmissionErrors,
} from "./render/validateSubmission"
export { toJsonSchema } from "./schema/toJsonSchema"
export type {
  GeneratedSchema,
  JsonSchema,
  UiSchema,
  UiFieldSchema,
} from "./schema/jsonSchemaTypes"
export * from "./schema/helpers"
