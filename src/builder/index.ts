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
export {
  referencedFields,
  type Condition,
  type Literal,
} from "./conditions/model"
export {
  parseCondition,
  type ParseContext,
  type ParseResult,
} from "./conditions/parse"
export { printCondition, conditionWithKeys } from "./conditions/print"
export {
  evaluateCondition,
  resolveVisibility,
  visibleValues,
} from "./conditions/evaluate"
export { conditionToSchema } from "./conditions/toSchema"
export {
  checkCondition,
  fieldValueInfo,
  type FieldValueInfo,
} from "./conditions/check"
export { ConditionEditor } from "./components/ConditionEditor"
export { ConditionBuilder } from "./components/ConditionBuilder"
export { ConditionInput } from "./components/ConditionInput"
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
