/**
 * Generates `src/catalog.ts` from the single source of truth — the webview tool registry.
 *
 *   node scripts/generate-catalog.mts
 *
 * It runs automatically from `build.mts` so the sidebar tree can never drift
 * away from the actual list of tools.
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ToolDef } from '../src/webview/tool-types.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { tools } = (await import('../src/webview/tools/index.ts')) as { tools: ToolDef[] };

const entries = tools.map((tool) => ({
  id: tool.id,
  group: tool.group,
  keywords: tool.keywords ?? '',
  name: tool.name,
  desc: tool.desc,
}));

const body = `// AUTO-GENERATED FILE — do not edit by hand.
// Source of truth: src/webview/tools/*.ts
// Refresh with: node scripts/generate-catalog.mts

export type CatalogGroup =
  | 'converters'
  | 'text'
  | 'encoders'
  | 'formatters'
  | 'generators'
  | 'graphic'
  | 'testers'
  | 'icons'
  | 'thirdparty';

export interface CatalogEntry {
  id: string;
  group: CatalogGroup;
  keywords: string;
  name: { en: string; ru: string };
  desc: { en: string; ru: string };
}

export const CATALOG: CatalogEntry[] = ${JSON.stringify(entries, null, 2)};
`;

await writeFile(path.join(root, 'src', 'catalog.ts'), body, 'utf8');
console.log(`[catalog] wrote src/catalog.ts with ${entries.length} tools`);
