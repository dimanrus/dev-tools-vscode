/** Request/response bridge to the extension host (Node.js side). */
import { getLang } from './i18n.ts';
import { isInVsCode, vscode } from './vscode-api.ts';

interface Pending {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
}

/** Events pushed by long-running host operations (media jobs, players). */
export type HostEventListener = (event: string, payload: Record<string, unknown>) => void;

let sequence = 0;
const pending = new Map<number, Pending>();
const hostEventListeners = new Set<HostEventListener>();

/** Version mismatches (new webview + extension host started before the last build) get a clear hint. */
function describeHostError(message: string): Error {
  if (/Unknown RPC method:\s*media/i.test(message)) {
    return new Error(
      getLang() === 'ru'
        ? 'Процесс расширения запущен со старой сборкой Dev Tools. Перезагрузите окно VS Code (Developer: Reload Window) или перезапустите Extension Development Host.'
        : 'The extension host is running an older Dev Tools build. Reload the VS Code window (Developer: Reload Window) or restart the Extension Development Host.',
    );
  }
  return new Error(message);
}

// The catalog generator imports the tool registry in Node, where `window` does not exist.
if (typeof window !== 'undefined') {
  window.addEventListener('message', (event: MessageEvent) => {
    const message = event.data as {
      type?: string;
      id?: number;
      result?: unknown;
      error?: string;
      event?: string;
      payload?: unknown;
    };
    if (!message) return;
    if (message.type === 'host-event' && typeof message.event === 'string') {
      const payload = (message.payload ?? {}) as Record<string, unknown>;
      for (const listener of Array.from(hostEventListeners)) listener(message.event, payload);
      return;
    }
    if (message.type !== 'rpc-result' || typeof message.id !== 'number') return;
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    if (message.error) entry.reject(describeHostError(message.error));
    else entry.resolve(message.result);
  });
}

/** Subscribes to host-pushed events; returns an unsubscribe function. */
export function onHostEvent(listener: HostEventListener): () => void {
  hostEventListeners.add(listener);
  return () => hostEventListeners.delete(listener);
}

export function rpc<T = unknown>(method: string, params?: unknown): Promise<T> {
  if (!isInVsCode) {
    return Promise.reject(
      new Error(
        'This part runs in the VS Code extension host (Node.js). It is unavailable in the standalone browser preview (dev/preview.html) — open the panel inside VS Code.',
      ),
    );
  }
  const id = ++sequence;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
    vscode.postMessage({ type: 'rpc', id, method, params });
    window.setTimeout(() => {
      if (pending.delete(id)) reject(new Error(`Request "${method}" timed out`));
    }, 120_000);
  });
}
