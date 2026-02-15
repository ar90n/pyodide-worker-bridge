import { describe, it, expect } from "vitest";
import { BridgeError, detectBridgeError } from "../../src/runtime/error.js";

describe("BridgeError", () => {
  it("has the correct name", () => {
    const err = new BridgeError("TEST_CODE", "test message");
    expect(err.name).toBe("BridgeError");
  });

  it("stores code and message", () => {
    const err = new BridgeError("INVALID_INPUT", "bad data");
    expect(err.code).toBe("INVALID_INPUT");
    expect(err.message).toBe("bad data");
  });

  it("is an instance of Error", () => {
    const err = new BridgeError("CODE", "msg");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(BridgeError);
  });
});

describe("detectBridgeError", () => {
  it("throws BridgeError for error dict pattern", () => {
    const result = {
      error: { code: "NOT_FOUND", message: "item not found" },
    };
    expect(() => detectBridgeError(result)).toThrow(BridgeError);
    try {
      detectBridgeError(result);
    } catch (err) {
      expect(err).toBeInstanceOf(BridgeError);
      expect((err as BridgeError).code).toBe("NOT_FOUND");
      expect((err as BridgeError).message).toBe("item not found");
    }
  });

  it("does not throw for normal results", () => {
    expect(() => detectBridgeError({ data: [1, 2, 3] })).not.toThrow();
    expect(() => detectBridgeError({ result: "ok" })).not.toThrow();
    expect(() => detectBridgeError("hello")).not.toThrow();
    expect(() => detectBridgeError(42)).not.toThrow();
    expect(() => detectBridgeError(null)).not.toThrow();
  });

  it("does not throw for malformed error patterns", () => {
    // error exists but is not an object
    expect(() => detectBridgeError({ error: "string error" })).not.toThrow();
    // error object missing code
    expect(() => detectBridgeError({ error: { message: "no code" } })).not.toThrow();
    // error object missing message
    expect(() => detectBridgeError({ error: { code: "NO_MSG" } })).not.toThrow();
  });

  it("converts code and message to strings", () => {
    const result = { error: { code: 404, message: 123 } };
    try {
      detectBridgeError(result);
    } catch (err) {
      expect((err as BridgeError).code).toBe("404");
      expect((err as BridgeError).message).toBe("123");
    }
  });
});
