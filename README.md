<p align="center">
  <img src="media/icon.png" width="120" alt="Dev Tools icon" />
</p>

<h1 align="center">🧰 Dev Tools Toolbox for VS Code</h1>

<p align="center">
  <strong>A developer toolbox in one place — 65 tools inside a single panel.</strong><br />
  English · <a href="README.ru.md">Русский</a>
</p>

<p align="center">
  <img alt="Version 1.1.0" src="https://img.shields.io/badge/version-1.1.0-blue?style=flat-square" />
  <img alt="VS Code 1.105+" src="https://img.shields.io/badge/VS%20Code-1.105%2B-007ACC?style=flat-square" />
  <img alt="TypeScript 7" src="https://img.shields.io/badge/TypeScript-7-3178C6?style=flat-square" />
  <img alt="65 tools" src="https://img.shields.io/badge/tools-65-f97316?style=flat-square" />
  <img alt="MIT license" src="https://img.shields.io/badge/license-MIT-22c55e?style=flat-square" />
  <img alt="English and Russian" src="https://img.shields.io/badge/languages-EN%20%7C%20RU-8b5cf6?style=flat-square" />
</p>

Dev Tools bundles the utilities developers reach for every day — JSON/YAML conversion, regex testing, JWT decoding, hash calculation, UUID/ULID generation, color helpers, formatting and many more — into one fast panel that lives inside VS Code. No browser tabs, no uploads, no telemetry.

## ✨ Highlights

- **65 tools** organised into eleven groups with instant search (`Ctrl+K`).
- **Start page:** opening the panel shows every tool grouped on a full-width home grid; the house button in the header brings you back.
- **Shell controls:** hide/show the tool sidebar (hidden by default on the home page), switch between light and dark themes, change the language and open the third-party license window right from the header — the sidebar and theme choices are remembered between sessions.
- **Collapsible sections** — every panel block folds with the chevron in its header.
- **Open files in a specific editor** from the Explorer context menu: right-click a media, SVG or 3D file and choose **Open in Dev Tools…**.
- **Three ways in:** Command Palette / shortcut, an Activity Bar launcher with a native tool tree, and a status bar button that opens the panel directly.
- **Bilingual UI** (English / Russian) that follows your VS Code display language and can be switched on the fly.
- **Local by default** — every calculation happens on your machine. Hashing, GZIP, RSA key generation and X.509 parsing run in the extension host, and so do the cipher modes that only OpenSSL provides (CCM, OCB, SIV, XTS, OFB, Camellia, ARIA, SM4); everything else runs in the webview.
- **FFmpeg-powered media** — conversion, stream probing, frame snapshots and ffplay sessions use your installed `ffmpeg`, `ffprobe` and `ffplay`; the paths are configurable in settings.
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
| **PDF Toolkit** | Merge PDFs, delete, rotate, reorder and extract pages, split into chunks and save the result. |
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
| **Base64 File** | Any file ⇄ Base64 data URL with image preview or a file card (name, MIME, size) and download. |
| **Certificate Decoder** | X.509 subject, issuer, validity, SAN, key usage and SHA-1/SHA-256 fingerprints. |
| **GZIP** | Compress and decompress GZIP streams transported as Base64. |
| **HTML Entities** | Encode and decode HTML entities with a reference table. |
| **JWT Decoder** | Decode header, payload and claims, check expiry, verify and create HS256/384/512 signatures. |
| **QR Code** | Generate QR codes with L/M/Q/H error correction and export to PNG or SVG. |
| **URL Encode / Decode** | Component and full-URL encoding plus a parsed query parameter table. |

### 🔑 Cryptography

