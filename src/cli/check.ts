/**
 * Check mode: verify that generated files are up-to-date.
 */
import fs from "node:fs";
import path from "node:path";
import type { ModuleIR } from "../types.js";
import { emitTypes } from "./emitters/types.js";
import { emitWorker, type WorkerEmitterOptions } from "./emitters/worker.js";
import { emitHooks } from "./emitters/hooks.js";

export interface CheckResult {
  /** Whether all files are up-to-date */
  upToDate: boolean;
  /** Files that differ from expected */
  outdatedFiles: string[];
}

/**
 * Check if generated files match what would be generated from the current IR.
 */
export function checkGenerated(
  ir: ModuleIR,
  outdir: string,
  workerOptions: WorkerEmitterOptions,
  generateReact: boolean,
): CheckResult {
  const outdatedFiles: string[] = [];

  // Check .types.ts
  const typesPath = path.join(outdir, `${ir.moduleName}.types.ts`);
  const expectedTypes = emitTypes(ir);
  if (!fileMatchesContent(typesPath, expectedTypes)) {
    outdatedFiles.push(typesPath);
  }

  // Check .worker.ts
  const workerPath = path.join(outdir, `${ir.moduleName}.worker.ts`);
  const expectedWorker = emitWorker(ir, workerOptions);
  if (!fileMatchesContent(workerPath, expectedWorker)) {
    outdatedFiles.push(workerPath);
  }

  // Check .hooks.ts (if React is enabled)
  if (generateReact) {
    const hooksPath = path.join(outdir, `${ir.moduleName}.hooks.ts`);
    const expectedHooks = emitHooks(ir);
    if (!fileMatchesContent(hooksPath, expectedHooks)) {
      outdatedFiles.push(hooksPath);
    }
  }

  return {
    upToDate: outdatedFiles.length === 0,
    outdatedFiles,
  };
}

function fileMatchesContent(filePath: string, expectedContent: string): boolean {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const actual = fs.readFileSync(filePath, "utf-8");
  return actual === expectedContent;
}
