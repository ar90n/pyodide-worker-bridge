import { describe, it, expect } from "vitest";
import { wrapProxy, unwrapProxy } from "../../src/runtime/comlink-helpers.js";

describe("wrapProxy", () => {
  it("wraps a value in a { ref } object", () => {
    const proxy = { method: () => "result" };
    const wrapped = wrapProxy(proxy);
    expect(wrapped).toEqual({ ref: proxy });
    expect(wrapped.ref).toBe(proxy);
  });

  it("wraps a function", () => {
    const fn = () => 42;
    const wrapped = wrapProxy(fn);
    expect(wrapped.ref).toBe(fn);
    expect(typeof wrapped.ref).toBe("function");
  });

  it("wraps null", () => {
    const wrapped = wrapProxy(null);
    expect(wrapped).toEqual({ ref: null });
  });
});

describe("unwrapProxy", () => {
  it("unwraps a { ref } object", () => {
    const proxy = { method: () => "result" };
    const wrapped = wrapProxy(proxy);
    const unwrapped = unwrapProxy(wrapped);
    expect(unwrapped).toBe(proxy);
  });

  it("is the inverse of wrapProxy", () => {
    const original = { a: 1, b: 2 };
    const roundTripped = unwrapProxy(wrapProxy(original));
    expect(roundTripped).toBe(original);
  });
});