| Tool | What it does |
| --- | --- |
| **Symmetric Encryption** | AES-128/192/256 in ECB, CBC, CTR, CFB, OFB, GCM, CCM, OCB, SIV, GCM-SIV, KW/KWP and XTS; ChaCha20, ChaCha20-Poly1305, XChaCha20(-Poly1305); Camellia, ARIA and SM4. Key/IV/AAD fields, PKCS#7 padding, auth tags, text/hex/base64/file input and `.bin` download. |
| **GOST Encryption** | Kuznyechik and Magma (GOST R 34.12-2015) plus GOST 28147-89 with S-box choice, in ECB, CBC, CFB, CTR, CTR-ACPKM, OFB, MAC, OMAC-ACPKM, MGM (AEAD) and KExp15/KWP key wrap. |
| **GOST Hashes & Signatures** | Streebog-256/512, GOST R 34.11-94, HMAC, PBKDF2, KDF_GOSTR3411_2012_256, CPKDF, GOST R 34.10-2012 signatures on the 256/512-bit curves and VKO key agreement. |
| **Asymmetric Encryption** | RSA with OAEP (SHA-1/256/384/512) or PKCS#1 v1.5, PEM key generation, ECIES (ECDH P-256 + HKDF + AES-256-GCM) and SM2 (C1C3C2). |
| **Signatures & Key Exchange** | ECDSA P-256/384/521, Ed25519, secp256k1, RSA-PSS and PKCS#1 sign/verify, X25519 and ECDH P-256 secrets, PEM ⇄ JWK conversion and SHA-256 key fingerprints. |
| **Key Derivation (KDF)** | PBKDF2, HKDF, scrypt, Argon2id and bcrypt with salt generation, adjustable cost parameters and hex/base64 output. |
| **Classic Ciphers** | Caesar, ROT13/ROT47, Atbash, Vigenère, rail fence, Playfair, XOR and one-time pad for puzzles and CTFs. |

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
| **Password Generator** | Cryptographically strong passwords with entropy and strength feedback. |
| **UUID Generator** | RFC 4122 v4, time-ordered v7 and nil UUIDs in bulk. |
| **ULID Generator** | Sortable ULIDs with a decoded timestamp. |
| **RSA Key Generator** | 2048/3072/4096-bit key pairs in PKCS#8 and SPKI PEM. |
| **Semver Calculator** | Version comparison, range checks and the next patch/minor/major releases. |
| **Fake Data Generator** | Names, phones, addresses, emails, companies and dates in RU/EN with seeds, custom templates and CSV/JSON export. |

### 🎨 Graphic & Color

| Tool | What it does |
| --- | --- |
| **Color Tools** | HEX/RGB/HSL/CMYK conversions, WCAG contrast checks, tints, shades and a click-to-copy palette. |
| **Color Blind Simulator** | Previews images or colors through seven color-vision deficiencies. |
| **Image Converter** | PNG, JPEG and WebP conversion with resizing and quality control. |
| **Image Adjustments** | Lightroom-style exposure, contrast, highlights/shadows, saturation, vibrance, temperature, tint, vignette, grain, sharpening, presets and histogram. |
| **Image Editor** | Layered canvas editor with brush and eraser, shape and line drawing, lasso selection, styled text objects, image overlays, crop, cut-out, custom document sizes and PNG/JPEG/WebP export. |
| **Vector Editor** | Rectangles, ellipses, lines, arrows and freehand polylines with selection, resizing and styling; edit SVG markup, import SVG files and export SVG or PNG. |

### 🎬 3D, Video & Audio

