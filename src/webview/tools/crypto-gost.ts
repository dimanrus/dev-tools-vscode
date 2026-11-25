/**
 * ГОСТ-криптография: шифры (Кузнечик, Магма, ГОСТ 28147-89) и хеши/ЭЦП.
 * Реализации берутся из @li0ard/gost (чистый TypeScript, работает без хоста расширения).
 */
import { area, badge, btn, checkbox, copyBtn, errorSlot, field, note, pane, select, setError, split, stats, tabs, textInput, toolbar, segmented } from '../components.ts';
import { h } from '../dom.ts';
import { defineTool } from '../tool-types.ts';
import { formatBytesAsText } from '../lib/bytes.ts';
import { bytesToHex, decodeData, encodeData, hexToBytes, pkcs7Pad, pkcs7Unpad, randomBytes, type DataEncoding } from '../lib/crypto/codec.ts';
import { Kuznyechik } from '@li0ard/gost/kuznyechik.js';
import { Magma, MagmaLegacy, magmaSboxes } from '@li0ard/gost/magma.js';
import { cbc, cfb, ctr, ecb, kexp15, kwp, mac, mac_legacy, mgm, ofb, omac_acpkm } from '@li0ard/gost/modes.js';
import { CURVES } from '@li0ard/gost/gost3410.js';
import { gost341194 } from '@li0ard/gost/gost341194.js';
import { streebog256, streebog512 } from '@li0ard/gost/streebog.js';
import { gost341194hmac, streebog256hmac, streebog512hmac } from '@li0ard/gost/hmac.js';
import { cpkdf, gost341194pbkdf2, kdf_gostr3411_2012_256, streebog256pbkdf2, streebog512pbkdf2 } from '@li0ard/gost/kdf.js';
import type { Cipher } from '@li0ard/gost/types.js';

type GostKind = 'kuznyechik' | 'magma' | 'magma-legacy';
type GostMode = 'ecb' | 'cbc' | 'cfb' | 'ctr' | 'ctr-acpkm' | 'ofb' | 'mac' | 'omac-acpkm' | 'mgm' | 'kexp15' | 'kwp';

interface ModeInfo {
  iv: number;
  kind: 'block' | 'stream' | 'mac' | 'aead' | 'wrap';
  tag?: number;
}

const KINDS: Array<{ value: GostKind; en: string; ru: string; block: number }> = [
  { value: 'kuznyechik', en: 'Kuznyechik (GOST R 34.12-2015)', ru: 'Кузнечик (ГОСТ Р 34.12-2015)', block: 16 },
  { value: 'magma', en: 'Magma (GOST R 34.12-2015)', ru: 'Магма (ГОСТ Р 34.12-2015)', block: 8 },
  { value: 'magma-legacy', en: 'Magma (GOST 28147-89)', ru: 'Магма (ГОСТ 28147-89)', block: 8 },
];

const MODES: Array<{ value: GostMode; en: string; ru: string }> = [
  { value: 'ecb', en: 'ECB (простая замена)', ru: 'ECB (простая замена)' },
  { value: 'cbc', en: 'CBC (с зацеплением)', ru: 'CBC (с зацеплением)' },
  { value: 'cfb', en: 'CFB (гаммирование с ОС)', ru: 'CFB (гаммирование с ОС)' },
  { value: 'ctr', en: 'CTR (гаммирование)', ru: 'CTR (гаммирование)' },
  { value: 'ctr-acpkm', en: 'CTR-ACPKM', ru: 'CTR-ACPKM' },
  { value: 'ofb', en: 'OFB (гаммирование по выходу)', ru: 'OFB (гаммирование по выходу)' },
  { value: 'mac', en: 'MAC (имитовставка)', ru: 'MAC (имитовставка)' },
  { value: 'omac-acpkm', en: 'OMAC-ACPKM', ru: 'OMAC-ACPKM' },
  { value: 'mgm', en: 'MGM (AEAD)', ru: 'MGM (AEAD)' },
  { value: 'kexp15', en: 'KExp15 (обёртка ключа)', ru: 'KExp15 (обёртка ключа)' },
  { value: 'kwp', en: 'KWP 28147-89 (обёртка ключа)', ru: 'KWP 28147-89 (обёртка ключа)' },
];

