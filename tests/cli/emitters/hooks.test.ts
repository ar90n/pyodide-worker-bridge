import { describe, it, expect } from "vitest";
import { emitHooks } from "../../../src/cli/emitters/hooks.js";
import type { ModuleIR } from "../../../src/types.js";

const simpleIR: ModuleIR = {
  moduleName: "engine",
  types: [
    { kind: "literal", name: "Status", values: ["ok", "error"] },
    {
      kind: "typeddict",
      name: "InputParams",
      total: false,
      fields: [{ name: "query", type: { kind: "primitive", name: "str" }, required: true }],
    },
    {
      kind: "typeddict",
      name: "Result",
      total: true,
      fields: [{ name: "status", type: { kind: "reference", name: "Status" }, required: true }],
    },
  ],
  functions: [
    {
      name: "run_query",
      params: [{ name: "params", type: { kind: "reference", name: "InputParams" } }],
      returnType: { kind: "reference", name: "Result" },
    },
  ],
  packages: [],
};

describe("emitHooks", () => {
  it("generates hooks code", () => {
    const output = emitHooks(simpleIR);
    expect(output).toMatchSnapshot();
  });

  it("includes DO NOT EDIT header", () => {
    const output = emitHooks(simpleIR);
    expect(output).toContain("DO NOT EDIT");
  });

  it("imports usePyodide and createBridgeHook from pyodide-bridge/react", () => {
    const output = emitHooks(simpleIR);
    expect(output).toContain('from "pyodide-bridge/react"');
  });

  it("re-exports usePyodide", () => {
    const output = emitHooks(simpleIR);
    expect(output).toContain("export { usePyodide }");
  });

  it("generates useRunQuery hook", () => {
    const output = emitHooks(simpleIR);
    expect(output).toContain("useRunQuery");
    expect(output).toContain('createBridgeHook<BridgeAPI, InputParams, Result>("run_query")');
  });

  it("generates PascalCase hook names from snake_case function names", () => {
    const ir: ModuleIR = {
      moduleName: "test",
      types: [],
      functions: [
        {
          name: "get_all_items",
          params: [],
          returnType: { kind: "primitive", name: "str" },
        },
      ],
      packages: [],
    };
    const output = emitHooks(ir);
    expect(output).toContain("useGetAllItems");
  });

  it("imports type references from types file", () => {
    const output = emitHooks(simpleIR);
    expect(output).toContain('from "./engine.types.js"');
    expect(output).toContain("InputParams");
    expect(output).toContain("Result");
  });
});
