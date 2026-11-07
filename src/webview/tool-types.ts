/** Shared tool contracts. */
import type { Lang } from './i18n.ts';

export type GroupId =
  | 'converters'
  | 'text'
  | 'encoders'
  | 'formatters'
  | 'generators'
  | 'graphic'
  | 'testers'
  | 'icons'
  | 'thirdparty';

export interface ToolContext {
  t: (key: string, vars?: Record<string, string | number>) => string;
  pick: (en: string, ru: string) => string;
  rpc: <T = unknown>(method: string, params?: unknown) => Promise<T>;
  lang: () => Lang;
}

export interface ToolDef {
  id: string;
  group: GroupId;
  /** Inner SVG markup (Tabler outline paths). */
  icon: string;
  name: { en: string; ru: string };
  desc: { en: string; ru: string };
  keywords?: string;
  mount: (root: HTMLElement, ctx: ToolContext) => void;
}

export function defineTool(def: ToolDef): ToolDef {
  return def;
}
