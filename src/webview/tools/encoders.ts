/** Encoders / decoders: base64 (text & file), certificate, gzip, HTML, JWT, QR, URL. */
import qrcode from 'qrcode-generator';
import {
  area,
  badge,
  btn,
  checkbox,
  copyBtn,
  downloadBlob,
  downloadBtn,
  errorSlot,
  field,
  fileDrop,
  note,
  pane,
  readDataUrl,
  readText,
  select,
  setError,
  split,
  stats,
  table,
  tabs,
  textInput,
  toolbar,
} from '../components.ts';
import { h, svgIcon } from '../dom.ts';
import { defineTool } from '../tool-types.ts';
import {
  base64ToBytes,
  base64ToUtf8,
  bytesToBase64,
  decodeBase64,
  encodeBase64,
  formatBytesAsText,
  fromBase64Url,
  toBase64Url,
  utf8ToBase64,
} from '../lib/bytes.ts';
import { escapeText, unescapeText } from '../lib/escapers.ts';
import { t } from '../i18n.ts';

function base64TextTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'encoders-base64-text',
    group: 'encoders',
    icon: '<path d="M7 8l-4 4l4 4"/><path d="M17 8l4 4l-4 4"/><path d="M14 4l-4 16"/>',
    name: { en: 'Base64 Text', ru: 'Base64: текст' },
    desc: {
      en: 'Encode UTF-8 text to Base64 and decode it back, with URL-safe variant.',
      ru: 'Кодирование UTF-8 текста в Base64 и обратное декодирование, включая URL-safe.',
    },
    keywords: 'base64 encode decode text utf8',
    mount(root, ctx) {
      const input = area({ rows: 12, value: 'Hello, Dev Tools! 👋', wrap: 'soft' });
      const output = area({ readOnly: true, rows: 12, wrap: 'soft' });
      const error = errorSlot();
      let mode: 'encode' | 'decode' = 'encode';
      let urlSafe = false;

      const modeSelect = select(
        [
          { value: 'encode', label: ctx.pick('Encode', 'Кодировать') },
          { value: 'decode', label: ctx.pick('Decode', 'Декодировать') },
        ],
        mode,
        (value) => {
          mode = value as typeof mode;
          update();
        },
      );
      const urlSafeToggle = checkbox(ctx.pick('URL-safe alphabet', 'URL-safe алфавит'), false, (value) => {
        urlSafe = value;
        update();
      });

      const update = () => {
        try {
          output.value = mode === 'encode' ? encodeBase64(input.value, urlSafe) : decodeBase64(input.value);
          setError(error, null);
        } catch (cause) {
          setError(error, cause instanceof Error ? cause.message : String(cause));
          output.value = '';
        }
      };

      input.addEventListener('input', update);
      update();

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          toolbar(
            modeSelect,
            urlSafeToggle,
            btn(ctx.pick('Swap', 'Поменять'), () => {
              const temp = input.value;
              input.value = output.value;
              output.value = temp;
              mode = mode === 'encode' ? 'decode' : 'encode';
              modeSelect.value = mode;
              update();
            }, { variant: 'ghost' }),
          ),
          error,
          split(
            pane(ctx.pick('Input', 'Вход'), input),
            pane(ctx.pick('Output', 'Результат'), output, [
              copyBtn(() => output.value),
              downloadBtn(() => output.value, mode === 'encode' ? 'encoded.txt' : 'decoded.txt'),
            ]),
          ),
          stats([
            [ctx.pick('Input size', 'Размер входа'), `${new TextEncoder().encode(input.value).length} B`],
            [ctx.pick('Output length', 'Длина выхода'), output.value.length],
          ]),
        ),
      );
    },
  });
}

const MIME_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'application/gzip': 'gz',
  'application/x-7z-compressed': '7z',
  'application/vnd.rar': 'rar',
  'application/json': 'json',
  'text/plain': 'txt',
  'text/html': 'html',
  'application/octet-stream': 'bin',
};

const FILE_ICON =
  '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z"/>';

/** Guesses the MIME type of raw bytes from their signature. */
function sniffMime(bytes: Uint8Array): string {
  const at = (index: number): number => bytes[index] ?? 0;
  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47) return 'image/png';
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return 'image/jpeg';
  if (at(0) === 0x47 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x38) return 'image/gif';
  if (at(0) === 0x52 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x46 && at(8) === 0x57 && at(9) === 0x45 && at(10) === 0x42 && at(11) === 0x50) return 'image/webp';
  if (at(0) === 0x25 && at(1) === 0x50 && at(2) === 0x44 && at(3) === 0x46) return 'application/pdf';
  if (at(0) === 0x50 && at(1) === 0x4b && (at(2) === 0x03 || at(2) === 0x05 || at(2) === 0x07)) return 'application/zip';
  if (at(0) === 0x1f && at(1) === 0x8b) return 'application/gzip';
  if (at(0) === 0x37 && at(1) === 0x7a && at(2) === 0xbc && at(3) === 0xaf) return 'application/x-7z-compressed';
  if (at(0) === 0x52 && at(1) === 0x61 && at(2) === 0x72 && at(3) === 0x21) return 'application/vnd.rar';
  return 'application/octet-stream';
}

