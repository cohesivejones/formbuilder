import type { FieldTypeDefinition } from "./fieldType"

/**
 * The set of field types a Builder instance knows about. Looking up a type that
 * was never registered (for example a saved form from a host that has since
 * dropped a type) yields a placeholder definition so the field is preserved
 * and flagged rather than lost.
 */
export class FieldTypeRegistry {
  private readonly definitions = new Map<string, FieldTypeDefinition>()
  private readonly placeholders = new Map<string, FieldTypeDefinition>()

  constructor(definitions: readonly FieldTypeDefinition[]) {
    for (const definition of definitions) {
      if (this.definitions.has(definition.type)) {
        throw new Error(`Field type "${definition.type}" is registered twice`)
      }
      this.definitions.set(definition.type, definition)
    }
  }

  /** Registered definitions in registration order (the palette order). */
  all(): FieldTypeDefinition[] {
    return [...this.definitions.values()]
  }

  has(type: string): boolean {
    return this.definitions.has(type)
  }

  get(type: string): FieldTypeDefinition | undefined {
    return this.definitions.get(type)
  }

  /** Like `get`, but returns a preserving placeholder for unregistered types. */
  resolve(type: string): FieldTypeDefinition {
    const known = this.definitions.get(type)
    if (known) return known

    let placeholder = this.placeholders.get(type)
    if (!placeholder) {
      placeholder = {
        type,
        label: type,
        description: "Unregistered field type",
        icon: "?",
        defaults: {},
        properties: [],
        validate: () => [`Field type "${type}" is not registered`],
      }
      this.placeholders.set(type, placeholder)
    }
    return placeholder
  }
}

export function createRegistry(
  definitions: readonly FieldTypeDefinition[],
): FieldTypeRegistry {
  return new FieldTypeRegistry(definitions)
}
