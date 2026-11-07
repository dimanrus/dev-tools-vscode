/** Request/response bridge to the extension host (Node.js side). */
import { isInVsCode, vscode } from './vscode-api.ts';

interface Pending {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
}

let sequence = 0;
const pending = new Map<number, Pending>();

window.addEventListener('message', (event: MessageEvent) => {
  const message = event.data as { type?: string; id?: number; result?: unknown; error?: string };
  if (!message || message.type !== 'rpc-result' || typeof message.id !== 'number') return;
  const entry = pending.get(message.id);
  if (!entry) return;
  pending.delete(message.id);
  if (message.error) entry.reject(new Error(message.error));
  else entry.resolve(message.result);
});

export function rpc<T = unknown>(method: string, params?: unknown): Promise<T> {
  if (!isInVsCode) {
    return Promise.reject(new Error('This tool requires the VS Code extension host.'));
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
