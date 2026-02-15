/**
 * BridgeError represents a structured error from a Python bridge function.
 *
 * Python convention:
 *   {"error": {"code": "ERROR_CODE", "message": "..."}}
 */
export class BridgeError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "BridgeError";
    this.code = code;
  }
}

/**
 * Detects the Python error dictionary pattern in a result object
 * and throws a BridgeError if found.
 *
 * @param result - The result from a Python function call (after deepConvertMaps)
 * @throws BridgeError if the result contains an error pattern
 */
export function detectBridgeError(result: unknown): void {
  if (typeof result === "object" && result !== null && "error" in result) {
    const errorObj = (result as Record<string, unknown>).error;
    if (
      typeof errorObj === "object" &&
      errorObj !== null &&
      "code" in errorObj &&
      "message" in errorObj
    ) {
      const { code, message } = errorObj as Record<string, unknown>;
      throw new BridgeError(String(code), String(message));
    }
  }
}
