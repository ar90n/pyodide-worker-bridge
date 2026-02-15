#!/usr/bin/env node
/**
 * pyodide-bridge CLI entry point.
 *
 * Usage:
 *   pyodide-bridge gen [options]
 */
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { loadConfig, mergeCliArgs, ConfigValidationError } from "./config.js";
import { parsePythonModule, PythonNotFoundError, PythonParseError } from "./python-parser.js";
import { emitTypes } from "./emitters/types.js";
import { emitWorker } from "./emitters/worker.js";
import { emitHooks } from "./emitters/hooks.js";
import { checkGenerated } from "./check.js";

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      input: { type: "string" },
      outdir: { type: "string" },
      config: { type: "string" },
      "pyodide-version": { type: "string" },
      bundler: { type: "string" },
      "no-react": { type: "boolean", default: false },
      check: { type: "boolean", default: false },
      verbose: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help || positionals.length === 0) {
    printUsage();
    process.exit(0);
  }

  const command = positionals[0];
  if (command !== "gen") {
    console.error(`Unknown command: ${command}`);
    printUsage();
    process.exit(1);
  }

  try {
    // Load config
    const fileConfig = await loadConfig(values.config);
    const config = mergeCliArgs(fileConfig, {
      input: values.input,
      outdir: values.outdir,
      pyodideVersion: values["pyodide-version"],
      bundler: values.bundler,
      react: values["no-react"] ? false : undefined,
    });

    const isCheck = values.check ?? false;
    const verbose = values.verbose ?? false;
    let allUpToDate = true;

    // Process each module
    for (const mod of config.modules) {
      if (verbose) {
        console.log(`Processing ${mod.input}...`);
      }

      // Parse Python module
      const ir = await parsePythonModule(mod.input);

      const workerOptions = {
        pyodideVersion: config.pyodideVersion,
        bundler: config.bundler || "vite",
      } as const;

      if (isCheck) {
        // Check mode
        const result = checkGenerated(ir, mod.outdir, workerOptions, config.react !== false);
        if (!result.upToDate) {
          allUpToDate = false;
          for (const file of result.outdatedFiles) {
            console.error(`Outdated: ${file}`);
          }
        } else if (verbose) {
          console.log(`  ✓ ${mod.input} is up-to-date`);
        }
      } else {
        // Generate mode
        fs.mkdirSync(mod.outdir, { recursive: true });

        // Generate .types.ts
        const typesContent = emitTypes(ir);
        const typesPath = path.join(mod.outdir, `${ir.moduleName}.types.ts`);
        fs.writeFileSync(typesPath, typesContent, "utf-8");
        if (verbose) console.log(`  Generated ${typesPath}`);

        // Generate .worker.ts
        const workerContent = emitWorker(ir, workerOptions);
        const workerPath = path.join(mod.outdir, `${ir.moduleName}.worker.ts`);
        fs.writeFileSync(workerPath, workerContent, "utf-8");
        if (verbose) console.log(`  Generated ${workerPath}`);

        // Generate .hooks.ts (if React is enabled)
        if (config.react !== false) {
          const hooksContent = emitHooks(ir);
          const hooksPath = path.join(mod.outdir, `${ir.moduleName}.hooks.ts`);
          fs.writeFileSync(hooksPath, hooksContent, "utf-8");
          if (verbose) console.log(`  Generated ${hooksPath}`);
        }
      }
    }

    if (isCheck && !allUpToDate) {
      console.error(
        "\nGenerated files are not up-to-date. Run `pyodide-bridge gen` to regenerate.",
      );
      process.exit(1);
    }

    if (!isCheck) {
      console.log("✓ Bridge files generated successfully.");
    } else if (verbose) {
      console.log("✓ All generated files are up-to-date.");
    }
  } catch (err) {
    if (err instanceof PythonNotFoundError) {
      console.error(err.message);
      process.exit(1);
    }
    if (err instanceof PythonParseError) {
      console.error(`Parse error in ${err.file}: ${err.message}`);
      process.exit(1);
    }
    if (err instanceof ConfigValidationError) {
      console.error(`Config error: ${err.message}`);
      process.exit(1);
    }
    console.error("Unexpected error:", err);
    process.exit(2);
  }
}

function printUsage(): void {
  console.log(`
pyodide-bridge - Generate type-safe TypeScript bridges from Python modules

Usage:
  pyodide-bridge gen [options]

Options:
  --input <path>          Python source file (not required with config file)
  --outdir <path>         Output directory (not required with config file)
  --config <path>         Config file path (default: ./pyodide-bridge.config.ts)
  --pyodide-version <ver> Pyodide CDN version
  --bundler <type>        Bundler type: vite | webpack | inline (default: vite)
  --no-react              Skip React hooks generation
  --check                 Check if generated files are up-to-date (for CI)
  --verbose               Verbose output
  -h, --help              Show this help message
`);
}

main();
