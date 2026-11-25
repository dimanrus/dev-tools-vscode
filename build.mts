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
import { copyFile, cp, mkdir } from 'node:fs/promises';

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
await mkdir('media/vendor', { recursive: true });
// LGPL-3.0: lamejs is shipped as a separate, unminified vendor script so it can be replaced.
await copyFile('node_modules/@breezystack/lamejs/dist/lamejs.iife.js', 'media/vendor/lamejs.iife.js');
// pdf.js runs its parser in a dedicated worker module and needs the standard font,
// CMap, ICC and WASM decoder data (JPEG 2000, JBIG2, colour profiles).
await copyFile('node_modules/pdfjs-dist/build/pdf.worker.min.mjs', 'media/vendor/pdf.worker.min.mjs');
await cp('node_modules/pdfjs-dist/standard_fonts', 'media/vendor/standard_fonts', { recursive: true });
await cp('node_modules/pdfjs-dist/wasm', 'media/vendor/pdfjs-wasm', { recursive: true });
await cp('node_modules/pdfjs-dist/iccs', 'media/vendor/pdfjs-iccs', { recursive: true });
await cp('node_modules/pdfjs-dist/cmaps', 'media/vendor/pdfjs-cmaps', { recursive: true });

if (watch) {
  const host = await context(hostOptions);
  const webview = await context(webviewOptions);
  await Promise.all([host.watch(), webview.watch()]);
  console.log('[dev-tools] watching for changes...');
} else {
  await Promise.all([build(hostOptions), build(webviewOptions)]);
  console.log(`[dev-tools] build finished${production ? ' (production)' : ''}`);
}