function extensionFor(mime: string): string {
  return MIME_EXTENSIONS[mime] ?? mime.split('/').pop()?.replace(/[^a-z0-9]/gi, '') ?? 'bin';
}

interface DecodedData {
  mime: string;
  bytes: Uint8Array;
}

/** Parses `data:<mime>[;base64],<payload>` (percent-encoded payloads are supported too). */
function decodeDataUrl(value: string): DecodedData | null {
  const raw = value.trim();
  if (!raw.startsWith('data:')) return null;
  const comma = raw.indexOf(',');
  if (comma < 0) return null;
  const header = raw.slice(5, comma);
  const mime = header.split(';')[0].trim() || 'application/octet-stream';
  const payload = raw.slice(comma + 1);
  try {
    if (!header.toLowerCase().includes('base64')) {
      return { mime, bytes: new TextEncoder().encode(decodeURIComponent(payload)) };
    }
    return { mime, bytes: base64ToBytes(payload.replace(/\s+/g, '')) };
  } catch {
    return null;
  }
}

function base64FileTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'encoders-base64-image',
    group: 'encoders',
    icon: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z"/><path d="M9 13h6"/><path d="M9 17h4"/>',
    name: { en: 'Base64 File', ru: 'Base64: файл' },
    desc: {
      en: 'Convert any file (image, archive, PDF…) to a Base64 data URL and decode Base64 back into a file.',
      ru: 'Преобразование файлов (изображение, архив, PDF…) в Base64 data URL и обратное декодирование в файл.',
    },
    keywords: 'base64 file dataurl image preview archive zip pdf gzip download',
    mount(root, ctx) {
      const fileCard = (name: string, mime: string, size: number): HTMLElement =>
        h(
          'div',
          { class: 'dt-b64-file' },
          h('span', { class: 'dt-b64-file-icon' }, svgIcon(FILE_ICON, 26)),
          h(
            'div',
            { class: 'dt-b64-file-meta' },
            h('div', { class: 'dt-b64-file-name' }, name),
            h('div', { class: 'dt-b64-file-sub' }, `${mime} · ${formatBytesAsText(size)}`),
          ),
        );

      const rowList = (name: string | null, mime: string, size: number, base64Length: number, dims?: [number, number]): Array<[string, string]> => {
        const rows: Array<[string, string]> = [];
        if (name) rows.push([ctx.pick('File', 'Файл'), name]);
        rows.push(['MIME', mime]);
        rows.push([ctx.pick('Size', 'Размер'), formatBytesAsText(size)]);
        if (dims) rows.push([ctx.pick('Dimensions', 'Размеры'), `${dims[0]} × ${dims[1]}`]);
        rows.push([ctx.pick('Base64 length', 'Длина Base64'), String(base64Length)]);
        return rows;
      };

      /** Images get a real preview, everything else a file card with type and size. */
      const present = (host: HTMLElement, infoHost: HTMLElement, name: string | null, mime: string, bytes: Uint8Array, dataUrl: string): void => {
        host.replaceChildren();
        infoHost.replaceChildren(stats(rowList(name, mime, bytes.length, dataUrl.length)));
        const label = name ?? `file.${extensionFor(mime)}`;
        if (!mime.startsWith('image/')) {
          host.appendChild(fileCard(label, mime, bytes.length));
          return;
        }
        const image = h('img', { class: 'dt-preview-img', alt: '' });
        image.onload = () => infoHost.replaceChildren(stats(rowList(name, mime, bytes.length, dataUrl.length, [image.naturalWidth, image.naturalHeight])));
        image.onerror = () => host.replaceChildren(fileCard(label, mime, bytes.length));
        image.src = dataUrl;
        host.appendChild(image);
      };

      const uploadPreview = h('div', { class: 'dt-b64-preview' });
      const uploadInfo = h('div');
      const base64Area = area({ readOnly: true, rows: 8, wrap: 'soft' });

      const uploadTab = h(
        'div',
        { class: 'dt-stack' },
        fileDrop({
          hint: ctx.pick('Drop any file (image, archive, PDF, document…)', 'Перетащите любой файл (изображение, архив, PDF, документ…)'),
          onFiles: async (files) => {
            const file = files[0];
            const dataUrl = await readDataUrl(file);
            const decoded = decodeDataUrl(dataUrl);
            const mime = file.type || decoded?.mime || 'application/octet-stream';
            base64Area.value = dataUrl;
            present(uploadPreview, uploadInfo, file.name, mime, decoded?.bytes ?? new Uint8Array(), dataUrl);
          },
        }),
        uploadPreview,
        uploadInfo,
        pane('Base64', base64Area, [copyBtn(() => base64Area.value), downloadBtn(() => base64Area.value, 'file.base64.txt')]),
      );

      const decodeInput = area({ rows: 8, placeholder: 'data:application/pdf;base64,… or raw base64', wrap: 'soft' });
      const decodePreview = h('div', { class: 'dt-b64-preview' });
      const decodeInfo = h('div');
      const decodeError = errorSlot();
      let decodedName = 'file.bin';
      let decodedBlob: Blob | null = null;

      const decode = () => {
        const raw = decodeInput.value.trim();
        decodePreview.replaceChildren();
        decodeInfo.replaceChildren();
        decodedBlob = null;
        if (!raw) {
          setError(decodeError, null);
          return;
        }
        try {
          const fromDataUrl = decodeDataUrl(raw);
          const bytes = fromDataUrl?.bytes ?? base64ToBytes(raw.replace(/\s+/g, ''));
          const declared = fromDataUrl?.mime ?? '';
          const mime = declared && declared !== 'application/octet-stream' ? declared : sniffMime(bytes);
          const dataUrl = `data:${mime};base64,${bytesToBase64(bytes)}`;
          decodedName = `file.${extensionFor(mime)}`;
          decodedBlob = new Blob([bytes as BlobPart], { type: mime });
          present(decodePreview, decodeInfo, decodedName, mime, bytes, dataUrl);
          setError(decodeError, null);
        } catch {
          decodedBlob = null;
          setError(decodeError, ctx.pick('Invalid Base64 data.', 'Некорректные данные Base64.'));
        }
      };
      decodeInput.addEventListener('input', decode);

      const decodeTab = h(
        'div',
        { class: 'dt-stack' },
        pane('Base64 / data URL', decodeInput),
        decodeError,
        decodePreview,
        decodeInfo,
        h(
          'div',
          { class: 'dt-inline-actions' },
          btn(
            ctx.pick('Download file', 'Скачать файл'),
            () => {
              if (decodedBlob) downloadBlob(decodedName, decodedBlob);
            },
            { variant: 'primary' },
          ),
          copyBtn(() => decodeInput.value),
        ),
      );

      root.append(tabs([
        { id: 'upload', label: ctx.pick('File → Base64', 'Файл → Base64'), render: () => uploadTab },
        { id: 'decode', label: ctx.pick('Base64 → File', 'Base64 → Файл'), render: () => decodeTab },
      ]));
    },
  });
}


