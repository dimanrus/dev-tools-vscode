/** Symmetric encryption: AES (all variants), ChaCha20, Camellia, ARIA, SM4. */
import {
  area,
  badge,
  btn,
  checkbox,
  copyBtn,
  downloadBlob,
  errorSlot,
  field,
  note,
  pane,
  select,
  setError,
  split,
  stats,
  textInput,
  toolbar,
  segmented,
} from '../components.ts';
import { h } from '../dom.ts';
import { defineTool } from '../tool-types.ts';
import { formatBytesAsText } from '../lib/bytes.ts';
import { bytesToHex, decodeData, encodeData, hexToBytes, randomBytes, type DataEncoding } from '../lib/crypto/codec.ts';
import { findSpec, runSymmetric, specsForFamily, type CipherFamily, type SymmetricSpec } from '../lib/crypto/symmetric.ts';

const INPUT_ENCODINGS: Array<{ value: DataEncoding; label: [string, string] }> = [
  { value: 'utf8', label: ['Text', 'Текст'] },
  { value: 'hex', label: ['Hex', 'Hex'] },
  { value: 'base64', label: ['Base64', 'Base64'] },
];

function symmetricTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'crypto-symmetric',
    group: 'crypto',
    icon: '<path d="M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2z"/><path d="M8 11v-4a4 4 0 1 1 8 0v4"/><path d="M12 15v2"/>',
    name: { en: 'Symmetric Encryption', ru: 'Симметричное шифрование' },
    desc: {
      en: 'Encrypt and decrypt with AES-128/192/256 (ECB, CBC, CTR, CFB, OFB, GCM, CCM, OCB, SIV, GCM-SIV, KW, XTS), ChaCha20, Camellia, ARIA and SM4.',
      ru: 'Шифрование и расшифровка: AES-128/192/256 (ECB, CBC, CTR, CFB, OFB, GCM, CCM, OCB, SIV, GCM-SIV, KW, XTS), ChaCha20, Camellia, ARIA и SM4.',
    },
    keywords: 'aes aes-128 aes-192 aes-256 gcm cbc ctr cfb ofb ccm ocb siv xts chacha20 poly1305 camellia aria sm4 encrypt decrypt',
    mount(root, ctx) {
      let family: CipherFamily = 'aes';
      let spec: SymmetricSpec = findSpec('aes-256-gcm');
      let encrypt = true;
      let padding = true;
      let inputEncoding: DataEncoding = 'utf8';
      let outputEncoding: DataEncoding = 'hex';
      let sourceFile: { name: string; bytes: Uint8Array } | null = null;
      let lastResult: Uint8Array = new Uint8Array(0);

      const familySelect = select(
        [
          { value: 'aes', label: 'AES' },
          { value: 'chacha', label: 'ChaCha20' },
          { value: 'camellia', label: 'Camellia' },
          { value: 'aria', label: 'ARIA' },
          { value: 'sm4', label: 'SM4' },
        ],
        family,
        (value) => {
          family = value as CipherFamily;
          rebuildModes();
        },
      );

      const modeHost = h('div', { class: 'dt-inline-options' });
      const algorithmHint = h('div', { class: 'dt-hint' });

      const keyInput = textInput({ class: 'dt-mono', placeholder: 'hex key' });
      const keyHint = h('div', { class: 'dt-hint' });
      const ivInput = textInput({ class: 'dt-mono', placeholder: 'hex IV / nonce' });
      const ivHint = h('div', { class: 'dt-hint' });
      const aadInput = textInput({ class: 'dt-mono', placeholder: 'hex AAD (optional)' });
      const counterInput = textInput({ type: 'number', value: '1', min: 0, max: 0xffffffff, class: 'dt-mono' });
      const counterField = field('Counter', counterInput, ctx.pick('ChaCha20 block counter', 'Счётчик блоков ChaCha20'));
      const paddingToggle = checkbox(ctx.pick('PKCS#7 padding', 'PKCS#7-паддинг'), padding, (value) => {
        padding = value;
      });
      const paddingRow = h('div', { class: 'dt-inline-actions' }, paddingToggle);

      const inputArea = area({ rows: 9, placeholder: ctx.pick('Text, hex or base64 — depending on the input encoding', 'Текст, hex или base64 — в зависимости от кодировки входа') });
      const outputArea = area({ rows: 9, readOnly: true });
      const tagInput = textInput({ class: 'dt-mono', placeholder: 'hex tag' });
      const tagOutput = textInput({ class: 'dt-mono', readOnly: true, placeholder: '—' });
      const tagRow = h('div', { class: 'dt-stack' }, field(ctx.pick('Auth tag (hex)', 'Тег аутентификации (hex)'), tagOutput));

      const info = h('div');
      const error = errorSlot();
      const fileInput = h('input', { type: 'file', class: 'dt-hidden' });
      const fileState = h('div', { class: 'dt-inline-actions' });
      const runLabel = h('span', { class: 'dt-btn-label' }, 'Encrypt');
      const runButton = h('button', { class: 'dt-btn dt-btn-primary', type: 'button' }, runLabel);
      const ivRandomButton = btn(ctx.pick('Random IV', 'Случайный IV'), () => {
        if (spec.ivSize) ivInput.value = bytesToHex(randomBytes(spec.ivSize));
      });
      const aadField = field(ctx.pick('AAD (hex)', 'AAD (hex)'), aadInput);
      const tagVerifyField = field(ctx.pick('Tag to verify (hex)', 'Тег для проверки (hex)'), tagInput);

      const inputEncodingSelect = select(
        INPUT_ENCODINGS.map((item) => ({ value: item.value, label: ctx.pick(item.label[0], item.label[1]) })),
        inputEncoding,
        (value) => {
          inputEncoding = value as DataEncoding;
        },
      );
      const outputEncodingSelect = select(
        INPUT_ENCODINGS.map((item) => ({ value: item.value, label: ctx.pick(item.label[0], item.label[1]) })),
        outputEncoding,
        (value) => {
          outputEncoding = value as DataEncoding;
        },
      );

      const syncModeLabel = () => {
        runLabel.textContent = encrypt ? ctx.pick('Encrypt', 'Зашифровать') : ctx.pick('Decrypt', 'Расшифровать');
      };

      const hexToBytesSafe = (value: string): Uint8Array => {
        try {
          return hexToBytes(value);
        } catch {
          return new Uint8Array(0);
        }
      };

      const applySpec = () => {
        keyHint.textContent = ctx.pick(
          `Key: hex, ${spec.keySizes.map((size) => `${size} B`).join(' or ')}${spec.keyMultiplier === 2 ? ' (double length for this mode)' : ''}`,
          `Ключ: hex, ${spec.keySizes.map((size) => `${size} Б`).join(' или ')}${spec.keyMultiplier === 2 ? ' (двойная длина для этого режима)' : ''}`,
        );
        ivHint.textContent = spec.ivSize
          ? ctx.pick(`IV / nonce: hex, ${spec.ivSize} B`, `IV / nonce: hex, ${spec.ivSize} Б`)
          : ctx.pick('No IV for this mode', 'В этом режиме IV не нужен');
        if (!spec.keySizes.includes(hexToBytesSafe(keyInput.value).length)) keyInput.value = bytesToHex(randomBytes(spec.keySizes[0]));
        if (spec.ivSize) {
          if (hexToBytesSafe(ivInput.value).length !== spec.ivSize) ivInput.value = bytesToHex(randomBytes(spec.ivSize));
        } else {
          ivInput.value = '';
        }
        paddingRow.hidden = spec.blockSize === 0 || Boolean(spec.wrap);
        counterField.hidden = spec.family !== 'chacha' || !['chacha20', 'xchacha20'].includes(spec.mode);
        ivRandomButton.disabled = spec.ivSize === 0;
        aadField.hidden = spec.tagSize === 0;
        tagVerifyField.hidden = spec.tagSize === 0;
        tagRow.hidden = spec.tagSize === 0;
        const hostNote = spec.engine === 'host'
          ? ctx.pick('This mode runs in the VS Code extension host (OpenSSL).', 'Этот режим выполняется в хосте расширения (OpenSSL).')
          : '';
        const safetyNote = spec.note ? ctx.pick(spec.note, spec.note) : '';
        algorithmHint.textContent = [hostNote, safetyNote].filter(Boolean).join(' ');
        algorithmHint.hidden = !algorithmHint.textContent;
      };

      const rebuildModes = () => {
        const specs = specsForFamily(family);
        const preferred = specs.find((item) => item.id === 'aes-256-gcm')
          ?? specs.find((item) => item.mode === 'gcm')
          ?? specs.find((item) => item.mode === 'cbc')
          ?? specs[0];
        spec = preferred;
        const modeSelect = select(
          specs.map((item) => ({ value: item.id, label: item.label })),
          spec.id,
          (value) => {
            spec = findSpec(value);
            applySpec();
          },
        );
        modeHost.replaceChildren(field(ctx.pick('Algorithm', 'Алгоритм'), modeSelect));
        applySpec();
      };

      rebuildModes();
      syncModeLabel();
      const run = async () => {
        setError(error, null);
        outputArea.value = '';
        tagOutput.value = '';
        try {
          const key = hexToBytes(keyInput.value);
          const iv = spec.ivSize ? hexToBytes(ivInput.value) : new Uint8Array(0);
          const aad = spec.tagSize ? decodeData(aadInput.value.trim(), 'hex') : new Uint8Array(0);
          const data = sourceFile ? sourceFile.bytes : decodeData(inputArea.value, inputEncoding);
          const result = await runSymmetric(ctx.rpc, spec, {
            encrypt,
            key,
            iv,
            aad,
            data,
            tag: hexToBytes(tagInput.value),
            padding,
            counter: Number(counterInput.value) || 1,
          });
          lastResult = result.data;
          outputArea.value = encodeData(result.data, outputEncoding);
          if (result.tag.length) {
            const hex = bytesToHex(result.tag);
            tagOutput.value = hex;
            tagInput.value = hex;
          }
          info.replaceChildren(
            stats([
              [ctx.pick('Algorithm', 'Алгоритм'), spec.label],
              [ctx.pick('Key', 'Ключ'), `${key.length} B`],
              [ctx.pick('IV / nonce', 'IV / nonce'), spec.ivSize ? `${iv.length} B` : '—'],
              [ctx.pick('Input', 'Вход'), formatBytesAsText(data.length)],
              [ctx.pick('Output', 'Выход'), formatBytesAsText(result.data.length)],
              [ctx.pick('Tag', 'Тег'), result.tag.length ? `${result.tag.length} B` : '—'],
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
          syncModeLabel();
        },
      );

      const useOutput = () => {
        inputArea.value = outputArea.value;
        inputEncoding = outputEncoding;
        inputEncodingSelect.value = outputEncoding;
        encrypt = false;
        syncModeLabel();
        const segmentButtons = modeSegment.querySelectorAll<HTMLButtonElement>('.dt-segment');
        for (const button of segmentButtons) {
          const active = button.dataset.value === 'decrypt';
          button.classList.toggle('is-active', active);
          button.setAttribute('aria-checked', String(active));
        }
        sourceFile = null;
        fileState.replaceChildren();
      };

      fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        const bytes = new Uint8Array(await file.arrayBuffer());
        sourceFile = { name: file.name, bytes };
        inputArea.value = '';
        fileState.replaceChildren(
          badge(`${file.name} · ${formatBytesAsText(bytes.length)}`, 'neutral'),
          btn(ctx.pick('Clear file', 'Сбросить файл'), () => {
            sourceFile = null;
            fileState.replaceChildren();
          }, { variant: 'subtle' }),
        );
        fileInput.value = '';
        setError(error, null);
      });

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          toolbar(
            modeSegment,
            field(ctx.pick('Family', 'Семейство'), familySelect),
            modeHost,
            paddingRow,
            field(ctx.pick('Input is', 'Вход'), inputEncodingSelect),
            field(ctx.pick('Output is', 'Выход'), outputEncodingSelect),
          ),
          algorithmHint,
          h(
            'div',
            { class: 'dt-inline-form' },
            h('div', { class: 'dt-field dt-grow' }, h('span', { class: 'dt-label' }, ctx.pick('Key (hex)', 'Ключ (hex)')), keyInput, keyHint),
            btn(ctx.pick('Random key', 'Случайный ключ'), () => {
              keyInput.value = bytesToHex(randomBytes(spec.keySizes[0]));
            }),
            h('div', { class: 'dt-field dt-grow' }, h('span', { class: 'dt-label' }, 'IV / nonce'), ivInput, ivHint),
            ivRandomButton,
            counterField,
          ),
          h(
            'div',
            { class: 'dt-inline-form' },
            aadField,
            tagVerifyField,
          ),
          error,
          split(
            pane(ctx.pick('Input', 'Вход'), h('div', { class: 'dt-stack' }, inputArea, fileState), [
              btn(ctx.pick('Load file', 'Загрузить файл'), () => fileInput.click()),
              copyBtn(() => inputArea.value),
            ]),
            pane(ctx.pick('Output', 'Результат'), h('div', { class: 'dt-stack' }, outputArea, tagRow), [
              copyBtn(() => outputArea.value),
              btn(ctx.pick('Download .bin', 'Скачать .bin'), () => downloadBlob('ciphertext.bin', new Blob([lastResult as unknown as BlobPart])), { disabled: false }),
              btn(ctx.pick('Use as input', 'Вставить во вход'), useOutput, { variant: 'subtle' }),
            ]),
          ),
          toolbar(runButton),
          info,
          note(
            ctx.pick(
              'Runs locally. AES, ChaCha20 and Camellia/ARIA/SM4 use WebAssembly-free pure JavaScript; CCM, OCB, SIV, XTS, OFB, Camellia, ARIA and SM4 are computed in the extension host with OpenSSL.',
              'Всё считается локально. AES и ChaCha20 — на чистом JS в панели; CCM, OCB, SIV, XTS, OFB, Camellia, ARIA и SM4 считаются в хосте расширения через OpenSSL.',
            ),
            'info',
          ),
          fileInput,
        ),
      );
    },
  });
}

export const symmetricTools = [symmetricTool()];
