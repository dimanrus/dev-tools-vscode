/** Asymmetric encryption: RSA (OAEP / PKCS#1 v1.5), ECIES and SM2. */
import smCrypto from 'sm-crypto';
import { area, badge, btn, copyBtn, errorSlot, field, note, pane, select, setError, split, stats, tabs, textInput, toolbar, segmented } from '../components.ts';
import { h } from '../dom.ts';
import { defineTool } from '../tool-types.ts';
import { bytesToBase64, formatBytesAsText } from '../lib/bytes.ts';
import { bytesToHex, decodeData, encodeData, utf8ToBytes, type DataEncoding } from '../lib/crypto/codec.ts';
import {
  eciesDecrypt,
  eciesEncrypt,
  exportEcPem,
  exportKeyPem,
  generateEcPair,
  generateRsaKeyPair,
  importEcPrivate,
  importEcPublic,
  importRsaPrivate,
  importRsaPublic,
  modulusBits,
  rsaMaxBytes,
  bufferOf,
  toBytes,
  type RsaHash,
  type RsaScheme,
} from '../lib/crypto/webcrypto.ts';

function encodingSelect(defaultValue: DataEncoding, onChange: (value: DataEncoding) => void): HTMLSelectElement {
  return select(
    [
      { value: 'utf8', label: 'Text' },
      { value: 'hex', label: 'Hex' },
      { value: 'base64', label: 'Base64' },
    ],
    defaultValue,
    (value) => onChange(value as DataEncoding),
  );
}

function asymmetricTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'crypto-asymmetric',
    group: 'crypto',
    icon: '<path d="M12 3a4 4 0 0 1 4 4v3"/><path d="M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2z"/><path d="M8 11v-4a4 4 0 0 1 6.5 -3.1"/>',
    name: { en: 'Asymmetric Encryption', ru: 'Асимметричное шифрование' },
    desc: {
      en: 'Encrypt with RSA (OAEP, PKCS#1 v1.5), ECIES (ECDH + HKDF + AES-GCM) and SM2, with PEM key import and export.',
      ru: 'Шифрование RSA (OAEP, PKCS#1 v1.5), ECIES (ECDH + HKDF + AES-GCM) и SM2 с импортом и экспортом PEM-ключей.',
    },
    keywords: 'rsa oaep pkcs1 ecies ecdh sm2 国密 асимметричное шифрование',
    mount(root, ctx) {
      // ---------- RSA ----------
      let scheme: RsaScheme = 'RSA-OAEP';
      let inputEncoding: DataEncoding = 'utf8';
      let outputEncoding: DataEncoding = 'base64';
      const schemeSegment = segmented(
        [
          { value: 'oaep', label: 'OAEP' },
          { value: 'pkcs1', label: 'PKCS#1 v1.5' },
        ],
        'oaep',
        (value) => {
          scheme = value === 'oaep' ? 'RSA-OAEP' : 'RSAES-PKCS1-v1_5';
          rsaHashField.hidden = scheme !== 'RSA-OAEP';
        },
      );
      const bitsSelect = select(
        [
          { value: '2048', label: '2048 bit' },
          { value: '3072', label: '3072 bit' },
          { value: '4096', label: '4096 bit' },
        ],
        '2048',
      );
      const hashSelect = select(
        [
          { value: 'SHA-256', label: 'SHA-256' },
          { value: 'SHA-384', label: 'SHA-384' },
          { value: 'SHA-512', label: 'SHA-512' },
          { value: 'SHA-1', label: 'SHA-1' },
        ],
        'SHA-256',
      );
      const rsaHashField = field(ctx.pick('OAEP hash', 'Хеш OAEP'), hashSelect);
      const publicArea = area({ rows: 7, placeholder: '-----BEGIN PUBLIC KEY-----' });
      const privateArea = area({ rows: 7, placeholder: '-----BEGIN PRIVATE KEY-----' });
      const rsaInput = area({ rows: 7 });
      const rsaOutput = area({ rows: 7, readOnly: true });
      const rsaInfo = h('div');
      const rsaError = errorSlot();
      const rsaInputEncoding = encodingSelect(inputEncoding, (value) => (inputEncoding = value));
      const rsaOutputEncoding = encodingSelect(outputEncoding, (value) => (outputEncoding = value));

      const rsaGenerate = async () => {
        setError(rsaError, null);
        try {
          const pair = await generateRsaKeyPair(Number(bitsSelect.value), scheme, hashSelect.value as RsaHash);
          publicArea.value = await exportKeyPem(pair.publicKey, 'spki');
          privateArea.value = await exportKeyPem(pair.privateKey, 'pkcs8');
          rsaInfo.replaceChildren(badge(ctx.pick('Key pair generated', 'Пара ключей создана'), 'ok'));
        } catch (cause) {
          setError(rsaError, cause instanceof Error ? cause.message : String(cause));
        }
      };

      const rsaEncrypt = async () => {
        setError(rsaError, null);
        try {
          const key = await importRsaPublic(publicArea.value, scheme, hashSelect.value as RsaHash);
          const data = decodeData(rsaInput.value, inputEncoding);
          const max = rsaMaxBytes(modulusBits(key), scheme, hashSelect.value as RsaHash);
          if (data.length > max) throw new Error(`RSA can encrypt at most ${max} bytes here (got ${data.length}). Use ECIES or hybrid encryption for larger payloads.`);
          const output = toBytes(await crypto.subtle.encrypt({ name: scheme }, key, bufferOf(data)));
          rsaOutput.value = encodeData(output, outputEncoding);
          rsaInfo.replaceChildren(stats([['Limit', `${max} B`], [ctx.pick('Output', 'Выход'), formatBytesAsText(output.length)]]));
        } catch (cause) {
          setError(rsaError, cause instanceof Error ? cause.message : String(cause));
        }
      };

      const rsaDecrypt = async () => {
        setError(rsaError, null);
        try {
          const key = await importRsaPrivate(privateArea.value, scheme, hashSelect.value as RsaHash);
          const data = decodeData(rsaInput.value, inputEncoding);
          const output = toBytes(await crypto.subtle.decrypt({ name: scheme }, key, bufferOf(data)));
          rsaOutput.value = encodeData(output, outputEncoding);
          rsaInfo.replaceChildren(stats([['Output', formatBytesAsText(output.length)]]));
        } catch (cause) {
          setError(rsaError, cause instanceof Error ? cause.message : String(cause));
        }
      };

      const rsaTab = h(
        'div',
        { class: 'dt-stack' },
        toolbar(
          schemeSegment,
          field(ctx.pick('Key size', 'Размер ключа'), bitsSelect),
          rsaHashField,
          btn(ctx.pick('Generate key pair', 'Сгенерировать пару'), () => void rsaGenerate(), { variant: 'primary' }),
        ),
        rsaError,
        split(
          pane(ctx.pick('Public key (PEM)', 'Открытый ключ (PEM)'), publicArea, [copyBtn(() => publicArea.value)]),
          pane(ctx.pick('Private key (PEM)', 'Закрытый ключ (PEM)'), privateArea, [copyBtn(() => privateArea.value)]),
        ),
        h('div', { class: 'dt-inline-form' }, field(ctx.pick('Input is', 'Вход'), rsaInputEncoding), field(ctx.pick('Output is', 'Выход'), rsaOutputEncoding)),
        split(pane(ctx.pick('Message / ciphertext', 'Сообщение / шифртекст'), rsaInput), pane(ctx.pick('Result', 'Результат'), rsaOutput, [copyBtn(() => rsaOutput.value)])),
        toolbar(
          btn(ctx.pick('Encrypt with public key', 'Зашифровать открытым ключом'), () => void rsaEncrypt(), { variant: 'primary' }),
          btn(ctx.pick('Decrypt with private key', 'Расшифровать закрытым ключом'), () => void rsaDecrypt()),
        ),
        rsaInfo,
        note(ctx.pick('OAEP is the recommended padding. RSA encrypts only small blocks — use ECIES for arbitrary data.', 'Рекомендуется OAEP. RSA шифрует только небольшие блоки — для произвольных данных используйте ECIES.'), 'info'),
      );

      // ---------- ECIES ----------
      const ecPublic = area({ rows: 6, placeholder: '-----BEGIN PUBLIC KEY-----' });
      const ecPrivate = area({ rows: 6, placeholder: '-----BEGIN PRIVATE KEY-----' });
      const ecInput = area({ rows: 7 });
      const ecOutput = area({ rows: 7, readOnly: true });
      const ecError = errorSlot();
      const ecInfo = h('div');
      let ecInputEncoding: DataEncoding = 'utf8';
      let ecOutputEncoding: DataEncoding = 'base64';
      const ecInputEncodingSelect = encodingSelect(ecInputEncoding, (value) => (ecInputEncoding = value));
      const ecOutputEncodingSelect = encodingSelect(ecOutputEncoding, (value) => (ecOutputEncoding = value));

      const ecGenerate = async () => {
        setError(ecError, null);
        try {
          const pair = await generateEcPair('P-256');
          ecPublic.value = await exportEcPem(pair.publicKey, 'spki');
          ecPrivate.value = await exportEcPem(pair.privateKey, 'pkcs8');
          ecInfo.replaceChildren(badge(ctx.pick('ECDH P-256 key pair generated', 'Пара ECDH P-256 создана'), 'ok'));
        } catch (cause) {
          setError(ecError, cause instanceof Error ? cause.message : String(cause));
        }
      };

      const ecEncrypt = async () => {
        setError(ecError, null);
        try {
          const publicKey = await importEcPublic(ecPublic.value);
          const data = decodeData(ecInput.value, ecInputEncoding);
          const packed = await eciesEncrypt(publicKey, data);
          ecOutput.value = encodeData(packed, ecOutputEncoding);
          ecInfo.replaceChildren(stats([['Payload', formatBytesAsText(packed.length)], ['Overhead', '94 B']]));
        } catch (cause) {
          setError(ecError, cause instanceof Error ? cause.message : String(cause));
        }
      };

      const ecDecrypt = async () => {
        setError(ecError, null);
        try {
          const privateKey = await importEcPrivate(ecPrivate.value);
          const data = decodeData(ecInput.value, ecInputEncoding);
          const plaintext = await eciesDecrypt(privateKey, data);
          ecOutput.value = encodeData(plaintext, ecOutputEncoding);
          ecInfo.replaceChildren(stats([['Plaintext', formatBytesAsText(plaintext.length)]]));
        } catch (cause) {
          setError(ecError, cause instanceof Error ? cause.message : String(cause));
        }
      };

      const ecTab = h(
        'div',
        { class: 'dt-stack' },
        toolbar(btn(ctx.pick('Generate ECDH key pair', 'Сгенерировать пару ECDH'), () => void ecGenerate(), { variant: 'primary' })),
        ecError,
        split(
          pane(ctx.pick('Recipient public key (PEM)', 'Открытый ключ получателя (PEM)'), ecPublic, [copyBtn(() => ecPublic.value)]),
          pane(ctx.pick('Recipient private key (PEM)', 'Закрытый ключ получателя (PEM)'), ecPrivate, [copyBtn(() => ecPrivate.value)]),
        ),
        h('div', { class: 'dt-inline-form' }, field(ctx.pick('Input is', 'Вход'), ecInputEncodingSelect), field(ctx.pick('Output is', 'Выход'), ecOutputEncodingSelect)),
        split(pane(ctx.pick('Message / payload', 'Сообщение / пакет'), ecInput), pane(ctx.pick('Result', 'Результат'), ecOutput, [copyBtn(() => ecOutput.value)])),
        toolbar(
          btn(ctx.pick('Encrypt', 'Зашифровать'), () => void ecEncrypt(), { variant: 'primary' }),
          btn(ctx.pick('Decrypt', 'Расшифровать'), () => void ecDecrypt()),
        ),
        ecInfo,
        note(ctx.pick('ECIES = ephemeral ECDH P-256 + HKDF-SHA-256 + AES-256-GCM, packed as version | ephemeral key | salt | IV | ciphertext+tag.', 'ECIES = эфемерный ECDH P-256 + HKDF-SHA-256 + AES-256-GCM, пакет: версия | эфемерный ключ | соль | IV | шифртекст+тег.'), 'info'),
      );

      // ---------- SM2 ----------
      const smPublic = textInput({ class: 'dt-mono' });
      const smPrivate = textInput({ class: 'dt-mono' });
      const smInput = area({ rows: 7 });
      const smOutput = area({ rows: 7, readOnly: true });
      const smError = errorSlot();
      const smInfo = h('div');

      const smGenerate = () => {
        const pair = smCrypto.sm2.generateKeyPairHex();
        smPublic.value = pair.publicKey;
        smPrivate.value = pair.privateKey;
        smInfo.replaceChildren(badge(ctx.pick('SM2 key pair generated', 'Пара SM2 создана'), 'ok'));
        setError(smError, null);
      };

      const smEncrypt = () => {
        setError(smError, null);
        try {
          if (!smCrypto.sm2.verifyPublicKey(smPublic.value)) throw new Error('Invalid SM2 public key.');
          const ciphertext = smCrypto.sm2.doEncrypt(smInput.value, smPublic.value, 1);
          smOutput.value = ciphertext;
          smInfo.replaceChildren(stats([['Cipher', formatBytesAsText(ciphertext.length / 2)], ['Mode', 'C1C3C2']]));
        } catch (cause) {
          setError(smError, cause instanceof Error ? cause.message : String(cause));
        }
      };

      const smDecrypt = () => {
        setError(smError, null);
        try {
          smOutput.value = smCrypto.sm2.doDecrypt(smInput.value.trim(), smPrivate.value.trim(), 1);
        } catch (cause) {
          setError(smError, cause instanceof Error ? cause.message : String(cause));
        }
      };

      const smTab = h(
        'div',
        { class: 'dt-stack' },
        toolbar(btn(ctx.pick('Generate SM2 key pair', 'Сгенерировать пару SM2'), smGenerate, { variant: 'primary' })),
        h('div', { class: 'dt-inline-form' }, field(ctx.pick('Public key (hex, 04…)', 'Открытый ключ (hex, 04…)'), smPublic), field(ctx.pick('Private key (hex)', 'Закрытый ключ (hex)'), smPrivate)),
        smError,
        split(pane(ctx.pick('Message / ciphertext (text/hex)', 'Сообщение / шифртекст (текст/hex)'), smInput), pane(ctx.pick('Result', 'Результат'), smOutput, [copyBtn(() => smOutput.value)])),
        toolbar(
          btn(ctx.pick('Encrypt', 'Зашифровать'), smEncrypt, { variant: 'primary' }),
          btn(ctx.pick('Decrypt', 'Расшифровать'), smDecrypt),
        ),
        smInfo,
        note(ctx.pick('SM2 (GB/T 32918) uses C1C3C2 ordering and works with UTF-8 text; the key pair is 256-bit.', 'SM2 (GB/T 32918) использует порядок C1C3C2 и работает с UTF-8 текстом; ключ — 256 бит.'), 'info'),
      );

      root.append(
        tabs([
          { id: 'rsa', label: 'RSA', render: () => rsaTab },
          { id: 'ecies', label: 'ECIES', render: () => ecTab },
          { id: 'sm2', label: 'SM2', render: () => smTab },
        ]),
      );
    },
  });
}

export const asymmetricTools = [asymmetricTool()];
