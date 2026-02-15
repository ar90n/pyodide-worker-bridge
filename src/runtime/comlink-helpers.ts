/**
 * Comlink Proxy helpers.
 *
 * Problem: Comlink.wrap() returns a Proxy where typeof === 'function'.
 * React's setState treats functions as updater functions, causing issues.
 *
 * Solution: Wrap the proxy in a plain object to avoid the function check.
 */

export interface WrappedProxy<T> {
  ref: T;
}

/**
 * Wraps a Comlink proxy in a plain object so it can be safely stored
 * in React state via setState.
 */
export function wrapProxy<T>(proxy: T): WrappedProxy<T> {
  return { ref: proxy };
}

/**
 * Unwraps a previously wrapped Comlink proxy.
 */
export function unwrapProxy<T>(wrapped: WrappedProxy<T>): T {
  return wrapped.ref;
}
