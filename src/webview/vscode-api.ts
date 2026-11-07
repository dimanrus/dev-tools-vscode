/** Access to the VS Code webview API with a graceful browser-only fallback. */

export interface WebviewApi {
  postMessage(message: unknown): void;
  getState<T = unknown>(): T | undefined;
  setState<T>(state: T): void;
}

declare const acquireVsCodeApi: (() => WebviewApi) | undefined;

const STORAGE_KEY = 'dev-tools-state';

const browserFallback: WebviewApi = {
  postMessage(message: unknown) {
    console.debug('[dev-tools] postMessage (browser fallback)', message);
  },
  getState<T>() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as T | undefined;
    } catch {
      return undefined;
    }
  },
  setState<T>(state: T) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore quota errors */
    }
  },
};

export const vscode: WebviewApi =
  typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : browserFallback;

export const isInVsCode = typeof acquireVsCodeApi === 'function';
