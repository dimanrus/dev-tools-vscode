/** Shared tool contracts. */
import type { Lang } from './i18n.ts';

export type GroupId =
  | 'converters'
  | 'text'
  | 'encoders'
  | 'crypto'
  | 'formatters'
  | 'generators'
  | 'graphic'
  | 'media'
  | 'testers'
  | 'icons'
  | 'thirdparty';

export interface IncomingFile {
  name: string;
  mime: string;
  dataUrl: string;
  /** Absolute path when the file came from the VS Code explorer. */
  path?: string;
}

export interface ToolContext {
  t: (key: string, vars?: Record<string, string | number>) => string;
  pick: (en: string, ru: string) => string;
  rpc: <T = unknown>(method: string, params?: unknown) => Promise<T>;
  lang: () => Lang;
  /** File passed from the VS Code explorer context menu, consumed once. */
  takeIncoming: () => IncomingFile | null;
}

export interface ToolDef {
  id: string;
  group: GroupId;
  /** Inner SVG markup (Tabler outline paths). */
  icon: string;
  name: { en: string; ru: string };
  desc: { en: string; ru: string };
  keywords?: string;
  /** Stretch the content to the panel height: text areas grow, info rows stick to the bottom. `undefined` enables it automatically for simple two-editor tools. */
  fill?: boolean;
  mount: (root: HTMLElement, ctx: ToolContext) => void;
}

export function defineTool(def: ToolDef): ToolDef {
  return def;
}
