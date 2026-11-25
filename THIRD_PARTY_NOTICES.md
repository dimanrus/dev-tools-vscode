# Third-party notices

This extension bundles the following open-source packages. The bundle is minified with comments
removed, so the complete license text of every package is shipped in the [`licenses/`](licenses/)
directory next to this file (and inside the published VSIX). Nothing here restricts you from
inspecting, replacing or rebuilding these components.

| Package | Version | License | Used for | License text |
| --- | --- | --- | --- | --- |
| [@breezystack/lamejs](https://github.com/shijinyu/lamejs) | 1.2.7 | LGPL-3.0 | MP3 encoding in the audio editor (separate vendor script) | [text](licenses/breezystack-lamejs-1.2.7.txt) |
| [@jsep-plugin/assignment](https://github.com/EricSmekens/jsep) | 1.4.0 | MIT | transitive dependency | [text](licenses/jsep-plugin-assignment-1.4.0.txt) |
| [@jsep-plugin/regex](https://github.com/EricSmekens/jsep) | 1.1.0 | MIT | transitive dependency | [text](licenses/jsep-plugin-regex-1.1.0.txt) |
| [@li0ard/gost](https://github.com/li0ard/gost) | 0.3.3 | MIT | GOST R 34.12-2015, 34.11-2012 and 34.10-2012 algorithms | [text](licenses/li0ard-gost-0.3.3.txt) |
| [@noble/ciphers](https://github.com/paulmillr/noble-ciphers) | 2.4.0 | MIT | AES and ChaCha ciphers | [text](licenses/noble-ciphers-2.4.0.txt) |
| [@noble/curves](https://github.com/paulmillr/noble-curves) | 2.4.0 | MIT | secp256k1, X25519 and P-256 curves | [text](licenses/noble-curves-2.4.0.txt) |
| [@noble/hashes](https://github.com/paulmillr/noble-hashes) | 2.4.0 | MIT | scrypt, Argon2id and hash helpers | [text](licenses/noble-hashes-2.4.0.txt) |
| [@pdf-lib/standard-fonts](https://github.com/Hopding/standard-fonts) | 1.0.0 | MIT | transitive dependency | [text](licenses/pdf-lib-standard-fonts-1.0.0.txt) |
| [@pdf-lib/upng](https://github.com/Hopding/upng) | 1.0.1 | MIT | transitive dependency | [text](licenses/pdf-lib-upng-1.0.1.txt) |
| [argparse](https://github.com/nodeca/argparse) | 3.0.4 | PSF-2.0 | transitive dependency | [text](licenses/argparse-3.0.4.txt) |
| [bcryptjs](https://github.com/dcodeIO/bcrypt.js) | 3.0.3 | BSD-3-Clause | bcrypt password hashing | [text](licenses/bcryptjs-3.0.3.txt) |
| [diff](https://github.com/kpdecker/jsdiff) | 9.0.0 | BSD-3-Clause | Text and list comparison | [text](licenses/diff-9.0.0.txt) |
| [js-yaml](https://github.com/nodeca/js-yaml) | 5.5.0 | MIT | YAML parsing and serialisation | [text](licenses/js-yaml-5.5.0.txt) |
| [jsbn](https://github.com/andyperlitch/jsbn) | 1.1.0 | MIT | transitive dependency | [text](licenses/jsbn-1.1.0.txt) |
| [jsep](https://github.com/EricSmekens/jsep) | 1.6.0 | MIT | transitive dependency | [text](licenses/jsep-1.6.0.txt) |
| [jsonpath-plus](git://github.com/s3u/JSONPath) | 11.3.0 | MIT | JSONPath queries | [text](licenses/jsonpath-plus-11.3.0.txt) |
| [marked](https://github.com/markedjs/marked) | 18.3.0 | MIT | Markdown preview | [text](licenses/marked-18.3.0.txt) |
| [pako](https://github.com/nodeca/pako) | 1.0.11 | (MIT AND Zlib) | transitive dependency | [text](licenses/pako-1.0.11.txt) |
| [pdf-lib](https://github.com/Hopding/pdf-lib) | 1.17.1 | MIT | PDF merge, split and page editing | [text](licenses/pdf-lib-1.17.1.txt) |
| [pdfjs-dist](https://github.com/mozilla/pdf.js) | 6.5.438 | Apache-2.0 | transitive dependency | [text](licenses/pdfjs-dist-6.5.438.txt) |
| [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) | 2.0.4 | MIT | QR code generation | [text](licenses/qrcode-generator-2.0.4.txt) |
| [semver](https://github.com/npm/node-semver) | 7.8.6 | ISC | Semantic version checks | [text](licenses/semver-7.8.6.txt) |
| [sm-crypto](https://github.com/JuneAndGreen/sm-crypto) | 0.5.9 | MIT | SM2, SM3 and SM4 algorithms | [text](licenses/sm-crypto-0.5.9.txt) |
| [three](https://github.com/mrdoob/three.js) | 0.187.0 | MIT | 3D rendering (3D Scene and CAD editors) | [text](licenses/three-0.187.0.txt) |
| [tslib](https://github.com/Microsoft/tslib) | 1.14.1 | 0BSD | transitive dependency | [text](licenses/tslib-1.14.1.txt) |

Development-only tools (esbuild, TypeScript, sharp, `@types/*`, `@vscode/vsce`) are not
distributed inside the extension and are not listed here.

All packages above are free and open-source software. None of them requires a commercial license
or a paid subscription.

## LGPL-3.0 component: LAME / lamejs

The audio editor uses **lamejs** (packaged as `@breezystack/lamejs`), a JavaScript port of the
LAME MP3 encoder, licensed under the GNU Lesser General Public License v3.0.

- Upstream: <https://lame.sourceforge.io/>
- JS port: <https://github.com/shijinyu/lamejs>
- Package notice: [`licenses/breezystack-lamejs-1.2.7.txt`](licenses/breezystack-lamejs-1.2.7.txt)
- Full license text: [`licenses/LGPL-3.0.txt`](licenses/LGPL-3.0.txt)

The library is shipped **unmodified** as a separate, unminified script
(`media/vendor/lamejs.iife.js`) that is loaded before the extension bundle. You may replace that
file with your own build of lamejs without touching the rest of the extension; the complete source
is available at the upstream links above. If you modify lamejs, you must publish your modifications
under the LGPL-3.0.

## This extension

Dev Tools itself is licensed under the MIT License — see [LICENSE](LICENSE).

_Generated by `npm run licenses` from the installed production dependency tree._
