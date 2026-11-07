<p align="center">
  <img src="media/icon.png" width="120" alt="Dev Tools icon" />
</p>

<h1 align="center">🧰 Dev Tools for VS Code</h1>

<p align="center">
  <strong>A developer toolbox in one place — 45 tools inside a single panel.</strong><br />
  English · <a href="README.ru.md">Русский</a>
</p>

<p align="center">
  <img alt="Version 1.0.0" src="https://img.shields.io/badge/version-1.0.0-blue?style=flat-square" />
  <img alt="VS Code 1.105+" src="https://img.shields.io/badge/VS%20Code-1.105%2B-007ACC?style=flat-square" />
  <img alt="TypeScript 7" src="https://img.shields.io/badge/TypeScript-7-3178C6?style=flat-square" />
  <img alt="45 tools" src="https://img.shields.io/badge/tools-45-f97316?style=flat-square" />
  <img alt="MIT license" src="https://img.shields.io/badge/license-MIT-22c55e?style=flat-square" />
  <img alt="English and Russian" src="https://img.shields.io/badge/languages-EN%20%7C%20RU-8b5cf6?style=flat-square" />
</p>

Dev Tools bundles the utilities developers reach for every day — JSON/YAML conversion, regex testing, JWT decoding, hash calculation, UUID/ULID generation, color helpers, formatting and many more — into one fast panel that lives inside VS Code. No browser tabs, no uploads, no telemetry.

## ✨ Highlights

- **45 tools** organised into nine groups with instant search (`Ctrl+K`).
- **Three ways in:** Command Palette / shortcut, an Activity Bar launcher with a native tool tree, and a status bar button that opens the panel directly.
- **Bilingual UI** (English / Russian) that follows your VS Code display language and can be switched on the fly.
- **Local by default** — every calculation happens on your machine. Only hashing, GZIP, RSA key generation and X.509 parsing run in the extension host; everything else runs in the webview.
- **No configuration required** — open the panel and start typing.
- **Theme-aware interface** built on VS Code theme colors (light, dark and high-contrast).
- **Keyboard driven** — open with `Ctrl+Alt+D` (macOS: `Cmd+Alt+D`), search with `Ctrl+K`.

## 🚀 Getting started

1. Install the extension.
2. Open it in any of these ways:
   - `Ctrl+Alt+D` / `Cmd+Alt+D`;
   - Command Palette → **Dev Tools: Open Dev Tools**;
   - click the **Dev Tools** icon in the Activity Bar and pick a tool from the tree (it opens the wide editor panel on that tool);
   - click **Dev Tools** in the status bar.
3. Pick a tool in the panel sidebar or search for it with `Ctrl+K`.

## 🧩 Tools

### 🔄 Converters

| Tool | What it does |
| --- | --- |
| **Cron Parser** | Explains a 5-field cron expression in plain words and shows the next eight runs. Supports `*`, `,`, `-`, `/` and `@daily`-style macros. |
| **Date & Timestamp** | Converts Unix seconds/milliseconds/microseconds, ISO 8601, UTC, local time, week numbers and relative time. |
| **JSON Array to Table / CSV** | Renders an array of objects as a table and exports CSV with a configurable delimiter. |
| **JSON ↔ YAML** | Two-way conversion with live validation and one-click swap. |
| **Number Base** | Converts integers between base 2, 8, 10, 16, 36 with a grouped binary view (BigInt-safe). |
| **JSON → Code** | C#, F#, TypeScript, JavaScript or PHP models from JSON; choose System.Text.Json or Newtonsoft.Json for .NET. Ships a ready-to-run deserialization snippet. |
| **XML → Code** | Same targets from an XML sample; .NET output uses `System.Xml.Serialization` (`XmlRoot`, `XmlAttribute`, `XmlElement`) and comes with an `XmlSerializer` snippet. |

### ✏️ Text

| Tool | What it does |
| --- | --- |
| **Escape / Unescape** | JSON, HTML, XML, URL, C#, SQL, CSV, shell, regex, Unicode and backslash escaping. |
| **List Comparer** | Shows added, removed and common lines between two lists. |
| **Markdown Preview** | Renders Markdown to sanitized HTML with an exportable HTML view. |
| **Text Analyzer** | Characters, words, sentences, entropy, reading time and the most frequent words. |
| **Text Comparer** | Line, word and character diffs with highlighted additions and removals. |

### 🔐 Encoders / Decoders

| Tool | What it does |
| --- | --- |
| **Base64 Text** | UTF-8 Base64 encoding and decoding, including the URL-safe alphabet. |
| **Base64 Image** | Image ⇄ data URL conversion with live preview and download. |
| **Certificate Decoder** | X.509 subject, issuer, validity, SAN, key usage and SHA-1/SHA-256 fingerprints. |
| **GZIP** | Compress and decompress GZIP streams transported as Base64. |
| **HTML Entities** | Encode and decode HTML entities with a reference table. |
| **JWT Decoder** | Decode header, payload and claims, check expiry, verify and create HS256/384/512 signatures. |
| **QR Code** | Generate QR codes with L/M/Q/H error correction and export to PNG or SVG. |
| **URL Encode / Decode** | Component and full-URL encoding plus a parsed query parameter table. |