function modeInfo(mode: GostMode, blockSize: number): ModeInfo {
  switch (mode) {
    case 'ecb':
      return { iv: 0, kind: 'block' };
    case 'cbc':
    case 'cfb':
    case 'ofb':
      return { iv: blockSize, kind: 'block' };
    case 'ctr':
    case 'ctr-acpkm':
      return { iv: blockSize / 2, kind: 'stream' };
    case 'mac':
    case 'omac-acpkm':
      return { iv: 0, kind: 'mac' };
    case 'mgm':
      return { iv: 16, kind: 'aead', tag: 16 };
    case 'kexp15':
      return { iv: blockSize / 2, kind: 'wrap' };
    case 'kwp':
      return { iv: 8, kind: 'wrap' };
    default:
      return { iv: 0, kind: 'block' };
  }
}

function encodingOptions(ctx: { pick: (en: string, ru: string) => string }) {
  return [
    { value: 'utf8', label: ctx.pick('Text', 'Текст') },
    { value: 'hex', label: 'Hex' },
    { value: 'base64', label: 'Base64' },
  ];
}

function gostCipherTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'crypto-gost-cipher',
    group: 'crypto',
    icon: '<path d="M12 3l7 4v5c0 4 -3 7 -7 9c-4 -2 -7 -5 -7 -9v-5z"/><path d="M9 12l2 2l4 -4"/>',
    name: { en: 'GOST Encryption', ru: 'ГОСТ: шифрование' },
    desc: {
      en: 'Kuznyechik, Magma and GOST 28147-89 in ECB, CBC, CFB, CTR, CTR-ACPKM, OFB, MAC, OMAC-ACPKM, MGM and key wrap modes.',
      ru: 'Кузнечик, Магма и ГОСТ 28147-89 в режимах ECB, CBC, CFB, CTR, CTR-ACPKM, OFB, MAC, OMAC-ACPKM, MGM и обёртки ключа.',
    },
    keywords: 'гост gost kuznyechik кузнечик magma магма 28147 34.12 mgm acpkm имитовставка',
    mount(root, ctx) {
      let kind: GostKind = 'kuznyechik';
      let mode: GostMode = 'cbc';
      let encrypt = true;
      let inputEncoding: DataEncoding = 'utf8';
      let outputEncoding: DataEncoding = 'hex';
      let cryptoPro = false;
      let padding = true;

      const kindSelect = select(
        KINDS.map((item) => ({ value: item.value, label: ctx.pick(item.en, item.ru) })),
        kind,
        (value) => {
          kind = value as GostKind;
          refresh();
        },
      );
      const modeSelect = select(
        MODES.map((item) => ({ value: item.value, label: ctx.pick(item.en, item.ru) })),
        mode,
        (value) => {
          mode = value as GostMode;
          refresh();
        },
      );
      const modeHost = h('div', { class: 'dt-inline-options' });
      const kindHost = h('div', { class: 'dt-inline-options' });
      kindHost.append(field(ctx.pick('Cipher', 'Шифр'), kindSelect));
      modeHost.append(field(ctx.pick('Mode', 'Режим'), modeSelect));

      const keyInput = textInput({ class: 'dt-mono' });
      const ivInput = textInput({ class: 'dt-mono' });
      const aadInput = textInput({ class: 'dt-mono', placeholder: ctx.pick('hex AAD (MGM only)', 'hex AAD (только MGM)') });
      const sboxSelect = select(
        Object.keys(magmaSboxes).map((name) => ({ value: name, label: name })),
        'TC26_GOST_28147_PARAM_Z',
      );
      const sboxField = field(ctx.pick('S-box', 'S-блок'), sboxSelect);
      const cryptoProToggle = checkbox(ctx.pick('CryptoPro key derivation', 'Ключевая производная CryptoPro'), cryptoPro, (value) => {
        cryptoPro = value;
      });
      const cryptoProRow = h('div', { class: 'dt-inline-actions' }, cryptoProToggle);
      const paddingToggle = checkbox(ctx.pick('PKCS#7 padding', 'PKCS#7-паддинг'), padding, (value) => {
        padding = value;
      });
      const paddingRow = h('div', { class: 'dt-inline-actions' }, paddingToggle);
      const ivField = field('IV / синхропосылка', ivInput);
      const aadField = field('AAD (hex)', aadInput);
      const keyHint = h('div', { class: 'dt-hint' });

      const inputLabel = h('span', { class: 'dt-label' }, ctx.pick('Input', 'Вход'));
      const inputArea = area({ rows: 9 });
      const outputArea = area({ rows: 9, readOnly: true });
      const info = h('div');
      const error = errorSlot();
      const runLabel = h('span', { class: 'dt-btn-label' }, 'Encrypt');
      const runButton = h('button', { class: 'dt-btn dt-btn-primary', type: 'button' }, runLabel);

      const inputEncodingSelect = select(encodingOptions(ctx), inputEncoding, (value) => {
        inputEncoding = value as DataEncoding;
      });
      const outputEncodingSelect = select(encodingOptions(ctx), outputEncoding, (value) => {
        outputEncoding = value as DataEncoding;
      });

      const blockSize = () => KINDS.find((item) => item.value === kind)?.block ?? 16;
      const sbox = () => magmaSboxes[sboxSelect.value as keyof typeof magmaSboxes];

      const refresh = () => {
        const infoMode = modeInfo(mode, blockSize());
        ivField.hidden = infoMode.iv === 0;
        aadField.hidden = infoMode.kind !== 'aead';
        sboxField.hidden = kind !== 'magma-legacy';
        cryptoProRow.hidden = mode !== 'kwp';
        paddingRow.hidden = mode !== 'ecb' && mode !== 'cbc';
        keyHint.textContent = mode === 'kwp'
          ? ctx.pick('KEK: hex, 32 bytes', 'КЕК: hex, 32 байта')
          : ctx.pick('Key: hex, 32 bytes', 'Ключ: hex, 32 байта');
        if (hexToBytesSafe(keyInput.value).length !== 32) keyInput.value = bytesToHex(randomBytes(32));
        if (infoMode.iv && hexToBytesSafe(ivInput.value).length !== infoMode.iv) ivInput.value = bytesToHex(mgmSafeNonce(randomBytes(infoMode.iv), mode));
        if (!infoMode.iv) ivInput.value = '';
        runLabel.textContent = infoMode.kind === 'mac'
          ? ctx.pick('Compute MAC', 'Вычислить MAC')
          : encrypt
            ? ctx.pick('Encrypt', 'Зашифровать')
            : ctx.pick('Decrypt', 'Расшифровать');
        inputLabel.textContent = infoMode.kind === 'mac'
          ? ctx.pick('Message', 'Сообщение')
          : infoMode.kind === 'wrap'
            ? ctx.pick('Key material (hex, 32 bytes for Kuznyechik)', 'Ключевой материал (hex, 32 байта для Кузнечика)')
            : encrypt
              ? ctx.pick('Plaintext', 'Открытый текст')
              : ctx.pick('Ciphertext', 'Шифртекст');
      };

      const hexToBytesSafe = (value: string): Uint8Array => {
        try {
          return hexToBytes(value);
        } catch {
          return new Uint8Array(0);
        }
      };

      const createCipher = (key: Uint8Array): Cipher => {
        if (kind === 'kuznyechik') return new Kuznyechik(key);
        if (kind === 'magma') return new Magma(key);
        return new MagmaLegacy(key, sbox());
      };

      const run = async () => {
        setError(error, null);
        outputArea.value = '';
        try {
          const keyBytes = hexToBytes(keyInput.value);
          const iv = modeInfo(mode, blockSize()).iv ? mgmSafeNonce(hexToBytes(ivInput.value), mode) : new Uint8Array(0);
          const raw = decodeData(inputArea.value, inputEncoding);
          const blockAligned = (mode === 'ecb' || mode === 'cbc') && padding;
          const data = blockAligned && encrypt ? pkcs7Pad(raw, blockSize()) : raw;
          let output: Uint8Array;
          let label = spec_label(mode, ctx.pick);

          if (mode === 'kwp') {
            const wrapper = kwp(keyBytes, cryptoPro, sbox());
            output = encrypt ? wrapper.wrap(iv, data) : wrapper.unwrap(data);
          } else {
            const cipher = createCipher(keyBytes);
            const aad = aadInput.value.trim() ? hexToBytes(aadInput.value) : new Uint8Array(0);
            switch (mode) {
              case 'ecb':
                output = encrypt ? ecb(cipher).encrypt(data) : ecb(cipher).decrypt(data);
                break;
              case 'cbc':
                output = encrypt ? cbc(cipher, iv).encrypt(data) : cbc(cipher, iv).decrypt(data);
                break;
              case 'cfb':
                output = encrypt ? cfb(cipher, iv).encrypt(data) : cfb(cipher, iv).decrypt(data);
                break;
              case 'ofb':
                output = ofb(cipher, iv).crypt(data);
                break;
              case 'ctr':
                output = ctr(cipher, iv).crypt(data);
                break;
              case 'ctr-acpkm':
                output = ctr(cipher, iv, true).crypt(data);
                break;
              case 'mac':
                output = mac(cipher).compute(data);
                label = 'MAC';
                break;
              case 'omac-acpkm':
                output = omac_acpkm(cipher).compute(data);
                label = 'OMAC-ACPKM';
                break;
              case 'mgm': {
                const aead = mgm(cipher, iv, 16);
                output = encrypt ? aead.seal(data, aad) : aead.open(data, aad);
                label = encrypt ? 'MGM (ciphertext ‖ tag)' : 'MGM (plaintext)';
                break;
              }
              case 'kexp15': {
                const wrapper = kexp15(cipher, cipher, iv);
                output = encrypt ? wrapper.wrap(data) : wrapper.unwrap(data);
                break;
              }
              default:
                throw new Error('Unsupported mode');
            }
          }

          if (blockAligned && !encrypt) output = pkcs7Unpad(output, blockSize());

          outputArea.value = encodeData(output, outputEncoding);
          info.replaceChildren(
            stats([
              [ctx.pick('Cipher', 'Шифр'), KINDS.find((item) => item.value === kind) ? ctx.pick(KINDS.find((item) => item.value === kind)!.en, KINDS.find((item) => item.value === kind)!.ru) : kind],
              [ctx.pick('Result', 'Результат'), label],
              [ctx.pick('Input', 'Вход'), formatBytesAsText(data.length)],
              [ctx.pick('Output', 'Выход'), formatBytesAsText(output.length)],
              ['IV', iv.length ? `${iv.length} B` : '—'],
            ]),
          );
        } catch (cause) {
          setError(error, cause instanceof Error ? cause.message : String(cause));
          info.replaceChildren();
        }
      };

      runButton.addEventListener('click', () => void run());

      const modeSegment = segmented(
        [
          { value: 'encrypt', label: ctx.pick('Encrypt', 'Зашифровать') },
          { value: 'decrypt', label: ctx.pick('Decrypt', 'Расшифровать') },
        ],
        'encrypt',
        (value) => {
          encrypt = value === 'encrypt';
          refresh();
        },
      );

      const useOutput = () => {
        inputArea.value = outputArea.value;
        inputEncoding = outputEncoding;
        inputEncodingSelect.value = outputEncoding;
        const segmentButtons = modeSegment.querySelectorAll<HTMLButtonElement>('.dt-segment');
        for (const button of segmentButtons) {
          const active = button.dataset.value === 'decrypt';
          button.classList.toggle('is-active', active);
          button.setAttribute('aria-checked', String(active));
        }
        encrypt = false;
        refresh();
      };

      refresh();

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          toolbar(
            modeSegment,
            kindHost,
            modeHost,
            sboxField,
            cryptoProRow,
            paddingRow,
          ),
          h(
            'div',
            { class: 'dt-inline-form' },
            h('div', { class: 'dt-field dt-grow' }, h('span', { class: 'dt-label' }, ctx.pick('Key (hex)', 'Ключ (hex)')), keyInput, keyHint),
            btn(ctx.pick('Random key', 'Случайный ключ'), () => {
              keyInput.value = bytesToHex(randomBytes(32));
            }),
            ivField,
            btn(ctx.pick('Random IV', 'Случайный IV'), () => {
              const size = modeInfo(mode, blockSize()).iv;
              if (size) ivInput.value = bytesToHex(mgmSafeNonce(randomBytes(size), mode));
            }),
            aadField,
          ),
          h(
            'div',
            { class: 'dt-inline-form' },
            field(ctx.pick('Input is', 'Вход'), inputEncodingSelect),
            field(ctx.pick('Output is', 'Выход'), outputEncodingSelect),
          ),
          error,
          split(
            pane(ctx.pick('Input', 'Вход'), h('div', { class: 'dt-stack' }, inputLabel, inputArea), [copyBtn(() => inputArea.value)]),
            pane(ctx.pick('Output', 'Результат'), outputArea, [
              copyBtn(() => outputArea.value),
              btn(ctx.pick('Use as input', 'Вставить во вход'), useOutput, { variant: 'subtle' }),
            ]),
          ),
          toolbar(runButton),
          info,
          note(ctx.pick('Pure TypeScript implementation from @li0ard/gost. Everything is computed locally, no network access.', 'Чистая TypeScript-реализация из @li0ard/gost. Все вычисления локальные, без сетевых запросов.'), 'info'),
        ),
      );
    },
  });
}