| Tool | What it does |
| --- | --- |
| **Audio Editor** | Multi-track waveforms in the classic light-grey/blue style (peak envelope with a lighter RMS core and centre line), mute/solo/volume per track, shared selection and trimming, zoomable timeline (Ctrl+wheel or ±, sample-accurate when zoomed in), 10-band equalizer, low/high-pass filter, gain, fades, normalization and WAV/MP3 mixdown. |
| **Video Editor** | Multi-track V/A timeline with zoom, draggable and trimmable clips, text/image/GIF overlays on separate video tracks, several audio tracks with per-track volume, preview and WebM export (VP9/VP8 + Opus). |
| **3D Scene** | Scene editor with boxes, spheres, cylinders, cones, toruses and slabs (icon toolbars for shapes and Select/Move/Rotate/Scale), materials, lights, an orbiting camera with a clickable view cube (front/back/left/right/top/bottom + isometric), resizable viewport, world/object axes for the gizmo, a Move/Rotate/Scale axis gizmo with live coordinates, an expandable object tree with per-node visibility, OBJ/STL/GLB/GLTF import and PNG rendering up to 4K. |
| **CAD Editor** | SketchUp-style modelling: snapped footprints, face Push/Pull (sides included) with hover highlight, vertex/face/grid snapping for measuring and line drawing, precise metre dimensions, tape measure, layers, components and instances, a Move/Rotate/Scale gizmo for selected solids, camera presets above the always-visible viewport, saved camera scenes, solid/wireframe/blueprint styles, textures, OBJ/STL/GLB/FBX/DAE/3DS import and OBJ/STL/GLB/PNG export. |
| **Animation Studio** | 2D and 3D keyframe animation with a full-width timeline that labels every object on the left, shows keys as diamonds and zooms with Ctrl+wheel or ±, a resizable stage (80% by default, 30% minimum, hover-only splitter), resolution presets from Full HD to 9:16 Story plus custom sizes, icon toolbars for shapes (rect, ellipse, text, line, box, sphere, torus, pyramid, triangle, cylinder, rod) and gizmo modes, object renaming and grouping, side panels in tabs, on-canvas 2D arrows/rotation/scale handles, a 3D Move/Rotate/Scale gizmo with live values, SVG and OBJ/STL/GLB/GLTF import, project save/load, Lottie JSON, animated GIF, PNG and WebM export (exported frames never include the transform gizmo). |
| **Media Metadata** | Edit title, author, creation date and geo location; embeds XMP into JPEG/PNG, ID3 into MP3, or exports a JSON sidecar. Opens Google or Yandex Maps at the chosen coordinates. |
| **FFmpeg Converter** | Transcode, remux, trim, resize and extract audio with the local `ffmpeg`: MP4 (H.264/H.265), WebM (VP9/Opus), MKV remux, animated GIF, MP3/WAV/FLAC, CRF and encoder presets, NVENC/QSV/VA-API/VideoToolbox hardware encoding, a copyable command preview, live progress, cancellation and output reveal. |
| **Stream Viewer** | Probe and play RTSP, RTMP(S), HLS (`.m3u8`), DASH (`.mpd`), SRT, RTP, MPEG-TS over UDP/TCP, HTTP(S), FTP/SFTP, local files and capture devices with `ffprobe`/`ffplay`. TCP/UDP/HTTP RTSP transport, optional low-latency flags (off by default), custom headers, User-Agent and Referer, collapsible advanced settings, stream tables, PNG frame snapshots without opening a window, ffplay logs and a ready-to-copy command. |
| **Shader Playground** | Write GLSL ES 1.00 or ES 3.00 (`#version 300 es`) and HLSL fragment shaders and see them rendered live in WebGL2 with `uv`, `u_time`, `u_resolution`, `u_mouse` (vec2/vec4) and Shadertoy aliases, predefined `PI`/`TAU`/`E`, `#include` from http(s) URLs (inlined, nested, `<lygia/…>` via unpkg), presets, a basic HLSL→GLSL transpiler, resolution presets and PNG export. |

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

Dev Tools works entirely offline. It does not collect telemetry, does not send data anywhere, and does not read your workspace files unless you explicitly drop a file into a tool. All cryptographic operations are computed locally: in the webview with audited pure-JavaScript libraries ([@noble](https://github.com/paulmillr/noble-hashes), [sm-crypto](https://github.com/JuneAndGreen/sm-crypto), [bcryptjs](https://github.com/dcodeIO/bcrypt.js)) and [@li0ard/gost](https://github.com/li0ard/gost) for GOST, or in the extension host through Node's OpenSSL build.

## 🛠️ Development

The whole project is written in TypeScript 7 and runs directly on Node's type stripping.

```bash
npm install
npm run compile     # development build with source maps
npm run watch       # incremental build
npm run catalog     # regenerate src/catalog.ts from the tool registry
npm run licenses    # regenerate THIRD_PARTY_NOTICES.md and licenses/* from installed packages
npm run typecheck   # tsc --noEmit
npm run package     # production build + dev-tools-vscode-1.1.0.vsix (alias: npm run vsix)
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

Bundled open-source components are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) with their
full license texts in [`licenses/`](licenses/). Inside the panel, the **info button next to the language
switch** (and the “Third-party licenses” button at the bottom of the home page) opens a licenses window
with every library, its version, license, purpose, a link to its repository, the full license text and a
thank-you note to the maintainers.
