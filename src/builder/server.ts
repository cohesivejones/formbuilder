/**
 * The server's entry point: everything needed to hold a submission to the same
 * rules the browser shows, and to validate a definition on write, with no
 * React, CSS or DOM anywhere in the import graph — a test walks the graph from
 * this file and fails if UI ever leaks in.
 *
 * The intended flow for a submission API:
 *
 *   const processor = createSubmissionProcessor(definition, coreFieldTypes)
 *   const { data, errors } = processor.process(request.body)
 *   if (Object.keys(errors).length > 0) reject(errors)
 *   else store(data)
 *
 * `coreFieldTypes` are the built-in types minus their rendering; the browser's
 * registry is these plus rendering, so both sides compute identical schemas,
 * visibility and errors. Host-defined types participate the same way: keep
 * each type's schema/validation half importable without its components and
 * pass those here.
 */
export {
  createSubmissionProcessor,
  type ProcessedSubmission,
  type ProcessOptions,
  type SubmissionProcessor,
} from "./submission/processSubmission"
export {
  createSubmissionValidator,
  prune,
  type SubmissionData,
  type SubmissionErrors,
} from "./submission/validateSubmission"
export { coreFieldTypes } from "./fieldTypes/core"
export { toJsonSchema } from "./schema/toJsonSchema"
export type {
  GeneratedSchema,
  JsonSchema,
  UiSchema,
  UiFieldSchema,
} from "./schema/jsonSchemaTypes"
export { validateForm, type ValidationIssue } from "./model/validate"
export { createRegistry, FieldTypeRegistry } from "./model/registry"
export {
  defineFieldType,
  createField,
  type FieldTypeDefinition,
  type PropertySpec,
} from "./model/fieldType"
export type {
  FieldLocks,
  FieldOption,
  FieldProps,
  FormDefinition,
  FormField,
} from "./model/types"
export {
  referencedFields,
  isBuilderEditable,
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