function spec_label(mode: GostMode, pick: (en: string, ru: string) => string): string {
  const item = MODES.find((entry) => entry.value === mode);
  return item ? pick(item.en, item.ru) : mode;
}

/** RFC 9058 MGM requires the most significant bit of the nonce to be zero. */
function mgmSafeNonce(iv: Uint8Array, mode: GostMode): Uint8Array {
  if (mode !== 'mgm' || !iv.length) return iv;
  const copy = new Uint8Array(iv);
  copy[0] &= 0x7f;
  return copy;
}

function gostHashTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'crypto-gost-hash',
    group: 'crypto',
    icon: '<path d="M4 12h4l2 -7l4 14l2 -7h4"/>',
    name: { en: 'GOST Hashes & Signatures', ru: 'ГОСТ: хеши и ЭЦП' },
    desc: {
      en: 'Streebog-256/512, GOST R 34.11-94, HMAC, PBKDF2, KDF and GOST R 34.10-2012 signatures with VKO key agreement.',
      ru: 'Стрибог-256/512, ГОСТ Р 34.11-94, HMAC, PBKDF2, KDF и подписи ГОСТ Р 34.10-2012 с выработкой ключа VKO.',
    },
    keywords: 'стрибог streebog 34.11 34.10 эцп подпись hmac pbkdf2 vko',
    mount(root, ctx) {
      const outputEncodingSelect = () => select(encodingOptions(ctx), 'hex');
      const resultArea = () => area({ rows: 5, readOnly: true });

      // ---------- hash ----------
      const hashSelect = select(
        [
          { value: 'streebog256', label: 'Streebog-256 (ГОСТ Р 34.11-2012)' },
          { value: 'streebog512', label: 'Streebog-512 (ГОСТ Р 34.11-2012)' },
          { value: 'gost341194', label: 'ГОСТ Р 34.11-94' },
        ],
        'streebog256',
      );
      const hashInput = area({ rows: 8 });
      const hashOutput = resultArea();
      const hashError = errorSlot();
      const hashInfo = h('div');
      const hashEncoding = outputEncodingSelect();

      const computeHash = () => {
        setError(hashError, null);
        try {
          const bytes = new TextEncoder().encode(hashInput.value);
          const digest = hashSelect.value === 'streebog512' ? streebog512(bytes) : hashSelect.value === 'gost341194' ? gost341194(bytes) : streebog256(bytes);
          hashOutput.value = encodeData(digest, hashEncoding.value as DataEncoding);
          hashInfo.replaceChildren(stats([['Bits', hashSelect.value === 'streebog512' ? 512 : hashSelect.value === 'gost341194' ? 256 : 256], ['Bytes', digest.length]]));
        } catch (cause) {
          setError(hashError, cause instanceof Error ? cause.message : String(cause));
        }
      };
      hashInput.addEventListener('input', computeHash);
      hashSelect.addEventListener('change', computeHash);
      hashEncoding.addEventListener('change', computeHash);
      computeHash();

      const hashTab = h(
        'div',
        { class: 'dt-stack' },
        toolbar(field(ctx.pick('Algorithm', 'Алгоритм'), hashSelect), field(ctx.pick('Output', 'Вывод'), hashEncoding)),
        hashError,
        split(pane(ctx.pick('Message', 'Сообщение'), hashInput), pane(ctx.pick('Digest', 'Хеш'), hashOutput, [copyBtn(() => hashOutput.value)])),
        hashInfo,
      );

      // ---------- hmac / pbkdf2 / kdf ----------
      const macAlgo = select(
        [
          { value: 'streebog256hmac', label: 'HMAC-Streebog-256' },
          { value: 'streebog512hmac', label: 'HMAC-Streebog-512' },
        ],
        'streebog256hmac',
      );
      const macKey = textInput({ class: 'dt-mono', placeholder: ctx.pick('hex key', 'hex-ключ') });
      const macMessage = area({ rows: 6 });
      const macOutput = resultArea();
      const macError = errorSlot();
      const computeMac = () => {
        setError(macError, null);
        try {
          const key = hexToBytes(macKey.value);
          const message = new TextEncoder().encode(macMessage.value);
          const tag = macAlgo.value === 'streebog512hmac' ? streebog512hmac(key, message) : streebog256hmac(key, message);
          macOutput.value = bytesToHex(tag);
        } catch (cause) {
          setError(macError, cause instanceof Error ? cause.message : String(cause));
        }
      };
      macKey.addEventListener('input', computeMac);
      macMessage.addEventListener('input', computeMac);
      macAlgo.addEventListener('change', computeMac);

      const kdfHash = select(
        [
          { value: 'streebog256', label: 'Streebog-256' },
          { value: 'streebog512', label: 'Streebog-512' },
          { value: 'gost341194', label: 'ГОСТ Р 34.11-94' },
        ],
        'streebog256',
      );
      const kdfPassword = textInput({ type: 'password', placeholder: ctx.pick('password', 'пароль') });
      const kdfSalt = textInput({ class: 'dt-mono', placeholder: ctx.pick('salt (text)', 'соль (текст)') });
      const kdfIterations = textInput({ type: 'number', value: '4096', min: 1, max: 1_000_000 });
      const kdfLength = textInput({ type: 'number', value: '32', min: 1, max: 256 });
      const kdfOutput = resultArea();
      const kdfError = errorSlot();
      const derive = () => {
        setError(kdfError, null);
        try {
          const iterations = Math.max(1, Math.min(1_000_000, Number(kdfIterations.value) || 4096));
          const length = Math.max(1, Math.min(256, Number(kdfLength.value) || 32));
          const password = kdfPassword.value;
          const salt = kdfSalt.value;
          const key = kdfHash.value === 'streebog512'
            ? streebog512pbkdf2(password, salt, iterations, length)
            : kdfHash.value === 'gost341194'
              ? gost341194pbkdf2(password, salt, iterations, length)
              : streebog256pbkdf2(password, salt, iterations, length);
          kdfOutput.value = bytesToHex(key);
        } catch (cause) {
          setError(kdfError, cause instanceof Error ? cause.message : String(cause));
        }
      };
      for (const element of [kdfPassword, kdfSalt, kdfIterations, kdfLength]) element.addEventListener('input', derive);
      kdfHash.addEventListener('change', derive);

      const kdfKind = segmented(
        [
          { value: 'pbkdf2', label: 'PBKDF2' },
          { value: 'kdf', label: 'KDF 2012' },
          { value: 'cpkdf', label: 'CPKDF' },
        ],
        'pbkdf2',
        (value) => {
          kdfMode = value as 'pbkdf2' | 'kdf' | 'cpkdf';
          kdfExtra.hidden = kdfMode !== 'kdf';
          derive();
        },
      );
      let kdfMode: 'pbkdf2' | 'kdf' | 'cpkdf' = 'pbkdf2';
      const kdfLabel = textInput({ class: 'dt-mono', placeholder: ctx.pick('label (hex or text)', 'метка (hex или текст)') });
      const kdfSeed = textInput({ class: 'dt-mono', placeholder: ctx.pick('seed (hex or text)', 'seed (hex или текст)') });
      const kdfExtra = h('div', { class: 'dt-inline-form' }, field('Label', kdfLabel), field('Seed', kdfSeed));
      kdfExtra.hidden = true;
      const runKdf = () => {
        try {
          const password = kdfPassword.value;
          const salt = kdfSalt.value;
          const output = kdfMode === 'cpkdf'
            ? cpkdf(password, salt)
            : kdfMode === 'kdf'
              ? kdf_gostr3411_2012_256(new TextEncoder().encode(password), new TextEncoder().encode(kdfLabel.value), new TextEncoder().encode(kdfSeed.value))
              : null;
          if (output) kdfOutput.value = bytesToHex(output);
          else derive();
        } catch (cause) {
          setError(kdfError, cause instanceof Error ? cause.message : String(cause));
        }
      };
      kdfKind.addEventListener('click', runKdf);

      const deriveTab = h(
        'div',
        { class: 'dt-stack' },
        toolbar(kdfKind),
        h(
          'div',
          { class: 'dt-inline-form' },
          field(ctx.pick('Hash', 'Хеш'), kdfHash),
          field(ctx.pick('Password', 'Пароль'), kdfPassword),
          field(ctx.pick('Salt', 'Соль'), kdfSalt),
          field(ctx.pick('Iterations', 'Итерации'), kdfIterations),
          field(ctx.pick('Length', 'Длина'), kdfLength),
        ),
        kdfExtra,
        kdfError,
        pane('Derived key', kdfOutput, [copyBtn(() => kdfOutput.value)]),
        toolbar(btn(ctx.pick('Derive', 'Вычислить'), runKdf, { variant: 'primary' })),
        h(
          'div',
          { class: 'dt-stack' },
          pane('HMAC', h('div', { class: 'dt-stack' }, toolbar(field(ctx.pick('Algorithm', 'Алгоритм'), macAlgo)), field(ctx.pick('Key (hex)', 'Ключ (hex)'), macKey), macMessage), [copyBtn(() => macOutput.value)]),
          macOutput,
          macError,
        ),
      );

      // ---------- signature ----------
      const curveKeys = Object.keys(CURVES) as Array<keyof typeof CURVES>;
      const curveSelect = select(curveKeys.map((name) => ({ value: name, label: name })), 'gost256A');
      const secretInput = textInput({ class: 'dt-mono', placeholder: ctx.pick('private key (hex)', 'закрытый ключ (hex)') });
      const publicInput = textInput({ class: 'dt-mono', placeholder: ctx.pick('public key (hex)', 'открытый ключ (hex)') });
      const signMessage = area({ rows: 6, value: 'hello' });
      const signatureOutput = resultArea();
      const verifyResult = h('div');
      const signError = errorSlot();
      const ukmInput = textInput({ class: 'dt-mono', value: '0102030405060708' });
      const sharedOutput = textInput({ class: 'dt-mono', readOnly: true });

      const curve = () => CURVES[curveSelect.value as keyof typeof CURVES];
      const hashForCurve = () => (curveSelect.value.includes('512') ? streebog512 : streebog256);

      const generate = () => {
        setError(signError, null);
        try {
          const pair = curve().keygen();
          secretInput.value = bytesToHex(pair.secretKey);
          publicInput.value = bytesToHex(pair.publicKey);
          verifyResult.replaceChildren();
        } catch (cause) {
          setError(signError, cause instanceof Error ? cause.message : String(cause));
        }
      };

      const sign = () => {
        setError(signError, null);
        try {
          const digest = hashForCurve()(new TextEncoder().encode(signMessage.value));
          const signature = curve().sign(hexToBytes(secretInput.value), digest);
          signatureOutput.value = bytesToHex(signature);
          verifyResult.replaceChildren(badge(ctx.pick('Signed', 'Подписано'), 'ok'));
        } catch (cause) {
          setError(signError, cause instanceof Error ? cause.message : String(cause));
        }
      };

      const verify = () => {
        setError(signError, null);
        try {
          const digest = hashForCurve()(new TextEncoder().encode(signMessage.value));
          const ok = curve().verify(hexToBytes(publicInput.value), digest, hexToBytes(signatureOutput.value));
          verifyResult.replaceChildren(badge(ok ? ctx.pick('Signature is valid', 'Подпись верна') : ctx.pick('Signature is invalid', 'Подпись неверна'), ok ? 'ok' : 'bad'));
        } catch (cause) {
          setError(signError, cause instanceof Error ? cause.message : String(cause));
        }
      };

      const computeShared = () => {
        setError(signError, null);
        try {
          const shared = curve().getSharedSecret(hashForCurve(), hexToBytes(secretInput.value), hexToBytes(publicInput.value), hexToBytes(ukmInput.value));
          sharedOutput.value = bytesToHex(shared);
        } catch (cause) {
          setError(signError, cause instanceof Error ? cause.message : String(cause));
        }
      };

      const signTab = h(
        'div',
        { class: 'dt-stack' },
        h('div', { class: 'dt-inline-form' }, field(ctx.pick('Curve', 'Кривая'), curveSelect), btn(ctx.pick('Generate key pair', 'Сгенерировать пару'), generate)),
        h('div', { class: 'dt-inline-form' }, field(ctx.pick('Private key (hex)', 'Закрытый ключ (hex)'), secretInput), field(ctx.pick('Public key (hex)', 'Открытый ключ (hex)'), publicInput)),
        pane(ctx.pick('Message', 'Сообщение'), signMessage),
        toolbar(
          btn(ctx.pick('Sign with Streebog', 'Подписать по Стрибогу'), sign, { variant: 'primary' }),
          btn(ctx.pick('Verify', 'Проверить'), verify),
          copyBtn(() => signatureOutput.value),
        ),
        signError,
        pane(ctx.pick('Signature (r‖s, hex)', 'Подпись (r‖s, hex)'), signatureOutput),
        verifyResult,
        pane(
          ctx.pick('VKO key agreement', 'Выработка ключа VKO'),
          h('div', { class: 'dt-stack' }, field('UKM', ukmInput), toolbar(btn(ctx.pick('Compute shared secret', 'Вычислить общий секрет'), computeShared))),
        ),
        h('div', { class: 'dt-inline-form' }, field(ctx.pick('Shared secret', 'Общий секрет'), sharedOutput), copyBtn(() => sharedOutput.value)),
        note(ctx.pick('Signature is computed over Streebog-256/512 of the message, matching GOST R 34.10-2012.', 'Подпись считается по Стрибог-256/512 от сообщения, как в ГОСТ Р 34.10-2012.'), 'info'),
      );

      root.append(
        tabs([
          { id: 'hash', label: ctx.pick('Hash', 'Хеш'), render: () => hashTab },
          { id: 'derive', label: 'HMAC / KDF', render: () => deriveTab },
          { id: 'sign', label: ctx.pick('Signatures', 'Подписи'), render: () => signTab },
        ]),
      );
    },
  });
}

export const gostTools = [gostCipherTool(), gostHashTool()];
