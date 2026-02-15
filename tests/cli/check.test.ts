import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { checkGenerated } from "../../src/cli/check.js";
import { emitTypes } from "../../src/cli/emitters/types.js";
import { emitWorker } from "../../src/cli/emitters/worker.js";
import { emitHooks } from "../../src/cli/emitters/hooks.js";
import type { ModuleIR } from "../../src/types.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const testIR: ModuleIR = {
  moduleName: "test",
  types: [{ kind: "literal", name: "Status", values: ["ok", "error"] }],
  functions: [
    {
      name: "run",
      params: [{ name: "input", type: { kind: "primitive", name: "str" } }],
      returnType: { kind: "primitive", name: "str" },
    },
  ],
  packages: [],
};

const workerOptions = {
  pyodideVersion: "0.26.4",
  bundler: "vite" as const,
};

describe("checkGenerated", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pyodide-bridge-check-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns upToDate=false when files do not exist", () => {
    const result = checkGenerated(testIR, tmpDir, workerOptions, true);
    expect(result.upToDate).toBe(false);
    expect(result.outdatedFiles.length).toBe(3);
  });

  it("returns upToDate=true when files match", () => {
    // Write the expected files
    fs.writeFileSync(path.join(tmpDir, "test.types.ts"), emitTypes(testIR));
    fs.writeFileSync(path.join(tmpDir, "test.worker.ts"), emitWorker(testIR, workerOptions));
    fs.writeFileSync(path.join(tmpDir, "test.hooks.ts"), emitHooks(testIR));

    const result = checkGenerated(testIR, tmpDir, workerOptions, true);
    expect(result.upToDate).toBe(true);
    expect(result.outdatedFiles).toEqual([]);
  });

  it("detects outdated types file", () => {
    fs.writeFileSync(path.join(tmpDir, "test.types.ts"), "// old content");
    fs.writeFileSync(path.join(tmpDir, "test.worker.ts"), emitWorker(testIR, workerOptions));
    fs.writeFileSync(path.join(tmpDir, "test.hooks.ts"), emitHooks(testIR));

    const result = checkGenerated(testIR, tmpDir, workerOptions, true);
    expect(result.upToDate).toBe(false);
    expect(result.outdatedFiles).toContain(path.join(tmpDir, "test.types.ts"));
  });

  it("skips hooks check when generateReact is false", () => {
    fs.writeFileSync(path.join(tmpDir, "test.types.ts"), emitTypes(testIR));
    fs.writeFileSync(path.join(tmpDir, "test.worker.ts"), emitWorker(testIR, workerOptions));
    // No hooks file

    const result = checkGenerated(testIR, tmpDir, workerOptions, false);
    expect(result.upToDate).toBe(true);
  });
});