### 🧹 Formatters

| Tool | What it does |
| --- | --- |
| **JSON Formatter** | Beautify, minify, sort keys, escape as a string literal and pinpoint syntax errors by line and column. |
| **SQL Formatter** | Clause-aware pretty printing with optional keyword uppercasing. |
| **XML Formatter** | Validation, pretty printing, minification and a structure summary. |

### 🎲 Generators

| Tool | What it does |
| --- | --- |
| **Hash / Checksum** | MD5, SHA-1, SHA-256/384/512 and CRC-32, with optional HMAC and hex/Base64 output. |
| **Lorem Ipsum** | Paragraphs, sentences and words with optional `<p>` wrapping. |
| **Password Generator** | Cryptographically strong passwords with entropy and strength feedback. |
| **UUID Generator** | RFC 4122 v4, time-ordered v7 and nil UUIDs in bulk. |
| **ULID Generator** | Sortable ULIDs with a decoded timestamp. |
| **RSA Key Generator** | 2048/3072/4096-bit key pairs in PKCS#8 and SPKI PEM. |
| **Semver Calculator** | Version comparison, range checks and the next patch/minor/major releases. |

### 🎨 Graphic & Color

| Tool | What it does |
| --- | --- |
| **Color Tools** | HEX/RGB/HSL/CMYK conversions, WCAG contrast checks, tints, shades and a click-to-copy palette. |
| **Color Blind Simulator** | Previews images or colors through seven color-vision deficiencies. |
| **Image Converter** | PNG, JPEG and WebP conversion with resizing and quality control. |

### 🧪 Testers

| Tool | What it does |
| --- | --- |
| **JSONPath Tester** | Runs JSONPath expressions and lists matches with types and values. |
| **Regular Expression Tester** | Live highlighting, groups and named groups, replacement preview and a cheat sheet. |
| **XML / XSD Validator** | Well-formedness checks plus a structural comparison against an XSD schema. |

### ⭐ Icons

| Tool | What it does |
| --- | --- |
| **Icon Browser** | Searchable set of 95 Tabler-style outline icons; click any icon to copy its SVG. |

### 📦 Extras

| Tool | What it does |
| --- | --- |
| **Duplicate Detector** | Finds repeated lines or values with counts and positions. |
| **File Splitter** | Splits any file into equal parts or by size and downloads each chunk. |
| **JSON Schema Generator** | Infers a draft 2020-12 JSON Schema from a sample document. |
| **PNG Compressor** | Reduces PNG size by downscaling and re-encoding. |
| **Randomizer** | Random numbers, dice, coin flips, list shuffling and prize draws. |
| **RESX Translator** | Loads `.resx` files, edits translations in place and exports a new file. |
| **Text Delimiter** | Parses CSV/TSV-style text into columns, transposes it and re-joins with another delimiter. |
| **XSD Generator** | Builds an XSD schema from an XML sample with inferred data types. |

## ⚙️ Settings

| Setting | Default | Description |
| --- | --- | --- |
| `devTools.language` | `auto` | Interface language: `auto`, `en` or `ru`. `auto` follows the VS Code display language. |
| `devTools.startupTool` | empty | Tool identifier opened by default, for example `converters-json-yaml`. Leave empty to restore the last used tool. |
| `devTools.showStatusBar` | `true` | Show the **Dev Tools** button in the status bar. |

## ⌨️ Commands

| Command | Keybinding |
| --- | --- |
| **Dev Tools: Open Dev Tools** (`devTools.open`) | `Ctrl+Alt+D` / `Cmd+Alt+D` |
| **Dev Tools: Open a specific tool** (`devTools.openTool`) | — |

## 🔒 Privacy

Dev Tools works entirely offline. It does not collect telemetry, does not send data anywhere, and does not read your workspace files unless you explicitly drop a file into a tool.

## 🛠️ Development

The whole project is written in TypeScript 7 and runs directly on Node's type stripping.

```bash
npm install
npm run compile     # development build with source maps
npm run watch       # incremental build
npm run catalog     # regenerate src/catalog.ts from the tool registry
npm run typecheck   # tsc --noEmit
npm run package     # production build + dev-tools-vscode-1.0.0.vsix (alias: npm run vsix)
```

Press <kbd>F5</kbd> to launch an Extension Development Host.

To iterate on the UI without restarting VS Code, serve the repository and open the preview harness:

```bash
npm run preview
# http://127.0.0.1:8765/dev/preview.html
```

The preview uses the same bundle and falls back to `localStorage` instead of the VS Code API, so everything except the four host-side tools works there.

```
src/extension.ts      activation, commands, status bar item
src/sidebar.ts        Activity Bar launcher (native tree)
src/catalog.ts        generated tool catalog used by the launcher
src/panel.ts          webview panel lifecycle
src/rpc.ts            Node-side handlers (hash, gzip, certificate, RSA)
src/webview/          webview application (shell, tools, design system)
media/                HTML template, stylesheet, icons
```

## 📄 License

**MIT** — full text in [LICENSE](LICENSE). © 2026 Dmitry Sorokin (dimanrus).
