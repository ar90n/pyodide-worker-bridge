import { describe, it, expect } from "vitest";
import { emitWorker } from "../../../src/cli/emitters/worker.js";
import type { ModuleIR } from "../../../src/types.js";

const simpleIR: ModuleIR = {
  moduleName: "engine",
  types: [
    { kind: "literal", name: "Status", values: ["ok", "error"] },
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
  functions: [
    {
      name: "run_query",
      params: [{ name: "params", type: { kind: "reference", name: "InputParams" } }],
      returnType: { kind: "reference", name: "Result" },
    },
  ],
  packages: ["numpy"],
};

describe("emitWorker", () => {
  it("generates worker code with Vite bundler", () => {
    const output = emitWorker(simpleIR, {
      pyodideVersion: "0.26.4",
      bundler: "vite",
    });
    expect(output).toMatchSnapshot();
  });

  it("includes DO NOT EDIT header", () => {
    const output = emitWorker(simpleIR, {
      pyodideVersion: "0.26.4",
      bundler: "vite",
    });
    expect(output).toContain("DO NOT EDIT");
  });

  it("imports Comlink", () => {
    const output = emitWorker(simpleIR, {
      pyodideVersion: "0.26.4",
      bundler: "vite",
    });
    expect(output).toContain('import * as Comlink from "comlink"');
  });

  it("uses ?raw import for Vite", () => {
    const output = emitWorker(simpleIR, {
      pyodideVersion: "0.26.4",
      bundler: "vite",
    });
    expect(output).toContain("?raw");
  });

  it("uses !!raw-loader! for Webpack", () => {
    const output = emitWorker(simpleIR, {
      pyodideVersion: "0.26.4",
      bundler: "webpack",
    });
    expect(output).toContain("!!raw-loader!");
  });

  it("embeds inline source for inline bundler", () => {
    const output = emitWorker(simpleIR, {
      pyodideVersion: "0.26.4",
      bundler: "inline",
    });
    expect(output).toContain("const pythonSource");
  });

  it("includes package list", () => {
    const output = emitWorker(simpleIR, {
      pyodideVersion: "0.26.4",
      bundler: "vite",
    });
    expect(output).toContain('["numpy"]');
  });

  it("generates BridgeAPI interface", () => {
    const output = emitWorker(simpleIR, {
      pyodideVersion: "0.26.4",
      bundler: "vite",
    });
    expect(output).toContain("export interface BridgeAPI");
    expect(output).toContain("run_query(params: InputParams): Promise<Result>");
  });

  it("generates Comlink.expose call", () => {
    const output = emitWorker(simpleIR, {
      pyodideVersion: "0.26.4",
      bundler: "vite",
    });
    expect(output).toContain("Comlink.expose(api)");
  });
});
