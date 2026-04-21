/**
 * Vortex SDK Documentation Decorators
 *
 * These decorators mark methods for documentation extraction.
 * The extractor reads this metadata to generate SDK documentation.
 *
 * @module decorators
 */

/**
 * Metadata for a Vortex SDK method
 */
export interface VortexMethodMetadata {
  /** Method category (e.g., 'authentication', 'invitations', 'autojoin') */
  category: string;
  /** Version when this method was added (e.g., '0.5.0') */
  since: string;
  /** Whether this is a primary (happy-path) method */
  primary?: boolean;
  /** Whether this method is deprecated */
  deprecated?: boolean;
  /** Deprecation message with migration guidance */
  deprecationMessage?: string;
  /** Whether this method is internal (hidden from public docs) */
  internal?: boolean;
}

/**
 * Storage for method metadata.
 * Maps: ClassName -> MethodName -> Metadata
 */
export const VORTEX_METHOD_METADATA = new Map<string, Map<string, VortexMethodMetadata>>();

/**
 * Get all method metadata for a class
 */
export function getClassMethodMetadata(
  className: string
): Map<string, VortexMethodMetadata> | undefined {
  return VORTEX_METHOD_METADATA.get(className);
}

/**
 * Get metadata for a specific method by class and method name
 */
export function getClassMethodMetadataByName(
  className: string,
  methodName: string
): VortexMethodMetadata | undefined {
  return VORTEX_METHOD_METADATA.get(className)?.get(methodName);
}

/**
 * Get metadata for a method by name (searches all classes)
 */
export function getMethodMetadata(methodName: string): VortexMethodMetadata | undefined {
  for (const [, methods] of VORTEX_METHOD_METADATA) {
    const metadata = methods.get(methodName);
    if (metadata) return { ...metadata };
  }
  return undefined;
}

/**
 * Mark a method for documentation with category and version info.
 *
 * @param options - Method metadata
 * @param options.category - Method category (e.g., 'authentication', 'invitations')
 * @param options.since - Version when this method was added
 * @param options.deprecated - Whether this method is deprecated
 * @param options.deprecationMessage - Migration guidance for deprecated methods
 *
 * @example
 * ```typescript
 * @VortexMethod({ category: 'authentication', since: '0.5.0' })
 * sign(user: User): string { }
 * ```
 */
export function VortexMethod(options: Omit<VortexMethodMetadata, 'primary'>): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    _descriptor: PropertyDescriptor
  ): void {
    const className = target.constructor.name;
    const methodName = String(propertyKey);

    if (!VORTEX_METHOD_METADATA.has(className)) {
      VORTEX_METHOD_METADATA.set(className, new Map());
    }

    const classMetadata = VORTEX_METHOD_METADATA.get(className)!;
    const existing = classMetadata.get(methodName) || ({} as VortexMethodMetadata);

    classMetadata.set(methodName, {
      ...existing,
      ...options,
    });
  };
}

/**
 * Mark a method as a primary (happy-path) method.
 * Primary methods are shown prominently in generated documentation.
 *
 * Use this for the most important methods that users need for common use cases.
 *
 * @example
 * ```typescript
 * @VortexPrimary()
 * @VortexMethod({ category: 'authentication', since: '0.5.0' })
 * sign(user: User): string { }
 * ```
 */
export function VortexPrimary(): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    _descriptor: PropertyDescriptor
  ): void {
    const className = target.constructor.name;
    const methodName = String(propertyKey);

    if (!VORTEX_METHOD_METADATA.has(className)) {
      VORTEX_METHOD_METADATA.set(className, new Map());
    }

    const classMetadata = VORTEX_METHOD_METADATA.get(className)!;
    const existing = classMetadata.get(methodName) || ({} as VortexMethodMetadata);

    classMetadata.set(methodName, {
      ...existing,
      primary: true,
    });
  };
}

/**
 * Get all method metadata across all classes (for testing)
 */
export function getAllMethodMetadata(): Record<string, VortexMethodMetadata> {
  const result: Record<string, VortexMethodMetadata> = {};
  for (const [, methods] of VORTEX_METHOD_METADATA) {
    for (const [methodName, metadata] of methods) {
      result[methodName] = { ...metadata };
    }
  }
  return result;
}

/**
 * Clear all stored metadata (for testing)
 */
export function clearMetadata(): void {
  VORTEX_METHOD_METADATA.clear();
}
