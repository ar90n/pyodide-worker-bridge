/**
 * pyodide-bridge/runtime
 *
 * Framework-agnostic runtime utilities for Pyodide Web Worker bridges.
 */
export { deepConvertMaps } from "./deep-convert.js";
export { BridgeError, detectBridgeError } from "./error.js";
export { wrapProxy, unwrapProxy } from "./comlink-helpers.js";
export type { WrappedProxy } from "./comlink-helpers.js";
export { bootstrapPyodide } from "./worker-bootstrap.js";
export type { BootstrapOptions, PyodideInterface } from "./worker-bootstrap.js";
