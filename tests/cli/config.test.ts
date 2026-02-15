import { describe, it, expect } from "vitest";
import { mergeCliArgs, ConfigValidationError } from "../../src/cli/config.js";
import type { BridgeConfig } from "../../src/cli/config.js";

describe("mergeCliArgs", () => {
  const baseConfig: BridgeConfig = {
    pyodideVersion: "0.26.4",
    modules: [{ input: "src/python/engine.py", outdir: "src/generated" }],
    react: true,
    bundler: "vite",
  };

  it("uses config file values when no CLI args", () => {
    const result = mergeCliArgs(baseConfig, {});
    expect(result.pyodideVersion).toBe("0.26.4");
    expect(result.modules).toEqual(baseConfig.modules);
    expect(result.react).toBe(true);
    expect(result.bundler).toBe("vite");
  });

  it("CLI args override config file", () => {
    const result = mergeCliArgs(baseConfig, {
      pyodideVersion: "0.27.0",
      bundler: "webpack",
      react: false,
    });
    expect(result.pyodideVersion).toBe("0.27.0");
    expect(result.bundler).toBe("webpack");
    expect(result.react).toBe(false);
  });

  it("requires --input and --outdir when no config file", () => {
    expect(() => mergeCliArgs(null, {})).toThrow(ConfigValidationError);
    expect(() => mergeCliArgs(null, { input: "test.py" })).toThrow(ConfigValidationError);
  });

  it("requires --pyodide-version when no config file", () => {
    expect(() => mergeCliArgs(null, { input: "test.py", outdir: "out" })).toThrow(
      ConfigValidationError,
    );
  });

  it("builds config from CLI args when no config file", () => {
    const result = mergeCliArgs(null, {
      input: "engine.py",
      outdir: "generated",
      pyodideVersion: "0.26.4",
    });
    expect(result.pyodideVersion).toBe("0.26.4");
    expect(result.modules).toEqual([{ input: "engine.py", outdir: "generated" }]);
    expect(result.react).toBe(true); // default
    expect(result.bundler).toBe("vite"); // default
  });
});
