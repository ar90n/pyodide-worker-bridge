/**
 * Worker bootstrap: loads Pyodide from CDN, installs packages, and runs Python source.
 *
 * This module is designed to run inside a Web Worker context.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface BootstrapOptions {
  /** Pyodide CDN version (e.g., "0.26.4") */
  pyodideVersion: string;
  /** Python packages to install via micropip */
  packages: string[];
  /** Python source code to execute */
  pythonSource: string;
}

export interface PyodideInterface {
  runPython: (code: string) => any;
  runPythonAsync: (code: string) => Promise<any>;
  loadPackage: (packages: string | string[]) => Promise<void>;
  globals: any;
  toPy: (obj: unknown) => any;
}

/**
 * Bootstrap Pyodide in a Web Worker.
 *
 * 1. Load Pyodide from CDN
 * 2. Install packages via micropip
 * 3. Execute the Python source
 *
 * @returns The initialized Pyodide instance
 */
export async function bootstrapPyodide(options: BootstrapOptions): Promise<PyodideInterface> {
  const { pyodideVersion, packages, pythonSource } = options;

  // Load Pyodide from CDN
  const cdnUrl = `https://cdn.jsdelivr.net/pyodide/v${pyodideVersion}/full/`;

  const globalScope = globalThis as any;

  if (typeof globalScope.loadPyodide !== "function") {
    // ESM Workers (type: "module") don't support importScripts().
    // Use dynamic import() with pyodide.mjs for ESM, falling back to
    // importScripts() for classic Workers.
    try {
      const mod = await import(/* @vite-ignore */ `${cdnUrl}pyodide.mjs`);
      globalScope.loadPyodide = mod.loadPyodide;
    } catch {
      // Fallback for classic (non-module) Workers
      globalScope.importScripts(`${cdnUrl}pyodide.js`);
    }
  }

  const pyodide: PyodideInterface = await globalScope.loadPyodide({
    indexURL: cdnUrl,
  });

  // Install packages via micropip
  if (packages.length > 0) {
    // micropip must be loaded first (it's a Pyodide built-in, not pre-installed)
    await pyodide.loadPackage("micropip");
    await pyodide.runPythonAsync(`
import micropip
await micropip.install(${JSON.stringify(packages)})
`);
  }

  // Execute the user's Python source
  pyodide.runPython(pythonSource);

  return pyodide;
}
