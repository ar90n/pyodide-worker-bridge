/**
 * Python parser bridge: spawns python3 to run parser.py
 * and returns the Module IR.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { ModuleIR } from "../types.js";

export class PythonNotFoundError extends Error {
  constructor() {
    super(
      "python3 not found. Please install Python 3.10+ to use pyodide-bridge.\n" +
        "  macOS:  brew install python3\n" +
        "  Ubuntu: sudo apt install python3\n" +
        "  Windows: https://www.python.org/downloads/",
    );
    this.name = "PythonNotFoundError";
  }
}

export class PythonParseError extends Error {
  constructor(
    message: string,
    public readonly file: string,
  ) {
    super(message);
    this.name = "PythonParseError";
  }
}

/**
 * Resolve the path to the vendored parser.py script.
 *
 * In development: src/cli/ -> ../../parser/parser.py
 * In dist (published package): dist/cli/ -> ../parser/parser.py
 */
function getParserScriptPath(): string {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const distPath = path.resolve(currentDir, "../parser/parser.py");
  const devPath = path.resolve(currentDir, "../../parser/parser.py");

  // Prefer dist path (published package) with fallback to dev path
  return fs.existsSync(distPath) ? distPath : devPath;
}

/**
 * Parse a Python source file using the vendored parser.py script.
 *
 * @param inputPath - Absolute or relative path to the Python source file
 * @returns The Module IR parsed from the Python file
 */
export async function parsePythonModule(inputPath: string): Promise<ModuleIR> {
  const parserScript = getParserScriptPath();

  return new Promise<ModuleIR>((resolve, reject) => {
    const proc = spawn("python3", [parserScript, inputPath], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") {
        reject(new PythonNotFoundError());
      } else {
        reject(err);
      }
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new PythonParseError(stderr.trim(), inputPath));
        return;
      }

      try {
        const ir = JSON.parse(stdout) as ModuleIR;
        resolve(ir);
      } catch {
        reject(new PythonParseError(`Failed to parse parser output: ${stdout}`, inputPath));
      }
    });
  });
}
