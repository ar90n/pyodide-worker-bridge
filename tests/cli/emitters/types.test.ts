import { describe, it, expect } from "vitest";
import { emitTypes } from "../../../src/cli/emitters/types.js";
import type { ModuleIR } from "../../../src/types.js";

const simpleIR: ModuleIR = {
  moduleName: "engine",
  types: [
    {
      kind: "literal",
      name: "Status",
      values: ["ok", "error"],
    },
    {
      kind: "typeddict",
      name: "InputParams",
      total: false,
      fields: [
        { name: "query", type: { kind: "primitive", name: "str" }, required: true },
        { name: "limit", type: { kind: "primitive", name: "int" }, required: false },
      ],
    },
    {
      kind: "typeddict",
      name: "Result",
      total: true,
      fields: [
        {
          name: "data",
          type: { kind: "list", element: { kind: "primitive", name: "float" } },
          required: true,
        },
        { name: "status", type: { kind: "reference", name: "Status" }, required: true },
      ],
    },
  ],
  functions: [],
  packages: [],
};

describe("emitTypes", () => {
  it("generates types from simple IR", () => {
    const output = emitTypes(simpleIR);
    expect(output).toMatchSnapshot();
  });

  it("includes DO NOT EDIT header", () => {
    const output = emitTypes(simpleIR);
    expect(output).toContain("DO NOT EDIT");
  });

  it("generates literal union type", () => {
    const output = emitTypes(simpleIR);
    expect(output).toContain('export type Status = "ok" | "error";');
  });

  it("generates optional fields for total=false TypedDict", () => {
    const output = emitTypes(simpleIR);
    expect(output).toContain("query: string;");
    expect(output).toContain("limit?: number;");
  });

  it("generates list type correctly", () => {
    const output = emitTypes(simpleIR);
    expect(output).toContain("data: number[];");
  });

  it("generates reference type correctly", () => {
    const output = emitTypes(simpleIR);
    expect(output).toContain("status: Status;");
  });

  it("handles empty types array", () => {
    const ir: ModuleIR = {
      moduleName: "empty",
      types: [],
      functions: [],
      packages: [],
    };
    const output = emitTypes(ir);
    expect(output).toContain("DO NOT EDIT");
  });

  it("handles dict type", () => {
    const ir: ModuleIR = {
      moduleName: "test",
      types: [
        {
          kind: "typeddict",
          name: "MapData",
          total: true,
          fields: [
            {
              name: "lookup",
              type: {
                kind: "dict",
                key: { kind: "primitive", name: "str" },
                value: { kind: "primitive", name: "int" },
              },
              required: true,
            },
          ],
        },
      ],
      functions: [],
      packages: [],
    };
    const output = emitTypes(ir);
    expect(output).toContain("lookup: Record<string, number>;");
  });

  it("handles optional type", () => {
    const ir: ModuleIR = {
      moduleName: "test",
      types: [
        {
          kind: "typeddict",
          name: "WithOptional",
          total: true,
          fields: [
            {
              name: "value",
              type: { kind: "optional", inner: { kind: "primitive", name: "int" } },
              required: true,
            },
          ],
        },
      ],
      functions: [],
      packages: [],
    };
    const output = emitTypes(ir);
    expect(output).toContain("value: number | undefined;");
  });
});
