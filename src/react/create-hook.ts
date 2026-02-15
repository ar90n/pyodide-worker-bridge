/**
 * createBridgeHook: factory that produces typed React hooks for individual bridge functions.
 *
 * Each generated hook manages: execute(), result, error, and isLoading state.
 */
import { useState, useCallback } from "react";
import type * as Comlink from "comlink";
import { BridgeError } from "../runtime/error.js";

export interface BridgeHookReturn<TResult> {
  /** Result from the last successful execution */
  result: TResult | null;
  /** Error from the last failed execution */
  error: BridgeError | null;
  /** Whether the function is currently executing */
  isLoading: boolean;
  /** Call the bridge function with the given parameters */
  execute: (...args: unknown[]) => Promise<void>;
}

/**
 * Creates a typed React Hook for a specific bridge function.
 *
 * Usage in generated code:
 * ```ts
 * export const useRunQuery = createBridgeHook<BridgeAPI, InputParams, Result>("run_query");
 * ```
 *
 * Then in a component:
 * ```ts
 * const { api } = usePyodide({ worker: ... });
 * const { result, error, isLoading, execute } = useRunQuery(api);
 * ```
 *
 * @param methodName - The name of the method on the BridgeAPI
 * @returns A React Hook that takes the Comlink API proxy and returns execution state
 */
export function createBridgeHook<
  TApi,
  TParams = void,
  TResult = unknown,
>(
  methodName: string & keyof TApi,
): (api: Comlink.Remote<TApi> | null) => BridgeHookReturn<TResult> {
  return function useBridgeFunction(
    api: Comlink.Remote<TApi> | null,
  ): BridgeHookReturn<TResult> {
    const [result, setResult] = useState<TResult | null>(null);
    const [error, setError] = useState<BridgeError | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const execute = useCallback(
      async (...args: unknown[]): Promise<void> => {
        if (!api) {
          setError(new BridgeError("NOT_READY", "API is not ready. Wait for usePyodide status to be 'ready'."));
          return;
        }

        setIsLoading(true);
        setError(null);

        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const method = (api as any)[methodName] as (...args: unknown[]) => Promise<TResult>;
          const res = await method(...args);
          setResult(res);
        } catch (err) {
          if (err instanceof BridgeError) {
            setError(err);
          } else {
            setError(
              new BridgeError(
                "BRIDGE_CALL_ERROR",
                err instanceof Error ? err.message : String(err),
              ),
            );
          }
        } finally {
          setIsLoading(false);
        }
      },
      [api],
    );

    return { result, error, isLoading, execute };
  };
}
