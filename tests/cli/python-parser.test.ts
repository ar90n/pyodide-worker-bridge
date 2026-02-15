import { describe, it, expect } from "vitest";
import { parsePythonModule, PythonParseError } from "../../src/cli/python-parser.js";
import path from "node:path";

const FIXTURES_DIR = path.resolve(import.meta.dirname, "../fixtures");

describe("parsePythonModule", () => {
  it("parses simple.py correctly", async () => {
    const ir = await parsePythonModule(path.join(FIXTURES_DIR, "simple.py"));
    expect(ir.moduleName).toBe("simple");
    expect(ir.types.length).toBeGreaterThan(0);
    expect(ir.functions.length).toBe(1);
    expect(ir.functions[0].name).toBe("run_query");
    expect(ir.packages).toEqual(["numpy"]);
  });

  it("parses multiple-types.py correctly", async () => {
    const ir = await parsePythonModule(path.join(FIXTURES_DIR, "multiple-types.py"));
    expect(ir.moduleName).toBe("multiple-types");
    expect(ir.functions.length).toBe(2);
    const funcNames = ir.functions.map((f) => f.name);
    expect(funcNames).toContain("create_task");
    expect(funcNames).toContain("get_summary");
  });

  it("returns empty functions for no-exports.py", async () => {
    const ir = await parsePythonModule(path.join(FIXTURES_DIR, "no-exports.py"));
    expect(ir.functions).toEqual([]);
    expect(ir.types.length).toBe(1);
  });

  it("throws PythonParseError for syntax errors", async () => {
    await expect(
      parsePythonModule(path.join(FIXTURES_DIR, "syntax-error.py")),
    ).rejects.toThrow(PythonParseError);
  });

  it("throws for non-existent files", async () => {
    await expect(parsePythonModule("/nonexistent/file.py")).rejects.toThrow();
  });
});
