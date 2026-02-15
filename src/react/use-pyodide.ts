/**
 * usePyodide Hook: manages Worker lifecycle (creation, initialization, cleanup, retry).
 *
 * State transitions:
 *   idle → loading → ready
 *                  ↘ error → (retry) → loading
 */
import { useState, useEffect, useCallback, useRef } from "react";
import * as Comlink from "comlink";
import { wrapProxy, unwrapProxy, type WrappedProxy } from "../runtime/comlink-helpers.js";

/** Worker status during the Pyodide lifecycle */
export type PyodideStatus = "loading" | "ready" | "error";

export interface UsePyodideOptions {
  /**
   * URL or factory function for the Worker.
   * - string: URL passed to `new Worker(url, { type: "module" })`
   * - () => Worker: factory function that returns an already-constructed Worker
   */
  worker: string | (() => Worker);
}

export interface UsePyodideReturn<TApi> {
  /** Current Worker status */
  status: PyodideStatus;
  /** Error object if status is 'error' */
  error: Error | null;
  /** Comlink API proxy (null until ready) */
  api: Comlink.Remote<TApi> | null;
  /** Destroy the current Worker and re-initialize */
  retry: () => void;
}

/**
 * React Hook that manages a Pyodide Web Worker lifecycle.
 *
 * 1. Creates a new Worker on mount
 * 2. Wraps it with Comlink.wrap() to get a typed API proxy
 * 3. Waits for the Worker to initialize Pyodide and expose the API
 * 4. Provides retry() to destroy and re-create the Worker
 *
 * @param options - Worker URL or factory
 * @returns Status, error, API proxy, and retry function
 */
export function usePyodide<TApi>(options: UsePyodideOptions): UsePyodideReturn<TApi> {
  const [status, setStatus] = useState<PyodideStatus>("loading");
  const [error, setError] = useState<Error | null>(null);
  const [wrappedApi, setWrappedApi] = useState<WrappedProxy<Comlink.Remote<TApi>> | null>(null);

  // Track retry count to trigger re-initialization
  const [retryCount, setRetryCount] = useState(0);
  const workerRef = useRef<Worker | null>(null);

  const retry = useCallback(() => {
    setRetryCount((c) => c + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Reset state
    setStatus("loading");
    setError(null);
    setWrappedApi(null);

    // Create worker
    let worker: Worker;
    try {
      if (typeof options.worker === "function") {
        worker = options.worker();
      } else {
        worker = new Worker(options.worker, { type: "module" });
      }
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err : new Error(String(err)));
      return;
    }

    workerRef.current = worker;

    // Wrap with Comlink
    const proxy = Comlink.wrap<TApi>(worker);

    // Listen for Worker errors (Pyodide load failure, etc.)
    const handleError = (event: ErrorEvent): void => {
      if (cancelled) return;
      setStatus("error");
      setError(new Error(event.message || "Worker error"));
    };

    worker.addEventListener("error", handleError);

    // Mark as ready immediately after proxy creation.
    // Comlink queues calls made before the Worker's Comlink.expose(),
    // so the proxy is usable right away. Individual function hooks
    // manage their own loading state per call.
    Promise.resolve().then(() => {
      if (!cancelled) {
        setStatus("ready");
        setWrappedApi(wrapProxy(proxy));
      }
    });

    // Cleanup
    return () => {
      cancelled = true;
      worker.removeEventListener("error", handleError);
      proxy[Comlink.releaseProxy]();
      worker.terminate();
      workerRef.current = null;
    };
  }, [options.worker, retryCount]);

  return {
    status,
    error,
    api: wrappedApi ? unwrapProxy(wrappedApi) : null,
    retry,
  };
}
