/**
 * Regenerates THIRD_PARTY_NOTICES.md and licenses/<package>-<version>.txt from
 * the installed production dependency tree.
 *
 *   npm run licenses
 *
 * The extension bundle is minified with comments stripped, so every bundled
 * package must have its license text shipped next to the code.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

interface PackageInfo {
  name: string;
  version: string;
  license: string;
  licenseText: string;
  licenseFile: string | null;
  homepage: string;
  direct: boolean;
  synthesized?: boolean;
}

const ROOT = process.cwd();
const LICENSES_DIR = join(ROOT, 'licenses');
const ROOT_DEPENDENCIES = (JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).dependencies ?? {}) as Record<string, string>;

/** Human readable purpose for the packages imported directly by the extension. */
const PURPOSE: Record<string, { en: string; ru: string }> = {
  three: { en: '3D rendering (3D Scene and CAD editors)', ru: '3D-рендеринг (3D-сцена и CAD-редактор)' },
  'pdf-lib': { en: 'PDF merge, split and page editing', ru: 'Объединение, разделение и правка страниц PDF' },
  '@breezystack/lamejs': {
    en: 'MP3 encoding in the audio editor (separate vendor script)',
    ru: 'Кодирование MP3 в аудиоредакторе (отдельный скрипт)',
  },
  diff: { en: 'Text and list comparison', ru: 'Сравнение текста и списков' },
  'js-yaml': { en: 'YAML parsing and serialisation', ru: 'Разбор и сериализация YAML' },
  'jsonpath-plus': { en: 'JSONPath queries', ru: 'Запросы JSONPath' },
  marked: { en: 'Markdown preview', ru: 'Предпросмотр Markdown' },
  'qrcode-generator': { en: 'QR code generation', ru: 'Генерация QR-кодов' },
  semver: { en: 'Semantic version checks', ru: 'Работа с семантическими версиями' },
  '@li0ard/gost': {
    en: 'GOST R 34.12-2015, 34.11-2012 and 34.10-2012 algorithms',
    ru: 'Алгоритмы ГОСТ Р 34.12-2015, 34.11-2012 и 34.10-2012',
  },
  '@noble/ciphers': { en: 'AES and ChaCha ciphers', ru: 'Шифры AES и ChaCha' },
  '@noble/hashes': { en: 'scrypt, Argon2id and hash helpers', ru: 'scrypt, Argon2id и хеш-функции' },
  '@noble/curves': { en: 'secp256k1, X25519 and P-256 curves', ru: 'Кривые secp256k1, X25519 и P-256' },
  'sm-crypto': { en: 'SM2, SM3 and SM4 algorithms', ru: 'Алгоритмы SM2, SM3 и SM4' },
  bcryptjs: { en: 'bcrypt password hashing', ru: 'Хеширование паролей bcrypt' },
};

const TRANSITIVE = { en: 'transitive dependency', ru: 'транзитивная зависимость' };

/**
 * Optional Node-only fallbacks that never reach the webview bundle (pdf.js pulls
 * @napi-rs/canvas for server-side rendering), so they are left out of the notices.
 */
const IGNORED_PACKAGES = [/^@napi-rs\/canvas(-|$)/];

const LICENSE_FILE = /^(licen[cs]e|copying|notice)([._-]|$)/i;
const EXTRA_TEXTS_DIR = join(ROOT, 'scripts', 'license-texts');
/** Canonical license texts appended when a package uses a secondary license. */
const EXTRA_TEXTS: Array<{ match: RegExp; file: string; heading: string }> = [
  { match: /LGPL-3\.0/i, file: 'LGPL-3.0.txt', heading: 'GNU Lesser General Public License v3.0' },
  { match: /Zlib/i, file: 'Zlib.txt', heading: 'zlib License (zlib-derived code inside the package)' },
];

/**
 * Package folders that carry licenses of third-party code compiled into assets we ship.
 * pdf.js bundles its JBIG2/OpenJPEG/QCMS/QuickJS decoders as WASM next to the worker.
 */
const PACKAGE_EXTRA_DIRS: Array<{ package: string; dir: string; pattern: RegExp; heading: string }> = [
  {
    package: 'pdfjs-dist',
    dir: 'wasm',
    pattern: /^LICENSE_/,
    heading: 'Bundled decoders in media/vendor/pdfjs-wasm (PDFium JBIG2, OpenJPEG, QCMS, QuickJS)',
  },
];