interface CertificateInfo {
  subject: string;
  issuer: string;
  validFrom: string;
  validTo: string;
  serialNumber: string;
  fingerprint: string;
  fingerprint256: string;
  subjectAltName: string;
  ca: boolean;
  keyUsage: string[];
  publicKey: string;
  daysLeft: number;
}

function certificateTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'encoders-certificate',
    group: 'encoders',
    icon: '<path d="M12 15a3 3 0 1 0 0 -6a3 3 0 0 0 0 6z"/><path d="M12 3l7 3v6c0 4 -3 7 -7 9c-4 -2 -7 -5 -7 -9v-6z"/>',
    name: { en: 'Certificate Decoder', ru: 'Разбор сертификата' },
    desc: {
      en: 'Inspect X.509 certificates: subject, issuer, validity, SAN and fingerprints.',
      ru: 'Просмотр X.509 сертификатов: владелец, издатель, срок, SAN и отпечатки.',
    },
    keywords: 'x509 certificate pem ssl tls decode',
    mount(root, ctx) {
      const input = area({ rows: 10, placeholder: '-----BEGIN CERTIFICATE-----' });
      const output = h('div');
      const error = errorSlot();

      const parse = async () => {
        if (!input.value.trim()) {
          output.replaceChildren();
          setError(error, null);
          return;
        }
        try {
          const info = await ctx.rpc<CertificateInfo>('certificate', { pem: input.value });
          setError(error, null);
          const validityTone = info.daysLeft < 0 ? 'bad' : info.daysLeft < 30 ? 'warn' : 'ok';
          output.replaceChildren(
            h(
              'div',
              { class: 'dt-inline-actions' },
              badge(info.daysLeft < 0 ? ctx.pick('Expired', 'Истёк') : ctx.pick(`Valid for ${info.daysLeft} days`, `Действует ${info.daysLeft} дн.`), validityTone),
              info.ca ? badge('CA', 'neutral') : null,
            ),
            table(
              [ctx.pick('Property', 'Свойство'), ctx.pick('Value', 'Значение')],
              [
                [ctx.pick('Subject', 'Владелец'), info.subject],
                [ctx.pick('Issuer', 'Издатель'), info.issuer],
                [ctx.pick('Valid from', 'Действует с'), info.validFrom],
                [ctx.pick('Valid to', 'Действует до'), info.validTo],
                [ctx.pick('Serial number', 'Серийный номер'), info.serialNumber],
                ['SHA-1', info.fingerprint],
                ['SHA-256', info.fingerprint256],
                [ctx.pick('Subject alt names', 'Альтернативные имена'), info.subjectAltName || '—'],
                [ctx.pick('Key usage', 'Использование ключа'), info.keyUsage.join(', ') || '—'],
              ],
            ),
            pane('Public key (SPKI PEM)', area({ value: info.publicKey, readOnly: true, rows: 8 }), [copyBtn(() => info.publicKey)]),
          );
        } catch (cause) {
          setError(error, cause instanceof Error ? cause.message : String(cause));
          output.replaceChildren();
        }
      };

      const loadFile = fileDrop({
        accept: '.pem,.crt,.cer,.txt',
        onFiles: async (files) => {
          input.value = await readText(files[0]);
          await parse();
        },
      });

      input.addEventListener('input', () => {
        void parse();
      });

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          loadFile,
          pane(ctx.pick('Certificate (PEM)', 'Сертификат (PEM)'), input, [btn(ctx.pick('Parse', 'Разобрать'), () => void parse(), { variant: 'primary' }), copyBtn(() => input.value)]),
          error,
          pane(ctx.pick('Details', 'Подробности'), output),
        ),
      );
    },
  });
}

function gzipTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'encoders-gzip',
    group: 'encoders',
    icon: '<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/><path d="M9 7v10"/><path d="M15 7v10"/>',
    name: { en: 'GZIP', ru: 'GZIP' },
    desc: {
      en: 'Compress and decompress GZIP data using Base64 as transport format.',
      ru: 'Сжатие и распаковка GZIP с передачей данных в Base64.',
    },
    keywords: 'gzip compress decompress zlib base64',
    mount(root, ctx) {
      const input = area({ rows: 10, placeholder: ctx.pick('Plain text or Base64 data', 'Обычный текст или данные в Base64') });
      const output = area({ readOnly: true, rows: 10 });
      const error = errorSlot();
      const info = h('div');
      let inputIsBase64 = false;

      const compress = async () => {
        try {
          const result = await ctx.rpc<{ data: string; size: number }>('gzip', {
            action: 'compress',
            data: utf8ToBase64(input.value),
          });
          output.value = result.data;
          info.replaceChildren(
            stats([
              [ctx.pick('Original', 'Исходный размер'), `${new TextEncoder().encode(input.value).length} B`],
              [ctx.pick('Compressed', 'Сжатый размер'), `${result.size} B`],
              [ctx.pick('Ratio', 'Степень сжатия'), `${((1 - result.size / Math.max(1, new TextEncoder().encode(input.value).length)) * 100).toFixed(1)} %`],
            ]),
          );
          setError(error, null);
        } catch (cause) {
          setError(error, cause instanceof Error ? cause.message : String(cause));
        }
      };

      const decompress = async () => {
        try {
          const result = await ctx.rpc<{ data: string; size: number }>('gzip', {
            action: 'decompress',
            data: input.value.trim(),
          });
          output.value = base64ToUtf8(result.data);
          info.replaceChildren(
            stats([
              [ctx.pick('Compressed', 'Сжатый размер'), `${input.value.replace(/\s+/g, '').length} B`],
              [ctx.pick('Decompressed', 'Распакованный размер'), `${result.size} B`],
            ]),
          );
          setError(error, null);
        } catch (cause) {
          setError(error, cause instanceof Error ? cause.message : String(cause));
        }
      };

      const loadFile = fileDrop({
        accept: '.gz,.txt',
        onFiles: async (files) => {
          const buffer = await files[0].arrayBuffer();
          input.value = bytesToBase64(new Uint8Array(buffer));
          inputIsBase64 = true;
          await decompress();
        },
      });

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          loadFile,
          toolbar(
            btn(ctx.pick('Compress', 'Сжать'), () => void compress(), { variant: 'primary' }),
            btn(ctx.pick('Decompress', 'Распаковать'), () => void decompress()),
            checkbox(ctx.pick('Input is Base64', 'Вход в Base64'), inputIsBase64, (value) => {
              inputIsBase64 = value;
            }),
          ),
          error,
          split(
            pane(ctx.pick('Input', 'Вход'), input),
            pane(ctx.pick('Output', 'Результат'), output, [copyBtn(() => output.value), downloadBtn(() => output.value, 'result.txt')]),
          ),
          info,
        ),
      );
    },
  });
}

function htmlTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'encoders-html',
    group: 'encoders',
    icon: '<path d="M4 5l2 14h12l2 -14z"/><path d="M9 9h6"/><path d="M9 13h4"/>',
    name: { en: 'HTML Entities', ru: 'HTML-сущности' },
    desc: {
      en: 'Encode special characters as HTML entities and decode them back.',
      ru: 'Кодирование спецсимволов в HTML-сущности и обратное декодирование.',
    },
    keywords: 'html entities escape encode decode',
    mount(root, ctx) {
      const input = area({ rows: 12, value: '<div class="card">Café & crème — "quoted"</div>' });
      const output = area({ readOnly: true, rows: 12 });
      const error = errorSlot();
      let mode: 'encode' | 'decode' = 'encode';
      const modeSelect = select(
        [
          { value: 'encode', label: ctx.pick('Encode', 'Кодировать') },
          { value: 'decode', label: ctx.pick('Decode', 'Декодировать') },
        ],
        'encode',
        (value) => {
          mode = value as typeof mode;
          update();
        },
      );

      const update = () => {
        try {
          output.value = mode === 'encode' ? escapeText(input.value, 'html') : unescapeText(input.value, 'html');
          setError(error, null);
        } catch (cause) {
          setError(error, cause instanceof Error ? cause.message : String(cause));
        }
      };
      input.addEventListener('input', update);
      update();

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          toolbar(modeSelect),
          error,
          split(
            pane(ctx.pick('Input', 'Вход'), input),
            pane(ctx.pick('Output', 'Результат'), output, [copyBtn(() => output.value), downloadBtn(() => output.value, 'entities.txt')]),
          ),
          pane(
            ctx.pick('Common entities', 'Основные сущности'),
            table(
              [ctx.pick('Character', 'Символ'), 'Named', 'Numeric'],
              [
                ['&', '&amp;', '&#38;'],
                ['<', '&lt;', '&#60;'],
                ['>', '&gt;', '&#62;'],
                ['"', '&quot;', '&#34;'],
                ["'", '&apos;', '&#39;'],
                ['©', '&copy;', '&#169;'],
                ['—', '&mdash;', '&#8212;'],
                ['€', '&euro;', '&#8364;'],
                ['😀', '—', '&#128512;'],
              ],
            ),
          ),
        ),
      );
    },
  });
}

interface JwtParts {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
  signingInput: string;
}

function decodeJwt(token: string): JwtParts {
  const parts = token.trim().split('.');
  if (parts.length < 2) throw new Error('A JWT must contain at least two segments separated by dots');
  const decoder = new TextDecoder();
  const header = JSON.parse(decoder.decode(fromBase64Url(parts[0]))) as Record<string, unknown>;
  const payload = JSON.parse(decoder.decode(fromBase64Url(parts[1]))) as Record<string, unknown>;
  return { header, payload, signature: parts[2] ?? '', signingInput: `${parts[0]}.${parts[1]}` };
}

async function hmacSign(secret: string, data: string, hash: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)));
}

function timestampInfo(value: unknown, now: number): { text: string; tone: 'ok' | 'warn' | 'bad' | 'neutral' } {
  if (typeof value !== 'number') return { text: '—', tone: 'neutral' };
  const date = new Date(value * 1000);
  const delta = value * 1000 - now;
  const days = Math.round(Math.abs(delta) / 86_400_000);
  if (delta < 0) return { text: `${date.toLocaleString()} (−${days}d)`, tone: 'bad' };
  return { text: `${date.toLocaleString()} (+${days}d)`, tone: 'ok' };
}

function jwtTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'encoders-jwt',
    group: 'encoders',
    icon: '<path d="M12 3l3 4l-3 4l-3 -4z"/><path d="M12 11l3 4l-3 4l-3 -4z"/><path d="M12 19v2"/>',
    name: { en: 'JWT Decoder', ru: 'JWT-декодер' },
    desc: {
      en: 'Decode JSON Web Tokens, check expiry and verify or create HS256/384/512 signatures.',
      ru: 'Разбор JWT, проверка срока действия и подпись HS256/384/512.',
    },
    keywords: 'jwt token json web token hs256 verify sign',
    mount(root, ctx) {
      const tokenArea = area({ rows: 6, placeholder: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…' });
      const headerArea = area({ readOnly: true, rows: 5 });
      const payloadArea = area({ readOnly: true, rows: 10 });
      const claimsHost = h('div');
      const decodeError = errorSlot();
      const signatureStatus = h('div');

      const secret = textInput({ type: 'password', placeholder: ctx.pick('Signing secret', 'Секрет подписи') });
      const algorithm = select(
        [
          { value: 'SHA-256', label: 'HS256' },
          { value: 'SHA-384', label: 'HS384' },
          { value: 'SHA-512', label: 'HS512' },
        ],
        'SHA-256',
      );

      let current: JwtParts | null = null;

      const decode = () => {
        try {
          current = decodeJwt(tokenArea.value);
          headerArea.value = JSON.stringify(current.header, null, 2);
          payloadArea.value = JSON.stringify(current.payload, null, 2);
          setError(decodeError, null);
          signatureStatus.replaceChildren();

          const claims: Array<[string, string | Node]> = [];
          const known: Array<[string, string]> = [
            ['iss', ctx.pick('Issuer', 'Издатель')],
            ['sub', ctx.pick('Subject', 'Субъект')],
            ['aud', ctx.pick('Audience', 'Аудитория')],
            ['jti', 'JTI'],
            ['scope', 'Scope'],
          ];
          for (const [key, label] of known) {
            if (key in current.payload) claims.push([label, String(current.payload[key])]);
          }
          if ('exp' in current.payload) {
            const info = timestampInfo(current.payload.exp, Date.now());
            claims.push([ctx.pick('Expires at', 'Истекает'), h('span', { class: `dt-claim dt-claim-${info.tone}` }, info.text)]);
          }
          if ('iat' in current.payload) claims.push([ctx.pick('Issued at', 'Выдан'), timestampInfo(current.payload.iat, Date.now()).text]);
          if ('nbf' in current.payload) claims.push([ctx.pick('Not before', 'Не раньше'), timestampInfo(current.payload.nbf, Date.now()).text]);
          for (const [key, value] of Object.entries(current.payload)) {
            if (!['iss', 'sub', 'aud', 'jti', 'scope', 'exp', 'iat', 'nbf'].includes(key)) {
              claims.push([key, typeof value === 'object' ? JSON.stringify(value) : String(value)]);
            }
          }
          claimsHost.replaceChildren(claims.length ? table([ctx.pick('Claim', 'Клейм'), ctx.pick('Value', 'Значение')], claims) : note(ctx.pick('No claims', 'Нет клеймов'), 'info'));
        } catch (cause) {
          current = null;
          headerArea.value = '';
          payloadArea.value = '';
          claimsHost.replaceChildren();
          setError(decodeError, cause instanceof Error ? cause.message : String(cause));
        }
      };
      tokenArea.addEventListener('input', decode);

      const verify = async () => {
        if (!current) return;
        try {
          if (!current.signature) throw new Error(ctx.pick('Token is not signed', 'Токен не подписан'));
          const expected = toBase64Url(await hmacSign(secret.value, current.signingInput, algorithm.value));
          const matches = expected === current.signature.replace(/=+$/, '');
          signatureStatus.replaceChildren(
            note(
              matches ? ctx.pick('Signature is valid', 'Подпись верна') : ctx.pick('Signature does not match', 'Подпись не совпадает'),
              matches ? 'ok' : 'error',
            ),
          );
        } catch (cause) {
          signatureStatus.replaceChildren(note(cause instanceof Error ? cause.message : String(cause), 'error'));
        }
      };

      const signPayload = area({ rows: 10, value: '{\n  "sub": "1234567890",\n  "name": "John Doe",\n  "iat": 1516239022\n}' });
      const signSecret = textInput({ type: 'password', placeholder: ctx.pick('Signing secret', 'Секрет подписи') });
      const signAlgorithm = select(
        [
          { value: 'SHA-256', label: 'HS256' },
          { value: 'SHA-384', label: 'HS384' },
          { value: 'SHA-512', label: 'HS512' },
        ],
        'SHA-256',
      );
      const signOutput = area({ readOnly: true, rows: 6 });
      const signError = errorSlot();

      const sign = async () => {
        try {
          const header = { alg: signAlgorithm.value === 'SHA-256' ? 'HS256' : signAlgorithm.value === 'SHA-384' ? 'HS384' : 'HS512', typ: 'JWT' };
          const payload = JSON.parse(signPayload.value) as unknown;
          const encoder = new TextEncoder();
          const encodedHeader = toBase64Url(encoder.encode(JSON.stringify(header)));
          const encodedPayload = toBase64Url(encoder.encode(JSON.stringify(payload)));
          const signingInput = `${encodedHeader}.${encodedPayload}`;
          const signature = toBase64Url(await hmacSign(signSecret.value, signingInput, signAlgorithm.value));
          signOutput.value = `${signingInput}.${signature}`;
          setError(signError, null);
        } catch (cause) {
          setError(signError, cause instanceof Error ? cause.message : String(cause));
        }
      };

      const decodeTab = h(
        'div',
        { class: 'dt-stack' },
        pane('JWT', tokenArea, [btn(ctx.pick('Decode', 'Разобрать'), decode, { variant: 'primary' }), copyBtn(() => tokenArea.value)]),
        decodeError,
        split(
          h('div', { class: 'dt-stack' }, pane('Header', headerArea, [copyBtn(() => headerArea.value)]), pane('Payload', payloadArea, [copyBtn(() => payloadArea.value)])),
          h(
            'div',
            { class: 'dt-stack' },
            pane(ctx.pick('Claims', 'Клеймы'), claimsHost),
            pane(
              ctx.pick('Verify signature', 'Проверка подписи'),
              h('div', { class: 'dt-stack' }, h('div', { class: 'dt-inline-form' }, field(ctx.pick('Secret', 'Секрет'), secret), field('Algorithm', algorithm)), signatureStatus, btn(ctx.pick('Verify', 'Проверить'), () => void verify(), { variant: 'primary' })),
            ),
          ),
        ),
      );

      const signTab = h(
        'div',
        { class: 'dt-stack' },
        pane(ctx.pick('Payload (JSON)', 'Payload (JSON)'), signPayload),
        h('div', { class: 'dt-inline-form' }, field(ctx.pick('Secret', 'Секрет'), signSecret), field('Algorithm', signAlgorithm), btn(ctx.pick('Sign', 'Подписать'), () => void sign(), { variant: 'primary' })),
        signError,
        pane(ctx.pick('Signed token', 'Подписанный токен'), signOutput, [copyBtn(() => signOutput.value)]),
      );

      root.append(tabs([
        { id: 'decode', label: ctx.pick('Decode & verify', 'Разбор и проверка'), render: () => decodeTab },
        { id: 'sign', label: ctx.pick('Sign', 'Подпись'), render: () => signTab },
      ]));
    },
  });
}

function qrTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'encoders-qr-code',
    group: 'encoders',
    icon: '<path d="M4 4h6v6h-6z"/><path d="M14 4h6v6h-6z"/><path d="M4 14h6v6h-6z"/><path d="M14 14h2v2h-2z"/><path d="M18 14h2v2h-2z"/><path d="M14 18h2v2h-2z"/><path d="M18 18h2v2h-2z"/>',
    name: { en: 'QR Code', ru: 'QR-код' },
    desc: {
      en: 'Generate QR codes with adjustable error correction and download as PNG or SVG.',
      ru: 'Генерация QR-кодов с выбором уровня коррекции и экспортом в PNG или SVG.',
    },
    keywords: 'qr code generator barcode svg png',
    mount(root, ctx) {
      const input = area({ rows: 4, value: 'https://devtoys.app/' });
      const canvas = h('canvas', { class: 'dt-qr-canvas' });
      const error = errorSlot();
      const meta = h('div');
      let level: 'L' | 'M' | 'Q' | 'H' = 'M';
      let cellSize = 6;

      const levelSelect = select(
        [
          { value: 'L', label: 'L — 7%' },
          { value: 'M', label: 'M — 15%' },
          { value: 'Q', label: 'Q — 25%' },
          { value: 'H', label: 'H — 30%' },
        ],
        level,
        (value) => {
          level = value as typeof level;
          render();
        },
      );
      const sizeSelect = select(
        [
          { value: '4', label: ctx.pick('Small', 'Маленький') },
          { value: '6', label: ctx.pick('Medium', 'Средний') },
          { value: '8', label: ctx.pick('Large', 'Большой') },
        ],
        String(cellSize),
        (value) => {
          cellSize = Number(value);
          render();
        },
      );

      let matrix: boolean[][] = [];
      const render = () => {
        try {
          const text = input.value;
          if (!text.trim()) {
            matrix = [];
            canvas.width = 0;
            canvas.height = 0;
            meta.replaceChildren();
            setError(error, null);
            return;
          }
          const qr = qrcode(0, level);
          qr.addData(text);
          qr.make();
          const count = qr.getModuleCount();
          matrix = Array.from({ length: count }, (_, row) => Array.from({ length: count }, (_, column) => qr.isDark(row, column)));
          const margin = 4;
          const total = (count + margin * 2) * cellSize;
          canvas.width = total;
          canvas.height = total;
          const context2d = canvas.getContext('2d');
          if (context2d) {
            context2d.fillStyle = '#ffffff';
            context2d.fillRect(0, 0, total, total);
            context2d.fillStyle = '#000000';
            for (let row = 0; row < count; row++) {
              for (let column = 0; column < count; column++) {
                if (matrix[row][column]) {
                  context2d.fillRect((column + margin) * cellSize, (row + margin) * cellSize, cellSize, cellSize);
                }
              }
            }
          }
          meta.replaceChildren(
            stats([
              [ctx.pick('Modules', 'Модулей'), `${count} × ${count}`],
              [ctx.pick('Canvas', 'Холст'), `${total} × ${total} px`],
              [ctx.pick('Characters', 'Символов'), text.length],
            ]),
          );
          setError(error, null);
        } catch (cause) {
          matrix = [];
          setError(error, cause instanceof Error ? cause.message : String(cause));
        }
      };
      input.addEventListener('input', render);

      const downloadPng = () => {
        canvas.toBlob((blob) => {
          if (!blob) return;
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = 'qr-code.png';
          link.click();
          setTimeout(() => URL.revokeObjectURL(link.href), 2000);
        }, 'image/png');
      };

      const downloadSvg = () => {
        if (!matrix.length) return;
        const margin = 4;
        const size = matrix.length + margin * 2;
        let path = '';
        matrix.forEach((row, rowIndex) => {
          row.forEach((dark, columnIndex) => {
            if (dark) path += `M${columnIndex + margin} ${rowIndex + margin}h1v1h-1z`;
          });
        });
        const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#ffffff"/><path d="${path}" fill="#000000"/></svg>`;
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
        link.download = 'qr-code.svg';
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 2000);
      };

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          split(
            h(
              'div',
              { class: 'dt-stack' },
              pane(ctx.pick('Content', 'Содержимое'), input),
              h('div', { class: 'dt-inline-form' }, field(ctx.pick('Error correction', 'Коррекция ошибок'), levelSelect), field(ctx.pick('Cell size', 'Размер модуля'), sizeSelect)),
              error,
              meta,
            ),
            h(
              'div',
              { class: 'dt-stack dt-center' },
              h('div', { class: 'dt-qr-frame' }, canvas),
              toolbar(
                btn('PNG', downloadPng, { variant: 'primary', icon: '<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2"/><path d="M7 11l5 5l5 -5"/><path d="M12 4l0 12"/>' }),
                btn('SVG', downloadSvg, { icon: '<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2"/><path d="M7 11l5 5l5 -5"/><path d="M12 4l0 12"/>' }),
              ),
            ),
          ),
        ),
      );
      render();
    },
  });
}

function urlTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'encoders-url',
    group: 'encoders',
    icon: '<path d="M10 14a3.5 3.5 0 0 0 5 0l3 -3a3.5 3.5 0 0 0 -5 -5l-1 1"/><path d="M14 10a3.5 3.5 0 0 0 -5 0l-3 3a3.5 3.5 0 0 0 5 5l1 -1"/>',
    name: { en: 'URL Encode / Decode', ru: 'URL: кодирование' },
    desc: {
      en: 'Encode and decode URLs, inspect query parameters and components.',
      ru: 'Кодирование и декодирование URL, разбор параметров запроса и компонентов.',
    },
    keywords: 'url encode decode uri percent query params',
    mount(root, ctx) {
      const input = area({ rows: 8, value: 'https://example.com/search?q=hello world&lang=ru#top' });
      const output = area({ readOnly: true, rows: 8 });
      const error = errorSlot();
      const parts = h('div');
      let mode: 'encode' | 'decode' = 'encode';
      let fullUrl = false;

      const modeSelect = select(
        [
          { value: 'encode', label: ctx.pick('Encode', 'Кодировать') },
          { value: 'decode', label: ctx.pick('Decode', 'Декодировать') },
        ],
        mode,
        (value) => {
          mode = value as typeof mode;
          update();
        },
      );

      const update = () => {
        try {
          output.value = mode === 'encode'
            ? escapeText(input.value, 'url', fullUrl)
            : unescapeText(input.value, 'url', fullUrl);
          setError(error, null);
        } catch (cause) {
          setError(error, cause instanceof Error ? cause.message : String(cause));
          output.value = '';
        }

        try {
          const url = new URL(mode === 'encode' ? input.value.trim() : unescapeText(input.value, 'url', true));
          const rows: Array<[string, string]> = [
            ['Protocol', url.protocol],
            ['Host', url.host],
            ['Path', url.pathname],
            ['Query', url.search || '—'],
            ['Hash', url.hash || '—'],
            ['Origin', url.origin],
          ];
          parts.replaceChildren(
            table([ctx.pick('Component', 'Компонент'), ctx.pick('Value', 'Значение')], rows),
            url.searchParams.size
              ? table(
                  [ctx.pick('Parameter', 'Параметр'), ctx.pick('Value', 'Значение')],
                  [...url.searchParams.entries()].map(([key, value]) => [key, value]),
                )
              : note(ctx.pick('No query parameters', 'Нет параметров запроса'), 'info'),
          );
        } catch {
          parts.replaceChildren();
        }
      };
      input.addEventListener('input', update);
      update();

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          toolbar(
            modeSelect,
            checkbox(ctx.pick('Full URL mode (keeps :/?&=#)', 'Режим полного URL (сохраняет :/?&=#)'), false, (value) => {
              fullUrl = value;
              update();
            }),
          ),
          error,
          split(
            pane(ctx.pick('Input', 'Вход'), input),
            pane(ctx.pick('Output', 'Результат'), output, [copyBtn(() => output.value)]),
          ),
          pane(ctx.pick('Parsed URL', 'Разобранный URL'), parts),
        ),
      );
    },
  });
}

export const encoderTools = [
  base64TextTool(),
  base64FileTool(),
  certificateTool(),
  gzipTool(),
  htmlTool(),
  jwtTool(),
  qrTool(),
  urlTool(),
];
