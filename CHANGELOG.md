# Changelog

**English** · [Русский](CHANGELOG.ru.md)

## 🎉 [1.0.0] — 2026-11-07

### ✨ Added

- Initial public release of **Dev Tools** for VS Code 1.105+.
- Single webview panel with instant search (`Ctrl+K`), grouped navigation and 45 tools.
- Bilingual interface (English / Russian) with automatic detection of the VS Code display language and a manual switcher.
- **🔄 Converters:** Cron Parser, Date & Timestamp, JSON Array to Table / CSV, JSON ↔ YAML, Number Base, JSON → Code and XML → Code (C#, F#, TypeScript, JavaScript, PHP; System.Text.Json or Newtonsoft.Json for JSON, `System.Xml.Serialization` for XML, plus a copy-ready deserialization snippet for every target).
- **✏️ Text:** Escape / Unescape, List Comparer, Markdown Preview, Text Analyzer, Text Comparer.
- **🔐 Encoders / Decoders:** Base64 Text, Base64 Image, Certificate Decoder, GZIP, HTML Entities, JWT Decoder (decode, verify and sign), QR Code, URL Encode / Decode.
- **🧹 Formatters:** JSON, SQL, XML. Invalid JSON is reported with an exact line and column, even when the JavaScript runtime omits the position.
- **🎲 Generators:** Hash / Checksum (MD5, SHA-1/2, CRC-32, HMAC), Lorem Ipsum, Password, UUID (v4/v7/nil), ULID, RSA key pairs, Semver calculator.
- **🎨 Graphic & Color:** Color Tools (conversions, WCAG contrast, tints and shades), Color Blind Simulator, Image Converter.
- **🧪 Testers:** JSONPath, Regular Expression Tester, XML / XSD Validator.
- **⭐ Icons:** searchable built-in set of 95 Tabler-style outline icons with SVG copy.
- **📦 Extras:** Duplicate Detector, File Splitter, JSON Schema Generator, PNG Compressor, Randomizer, RESX Translator, Text Delimiter, XSD Generator.
- **🧭 Activity Bar launcher**: a native tree with all nine groups and 45 tools; picking a tool opens the wide editor panel on it. A view-title button opens the full panel.
- **📌 Status bar button** `$(tools) Dev Tools` that opens the panel directly, without touching the sidebar (toggle with `devTools.showStatusBar`).
- 🗂️ Tool catalog generated from the registry (`npm run catalog`), so the launcher can never drift from the actual tool list.
- ⚙️ Extension settings `devTools.language`, `devTools.startupTool` and `devTools.showStatusBar`.
- ⌨️ Command `Dev Tools: Open Dev Tools` with the `Ctrl+Alt+D` / `Cmd+Alt+D` keybinding.
- 🌗 Theme-aware design that follows VS Code light, dark and high-contrast themes.
- 🔒 Fully local processing: no telemetry, no network requests, no workspace access unless a file is dropped into a tool.

[1.0.0]: https://github.com/dimanrus/dev-tools-vscode/releases/tag/v1.0.0