const MIT_TEXT = `MIT License

Copyright (c) {holder}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

const readJson = (path: string): Record<string, unknown> => JSON.parse(readFileSync(path, 'utf8'));

const packageDirs = execFileSync('npm', ['ls', '--omit=dev', '--all', '--parseable'], {
  cwd: ROOT,
  encoding: 'utf8',
})
  .trim()
  .split('\n')
  .filter(Boolean)
  .filter((dir) => dir !== ROOT);

const seen = new Set<string>();
const packages: PackageInfo[] = [];

for (const dir of packageDirs) {
  let manifest: Record<string, unknown>;
  try {
    manifest = readJson(join(dir, 'package.json'));
  } catch {
    continue;
  }
  const name = String(manifest.name);
  const version = String(manifest.version);
  if (IGNORED_PACKAGES.some((pattern) => pattern.test(name))) continue;
  const key = `${name}@${version}`;
  if (seen.has(key)) continue;
  seen.add(key);

  const files = readdirSync(dir).filter((file) => LICENSE_FILE.test(file));
  const licenseField = manifest.license;
  const license = typeof licenseField === 'string'
    ? licenseField
    : Array.isArray(licenseField)
      ? licenseField.map((item) => (item as { type?: string }).type ?? '?').join(' OR ')
      : 'UNKNOWN';

  let licenseFile: string | null = files[0] ?? null;
  let licenseText = licenseFile ? readFileSync(join(dir, licenseFile), 'utf8').trim() : '';
  let synthesized = false;
  if (!licenseText && license.startsWith('MIT')) {
    const author = manifest.author;
    const holder = typeof author === 'string'
      ? author.replace(/\s*<[^>]*>/, '').replace(/\s*\([^)]*\)/, '').trim()
      : typeof author === 'object' && author && 'name' in author
        ? String((author as { name?: string }).name ?? name)
        : name;
    licenseText = MIT_TEXT.replace('{holder}', `${holder}`);
    synthesized = true;
    licenseFile = null;
  }

  const repository = manifest.repository as { url?: string } | string | undefined;
  const repositoryUrl = typeof repository === 'string' ? repository : repository?.url;
  const rawHomepage = String(
    repositoryUrl
    ?? manifest.homepage
    ?? `https://www.npmjs.com/package/${name}`,
  )
    .replace(/^git\+/, '')
    .replace(/\.git$/, '')
    .replace(/#.*$/, '');
  const homepage = /^[\w.-]+\/[\w.-]+$/.test(rawHomepage) ? `https://github.com/${rawHomepage}` : rawHomepage;

  for (const extra of EXTRA_TEXTS) {
    if (!extra.match.test(license)) continue;
    const extraText = readFileSync(join(EXTRA_TEXTS_DIR, extra.file), 'utf8').trim();
    licenseText += `\n\n----------------------------------------------------------------------\n${extra.heading}\n----------------------------------------------------------------------\n\n${extraText}`;
  }

  for (const extra of PACKAGE_EXTRA_DIRS) {
    if (extra.package !== name) continue;
    const extraDir = join(dir, extra.dir);
    if (!existsSync(extraDir)) continue;
    const parts = readdirSync(extraDir)
      .filter((file) => extra.pattern.test(file))
      .sort()
      .map((file) => readFileSync(join(extraDir, file), 'utf8').trim());
    if (!parts.length) continue;
    licenseText += `\n\n----------------------------------------------------------------------\n${extra.heading}\n----------------------------------------------------------------------\n\n${parts.join('\n\n')}`;
  }

  packages.push({
    name,
    version,
    license,
    licenseText,
    licenseFile,
    homepage,
    direct: Boolean(ROOT_DEPENDENCIES[name]),
    synthesized,
  });
}

packages.sort((left, right) => left.name.localeCompare(right.name) || left.version.localeCompare(right.version));

mkdirSync(LICENSES_DIR, { recursive: true });

const rows: string[] = [];
const written = new Set<string>();
const entries: Array<{ name: string; version: string; license: string; repo: string; purpose: { en: string; ru: string }; text: string }> = [];
for (const item of packages) {
  if (!item.licenseText) {
    console.warn(`[licenses] no license text for ${item.name}@${item.version} (${item.license})`);
    continue;
  }
  const file = `${item.name.replace(/^@/, '').replace(/[\\/]/g, '-')}-${item.version}.txt`;
  writeFileSync(join(LICENSES_DIR, file), `${item.licenseText}\n`, 'utf8');
  written.add(file);
  const purpose = PURPOSE[item.name] ?? TRANSITIVE;
  rows.push(
    `| [${item.name}](${item.homepage}) | ${item.version} | ${item.license} | ${purpose.en} | [text](licenses/${file}) |`,
  );
  entries.push({
    name: item.name,
    version: item.version,
    license: item.license,
    repo: item.homepage,
    purpose,
    text: item.licenseText,
  });
}

