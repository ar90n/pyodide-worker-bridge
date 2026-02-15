/**
 * Recursively converts ES6 Map objects (returned by Pyodide's `toJs()`)
 * to plain JavaScript objects.
 */
export function deepConvertMaps<T = unknown>(value: unknown): T {
  if (value instanceof Map) {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of value) {
      obj[String(k)] = deepConvertMaps(v);
    }
    return obj as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => deepConvertMaps(item)) as T;
  }

  // Primitives and other objects pass through unchanged
  return value as T;
}
