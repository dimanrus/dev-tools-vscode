/** Signatures, key agreement and key formats (WebCrypto + @noble/curves). */
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { p256 } from '@noble/curves/nist.js';
import { x25519 } from '@noble/curves/ed25519.js';
import { sha256 as nobleSha256 } from '@noble/hashes/sha2.js';
import { area, badge, btn, copyBtn, errorSlot, field, note, pane, select, setError, split, stats, tabs, textInput, toolbar } from '../components.ts';
import { h } from '../dom.ts';
import { defineTool } from '../tool-types.ts';
import { formatBytesAsText } from '../lib/bytes.ts';
import { bytesToHex, decodeData, encodeData, hexToBytes, type DataEncoding } from '../lib/crypto/codec.ts';
import { bufferOf, exportKeyPem, sha256, toBytes, type RsaHash } from '../lib/crypto/webcrypto.ts';
import { pemBody, pemLabel } from '../lib/crypto/pem.ts';

type SignAlgo = 'ecdsa-p256' | 'ecdsa-p384' | 'ecdsa-p521' | 'ed25519' | 'rsa-pss' | 'rsa-pkcs1' | 'secp256k1';

interface AlgoInfo {
  value: SignAlgo;
  label: string;
  curve?: string;
  /** WebCrypto import/sign configuration. */
  webcrypto?: boolean;
  hash?: boolean;
}

const ALGOS: AlgoInfo[] = [
  { value: 'ecdsa-p256', label: 'ECDSA P-256', curve: 'P-256', webcrypto: true, hash: true },
  { value: 'ecdsa-p384', label: 'ECDSA P-384', curve: 'P-384', webcrypto: true, hash: true },
  { value: 'ecdsa-p521', label: 'ECDSA P-521', curve: 'P-521', webcrypto: true, hash: true },
  { value: 'ed25519', label: 'Ed25519', webcrypto: true },
  { value: 'rsa-pss', label: 'RSA-PSS', webcrypto: true, hash: true },
  { value: 'rsa-pkcs1', label: 'RSA PKCS#1 v1.5', webcrypto: true, hash: true },
  { value: 'secp256k1', label: 'secp256k1 (hex keys)' },
];

const isPem = (value: string): boolean => value.trim().startsWith('-----BEGIN');

function importParams(algo: SignAlgo, hash: RsaHash): AlgorithmIdentifier {
  switch (algo) {
    case 'ecdsa-p256':
      return { name: 'ECDSA', namedCurve: 'P-256', hash: hash } as EcKeyImportParams;
    case 'ecdsa-p384':
      return { name: 'ECDSA', namedCurve: 'P-384', hash: hash } as EcKeyImportParams;
    case 'ecdsa-p521':
      return { name: 'ECDSA', namedCurve: 'P-521', hash: hash } as EcKeyImportParams;
    case 'ed25519':
      return { name: 'Ed25519' } as AlgorithmIdentifier;
    case 'rsa-pss':
      return { name: 'RSA-PSS', hash: hash } as RsaHashedImportParams;
    default:
      return { name: 'RSASSA-PKCS1-v1_5', hash: hash } as RsaHashedImportParams;
  }
}

function signParams(algo: SignAlgo, hash: RsaHash): Algorithm {
  switch (algo) {
    case 'ecdsa-p256':
    case 'ecdsa-p384':
    case 'ecdsa-p521':
      return { name: 'ECDSA', hash: hash } as EcdsaParams;
    case 'ed25519':
      return { name: 'Ed25519' } as Algorithm;
    case 'rsa-pss':
      return { name: 'RSA-PSS', saltLength: hash === 'SHA-1' ? 20 : hash === 'SHA-256' ? 32 : hash === 'SHA-384' ? 48 : 64 } as RsaPssParams;
    default:
      return { name: 'RSASSA-PKCS1-v1_5' } as Algorithm;
  }
}

function signaturesTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'crypto-signatures',
    group: 'crypto',
    icon: '<path d="M3 17c3 0 3 -10 6 -10s2 8 5 8s3 -4 7 -4"/><path d="M3 21h18"/>',
    name: { en: 'Signatures & Key Exchange', ru: 'Подписи и обмен ключами' },
    desc: {
      en: 'ECDSA, Ed25519, secp256k1, RSA-PSS and PKCS#1 signatures, X25519/P-256 key agreement, PEM/JWK conversion.',
      ru: 'Подписи ECDSA, Ed25519, secp256k1, RSA-PSS и PKCS#1, обмен ключами X25519/P-256, конвертация PEM/JWK.',
    },
    keywords: 'signature подпись ecdsa ed25519 secp256k1 rsa-pss x25519 ecdh pem jwk',
    mount(root, ctx) {
      let algo: SignAlgo = 'ecdsa-p256';
      let inputEncoding: DataEncoding = 'utf8';
      let signatureEncoding: DataEncoding = 'base64';
      let hash: RsaHash = 'SHA-256';

      const algoSelect = select(ALGOS.map((item) => ({ value: item.value, label: item.label })), algo, (value) => {
        algo = value as SignAlgo;
        hashField.hidden = !ALGOS.find((item) => item.value === algo)?.hash;
      });
      const hashSelect = select(
        [
          { value: 'SHA-256', label: 'SHA-256' },
          { value: 'SHA-384', label: 'SHA-384' },
          { value: 'SHA-512', label: 'SHA-512' },
          { value: 'SHA-1', label: 'SHA-1' },
        ],
        'SHA-256',
        (value) => {
          hash = value as RsaHash;
        },
      );
      const hashField = field(ctx.pick('Hash', 'Хеш'), hashSelect);
      const privateArea = area({ rows: 7, placeholder: ctx.pick('Private key: PEM or hex', 'Закрытый ключ: PEM или hex') });
      const publicArea = area({ rows: 7, placeholder: ctx.pick('Public key: PEM or hex', 'Открытый ключ: PEM или hex') });
      const messageArea = area({ rows: 7, value: 'hello' });
      const signatureArea = area({ rows: 5, readOnly: true });
      const signError = errorSlot();
      const signInfo = h('div');
      const inputEncodingSelect = select(
        [
          { value: 'utf8', label: ctx.pick('Text', 'Текст') },
          { value: 'hex', label: 'Hex' },
          { value: 'base64', label: 'Base64' },
        ],
        inputEncoding,
        (value) => {
          inputEncoding = value as DataEncoding;
        },
      );
      const signatureEncodingSelect = select(
        [
          { value: 'base64', label: 'Base64' },
          { value: 'hex', label: 'Hex' },
        ],
        signatureEncoding,
        (value) => {
          signatureEncoding = value as DataEncoding;
        },
      );

      const generate = async () => {
        setError(signError, null);
        try {
          if (algo === 'secp256k1') {
            const secret = secp256k1.utils.randomSecretKey();
            privateArea.value = bytesToHex(secret);
            publicArea.value = bytesToHex(secp256k1.getPublicKey(secret, true));
            signInfo.replaceChildren(badge(ctx.pick('secp256k1 key pair generated', 'Пара secp256k1 создана'), 'ok'));
            return;
          }
          const algorithm = algo === 'rsa-pss' || algo === 'rsa-pkcs1'
            ? { name: algo === 'rsa-pss' ? 'RSA-PSS' : 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash }
            : importParams(algo, hash);
          const pair = (await crypto.subtle.generateKey(algorithm, true, ['sign', 'verify'])) as CryptoKeyPair;
          publicArea.value = await exportKeyPem(pair.publicKey, 'spki');
          privateArea.value = await exportKeyPem(pair.privateKey, 'pkcs8');
          signInfo.replaceChildren(badge(ctx.pick('Key pair generated', 'Пара ключей создана'), 'ok'));
        } catch (cause) {
          setError(signError, cause instanceof Error ? cause.message : String(cause));
        }
      };

      const sign = async () => {
        setError(signError, null);
        try {
          const message = decodeData(messageArea.value, inputEncoding);
          let signature: Uint8Array;
          if (algo === 'secp256k1') {
            signature = secp256k1.sign(nobleSha256(message), hexToBytes(privateArea.value));
          } else {
            const key = await crypto.subtle.importKey('pkcs8', bufferOf(pemBody(privateArea.value)), importParams(algo, hash), false, ['sign']);
            signature = toBytes(await crypto.subtle.sign(signParams(algo, hash), key, bufferOf(message)));
          }
          signatureArea.value = encodeData(signature, signatureEncoding);
          signInfo.replaceChildren(stats([[ctx.pick('Signature', 'Подпись'), formatBytesAsText(signature.length)], [ctx.pick('Key', 'Ключ'), pemLabel(privateArea.value) || (algo === 'secp256k1' ? 'hex' : '—')]]));
        } catch (cause) {
          setError(signError, cause instanceof Error ? cause.message : String(cause));
        }
      };

      const verify = async () => {
        setError(signError, null);
        try {
          const message = decodeData(messageArea.value, inputEncoding);
          const signature = decodeData(signatureArea.value.trim(), signatureEncoding);
          let ok: boolean;
          if (algo === 'secp256k1') {
            ok = secp256k1.verify(signature, nobleSha256(message), hexToBytes(publicArea.value));
          } else {
            const key = await crypto.subtle.importKey('spki', bufferOf(pemBody(publicArea.value)), importParams(algo, hash), false, ['verify']);
            ok = await crypto.subtle.verify(signParams(algo, hash), key, bufferOf(signature), bufferOf(message));
          }
          signInfo.replaceChildren(badge(ok ? ctx.pick('Signature is valid', 'Подпись верна') : ctx.pick('Signature is invalid', 'Подпись неверна'), ok ? 'ok' : 'bad'));
        } catch (cause) {
          setError(signError, cause instanceof Error ? cause.message : String(cause));
        }
      };

      hashField.hidden = !ALGOS.find((item) => item.value === algo)?.hash;

      const signTab = h(
        'div',
        { class: 'dt-stack' },
        toolbar(
          field(ctx.pick('Algorithm', 'Алгоритм'), algoSelect),
          hashField,
          btn(ctx.pick('Generate key pair', 'Сгенерировать пару'), () => void generate(), { variant: 'primary' }),
        ),
        h('div', { class: 'dt-inline-form' }, field(ctx.pick('Input is', 'Вход'), inputEncodingSelect), field(ctx.pick('Signature is', 'Подпись'), signatureEncodingSelect)),
        signError,
        split(
          pane(ctx.pick('Private key', 'Закрытый ключ'), privateArea, [copyBtn(() => privateArea.value)]),
          pane(ctx.pick('Public key', 'Открытый ключ'), publicArea, [copyBtn(() => publicArea.value)]),
        ),
        pane(ctx.pick('Message', 'Сообщение'), messageArea),
        toolbar(
          btn(ctx.pick('Sign', 'Подписать'), () => void sign(), { variant: 'primary' }),
          btn(ctx.pick('Verify', 'Проверить'), () => void verify()),
          copyBtn(() => signatureArea.value),
        ),
        pane(ctx.pick('Signature', 'Подпись'), signatureArea),
        signInfo,
        note(ctx.pick('ECDSA/Ed25519/RSA-PSS use WebCrypto (PEM, PKCS#8/SPKI). secp256k1 uses @noble/curves with 32-byte hex keys and SHA-256. ECDSA signature encoding is DER in WebCrypto.', 'ECDSA/Ed25519/RSA-PSS используют WebCrypto (PEM, PKCS#8/SPKI). secp256k1 — @noble/curves, ключи 32 байта hex и SHA-256. В WebCrypto подпись ECDSA кодируется в DER.'), 'info'),
      );

      // ---------- Key exchange ----------
      let kexAlgo: 'x25519' | 'p256' = 'x25519';
      const kexSelect = select(
        [
          { value: 'x25519', label: 'X25519' },
          { value: 'p256', label: 'ECDH P-256' },
        ],
        kexAlgo,
        (value) => {
          kexAlgo = value as 'x25519' | 'p256';
          kexGenerate();
        },
      );
      const kexPrivate = textInput({ class: 'dt-mono' });
      const kexPublic = textInput({ class: 'dt-mono' });
      const kexPeer = textInput({ class: 'dt-mono', placeholder: ctx.pick('peer public key (hex)', 'открытый ключ партнёра (hex)') });
      const kexShared = textInput({ class: 'dt-mono', readOnly: true });
      const kexError = errorSlot();

      const kexGenerate = () => {
        setError(kexError, null);
        try {
          if (kexAlgo === 'x25519') {
            const secret = x25519.utils.randomSecretKey();
            kexPrivate.value = bytesToHex(secret);
            kexPublic.value = bytesToHex(x25519.getPublicKey(secret));
          } else {
            const secret = p256.utils.randomSecretKey();
            kexPrivate.value = bytesToHex(secret);
            kexPublic.value = bytesToHex(p256.getPublicKey(secret, true));
          }
        } catch (cause) {
          setError(kexError, cause instanceof Error ? cause.message : String(cause));
        }
      };

      const kexCompute = () => {
        setError(kexError, null);
        try {
          const secret = hexToBytes(kexPrivate.value);
          const peer = hexToBytes(kexPeer.value);
          const shared = kexAlgo === 'p256' ? p256.getSharedSecret(secret, peer, true).subarray(1) : x25519.getSharedSecret(secret, peer);
          kexShared.value = bytesToHex(shared);
        } catch (cause) {
          setError(kexError, cause instanceof Error ? cause.message : String(cause));
        }
      };

      const kexTab = h(
        'div',
        { class: 'dt-stack' },
        toolbar(field(ctx.pick('Algorithm', 'Алгоритм'), kexSelect), btn(ctx.pick('Generate pair', 'Сгенерировать пару'), kexGenerate)),
        h('div', { class: 'dt-inline-form' }, field(ctx.pick('My private key (hex)', 'Мой закрытый ключ (hex)'), kexPrivate), field(ctx.pick('My public key (hex)', 'Мой открытый ключ (hex)'), kexPublic), copyBtn(() => kexPublic.value)),
        kexError,
        field(ctx.pick('Peer public key (hex)', 'Открытый ключ партнёра (hex)'), kexPeer),
        toolbar(btn(ctx.pick('Compute shared secret', 'Вычислить общий секрет'), kexCompute, { variant: 'primary' })),
        h('div', { class: 'dt-inline-form' }, field(ctx.pick('Shared secret (hex)', 'Общий секрет (hex)'), kexShared), copyBtn(() => kexShared.value)),
        note(ctx.pick('X25519 keys are 32 bytes; P-256 public keys are 33-byte compressed points. The shared secret is the raw X coordinate.', 'Ключи X25519 — 32 байта; открытые ключи P-256 — 33-байтовые сжатые точки. Общий секрет — X-координата.'), 'info'),
      );

      // ---------- Key formats ----------
      const keyAlgo = select(
        [
          { value: 'ed25519', label: 'Ed25519' },
          { value: 'ecdsa-p256', label: 'ECDSA P-256' },
          { value: 'rsa-pss', label: 'RSA 2048' },
        ],
        'ed25519',
      );
      const pemArea = area({ rows: 7, placeholder: ctx.pick('PEM key (SPKI or PKCS#8)', 'PEM-ключ (SPKI или PKCS#8)') });
      const jwkArea = area({ rows: 10, placeholder: '{"kty":"…"}' });
      const keyError = errorSlot();
      const keyInfo = h('div');

      const pemToJwk = async () => {
        setError(keyError, null);
        try {
          const label = pemLabel(pemArea.value);
          const format = label.includes('PRIVATE') ? 'pkcs8' : 'spki';
          const params = importParams(keyAlgo.value as SignAlgo, 'SHA-256');
          const key = await crypto.subtle.importKey(format, bufferOf(pemBody(pemArea.value)), params, true, format === 'pkcs8' ? ['sign'] : ['verify']);
          jwkArea.value = JSON.stringify(await crypto.subtle.exportKey('jwk', key), null, 2);
          keyInfo.replaceChildren(badge(`${label} → JWK`, 'ok'));
        } catch (cause) {
          setError(keyError, cause instanceof Error ? cause.message : String(cause));
        }
      };

      const jwkToPem = async () => {
        setError(keyError, null);
        try {
          const jwk = JSON.parse(jwkArea.value) as JsonWebKey;
          const params = importParams(keyAlgo.value as SignAlgo, 'SHA-256');
          const isPrivate = Boolean(jwk.d);
          const key = await crypto.subtle.importKey('jwk', jwk, params, true, isPrivate ? ['sign'] : ['verify']);
          pemArea.value = await exportKeyPem(key, isPrivate ? 'pkcs8' : 'spki');
          keyInfo.replaceChildren(badge(`JWK → ${isPrivate ? 'PKCS#8' : 'SPKI'} PEM`, 'ok'));
        } catch (cause) {
          setError(keyError, cause instanceof Error ? cause.message : String(cause));
        }
      };

      const fingerprint = async () => {
        setError(keyError, null);
        try {
          const der = pemBody(pemArea.value);
          const digest = await sha256(der);
          keyInfo.replaceChildren(stats([['SHA-256', bytesToHex(digest)], [ctx.pick('DER size', 'Размер DER'), formatBytesAsText(der.length)]]));
        } catch (cause) {
          setError(keyError, cause instanceof Error ? cause.message : String(cause));
        }
      };

      const keysTab = h(
        'div',
        { class: 'dt-stack' },
        toolbar(field(ctx.pick('Key type', 'Тип ключа'), keyAlgo), btn(ctx.pick('PEM → JWK', 'PEM → JWK'), () => void pemToJwk()), btn(ctx.pick('JWK → PEM', 'JWK → PEM'), () => void jwkToPem()), btn(ctx.pick('SHA-256 fingerprint', 'Отпечаток SHA-256'), () => void fingerprint())),
        keyError,
        split(pane('PEM', pemArea, [copyBtn(() => pemArea.value)]), pane('JWK', jwkArea, [copyBtn(() => jwkArea.value)])),
        keyInfo,
        note(ctx.pick('Supports SPKI/PKCS#8 PEM and JWK for Ed25519, ECDSA P-256 and RSA.', 'Поддерживаются SPKI/PKCS#8 PEM и JWK для Ed25519, ECDSA P-256 и RSA.'), 'info'),
      );

      root.append(
        tabs([
          { id: 'sign', label: ctx.pick('Sign / Verify', 'Подпись / Проверка'), render: () => signTab },
          { id: 'kex', label: ctx.pick('Key exchange', 'Обмен ключами'), render: () => kexTab },
          { id: 'keys', label: ctx.pick('Key formats', 'Форматы ключей'), render: () => keysTab },
        ]),
      );
    },
  });
}

export const signatureTools = [signaturesTool()];