const lgplPackages = packages.filter((item) => /LGPL-3\.0/i.test(item.license));
if (lgplPackages.length) {
  writeFileSync(join(LICENSES_DIR, 'LGPL-3.0.txt'), `${readFileSync(join(EXTRA_TEXTS_DIR, 'LGPL-3.0.txt'), 'utf8').trim()}\n`, 'utf8');
  written.add('LGPL-3.0.txt');
}

for (const existing of readdirSync(LICENSES_DIR)) {
  if (existing.endsWith('.txt') && !written.has(existing)) {
    unlinkSync(join(LICENSES_DIR, existing));
    console.log(`[licenses] removed stale ${existing}`);
  }
}
const lamejs = packages.find((item) => item.name === '@breezystack/lamejs');
const lamejsFile = lamejs ? `licenses/${lamejs.name.replace(/^@/, '').replace(/[\\/]/g, '-')}-${lamejs.version}.txt` : 'licenses/';
const lamejsRepo = lamejs?.homepage ?? 'https://github.com/breezystack/lamejs';

const notices = `# Third-party notices

This extension bundles the following open-source packages. The bundle is minified with comments
removed, so the complete license text of every package is shipped in the [\`licenses/\`](licenses/)
directory next to this file (and inside the published VSIX). Nothing here restricts you from
inspecting, replacing or rebuilding these components.

| Package | Version | License | Used for | License text |
| --- | --- | --- | --- | --- |
${rows.join('\n')}

Development-only tools (esbuild, TypeScript, sharp, \`@types/*\`, \`@vscode/vsce\`) are not
distributed inside the extension and are not listed here.

All packages above are free and open-source software. None of them requires a commercial license
or a paid subscription.

## LGPL-3.0 component: LAME / lamejs

The audio editor uses **lamejs** (packaged as \`@breezystack/lamejs\`), a JavaScript port of the
LAME MP3 encoder, licensed under the GNU Lesser General Public License v3.0.

- Upstream: <https://lame.sourceforge.io/>
- JS port: <${lamejsRepo.replace(/#readme$/, '')}>
- Package notice: [\`${lamejsFile}\`](${lamejsFile})
- Full license text: [\`licenses/LGPL-3.0.txt\`](licenses/LGPL-3.0.txt)

The library is shipped **unmodified** as a separate, unminified script
(\`media/vendor/lamejs.iife.js\`) that is loaded before the extension bundle. You may replace that
file with your own build of lamejs without touching the rest of the extension; the complete source
is available at the upstream links above. If you modify lamejs, you must publish your modifications
under the LGPL-3.0.

## This extension

Dev Tools itself is licensed under the MIT License — see [LICENSE](LICENSE).

_Generated by \`npm run licenses\` from the installed production dependency tree._
`;

writeFileSync(join(ROOT, 'THIRD_PARTY_NOTICES.md'), notices, 'utf8');

const dataFile = `// AUTO-GENERATED FILE — do not edit by hand.
// Source: npm run licenses (scripts/generate-licenses.mts)

export interface LicenseEntry {
  name: string;
  version: string;
  license: string;
  repo: string;
  purpose: { en: string; ru: string };
  text: string;
}

export const LICENSE_ENTRIES: LicenseEntry[] = ${JSON.stringify(entries, null, 2)};
`;
writeFileSync(join(ROOT, 'src', 'webview', 'licenses-data.ts'), dataFile, 'utf8');

const missing = packages.filter((item) => !item.licenseText);
console.log(`[licenses] wrote ${rows.length} license files to ${basename(LICENSES_DIR)}/ and THIRD_PARTY_NOTICES.md`);
if (missing.length) console.warn(`[licenses] missing texts: ${missing.map((item) => item.name).join(', ')}`);
if (packages.some((item) => item.synthesized)) {
  console.log(`[licenses] synthesized MIT text for: ${packages.filter((item) => item.synthesized).map((item) => item.name).join(', ')}`);
}
