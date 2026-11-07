/**
 * Dev Tools — build script.
 *
 * Written in TypeScript and executed directly by Node (type stripping),
 * so the whole repository stays TypeScript-only.
 *
 *   node build.mts               development build (source maps)
 *   node build.mts --production  minified production build
 *   node build.mts --watch       incremental watch build
 */
import { context, build, type BuildOptions } from 'esbuild';
import { mkdir } from 'node:fs/promises';

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const shared: BuildOptions = {
  bundle: true,
  legalComments: 'none',
  logLevel: 'info',
  minify: production,
  sourcemap: production ? false : 'inline',
};

const hostOptions: BuildOptions = {
  ...shared,
  entryPoints: ['src/extension.ts'],
  outfile: 'dist/extension.js',
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['vscode'],
};

const webviewOptions: BuildOptions = {
  ...shared,
  entryPoints: ['src/webview/main.ts'],
  outfile: 'dist/webview.js',
  platform: 'browser',
  format: 'iife',
  target: 'es2022',
  define: { 'process.env.NODE_ENV': production ? '"production"' : '"development"' },
};

await import('./scripts/generate-catalog.mts');
await mkdir('dist', { recursive: true });

if (watch) {
  const host = await context(hostOptions);
  const webview = await context(webviewOptions);
  await Promise.all([host.watch(), webview.watch()]);
  console.log('[dev-tools] watching for changes...');
} else {
  await Promise.all([build(hostOptions), build(webviewOptions)]);
  console.log(`[dev-tools] build finished${production ? ' (production)' : ''}`);
}
