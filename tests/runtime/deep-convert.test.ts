import { describe, it, expect } from "vitest";
import { deepConvertMaps } from "../../src/runtime/deep-convert.js";

describe("deepConvertMaps", () => {
  it("converts a flat Map to a plain object", () => {
    const map = new Map([
      ["name", "Alice"],
      ["age", 30],
    ]);
    const result = deepConvertMaps(map);
    expect(result).toEqual({ name: "Alice", age: 30 });
  });

  it("recursively converts nested Maps", () => {
    const inner = new Map([
      ["x", 1],
      ["y", 2],
    ]);
    const outer = new Map([
      ["point", inner],
      ["label", "origin"],
    ]);
    const result = deepConvertMaps(outer);
    expect(result).toEqual({
      point: { x: 1, y: 2 },
      label: "origin",
    });
  });

  it("converts Maps inside arrays", () => {
    const items = [
      new Map([["id", 1]]),
      new Map([["id", 2]]),
    ];
    const result = deepConvertMaps(items);
    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("handles deeply nested structures", () => {
    const data = new Map([
      [
        "nested",
        new Map([
          [
            "deep",
            new Map([["value", 42]]),
          ],
        ]),
      ],
    ]);
    const result = deepConvertMaps(data);
    expect(result).toEqual({ nested: { deep: { value: 42 } } });
  });

  it("returns primitives unchanged", () => {
    expect(deepConvertMaps("hello")).toBe("hello");
    expect(deepConvertMaps(42)).toBe(42);
    expect(deepConvertMaps(true)).toBe(true);
    expect(deepConvertMaps(null)).toBe(null);
    expect(deepConvertMaps(undefined)).toBe(undefined);
  });

  it("returns plain objects unchanged", () => {
    const obj = { foo: "bar" };
    expect(deepConvertMaps(obj)).toBe(obj);
  });

  it("handles empty Map", () => {
    const result = deepConvertMaps(new Map());
    expect(result).toEqual({});
  });

  it("handles empty array", () => {
    const result = deepConvertMaps([]);
    expect(result).toEqual([]);
  });

  it("converts Map keys to strings", () => {
    const map = new Map<unknown, unknown>([
      [1, "one"],
      [2, "two"],
    ]);
    const result = deepConvertMaps<Record<string, string>>(map);
    expect(result).toEqual({ "1": "one", "2": "two" });
  });
});
