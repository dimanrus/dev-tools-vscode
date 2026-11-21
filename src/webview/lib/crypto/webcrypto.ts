/** WebCrypto wrappers for PEM keys, RSA and ECIES. */
import { concatBytes, randomBytes } from './codec.ts';
import { derToPem, pemBody } from './pem.ts';

export type RsaScheme = 'RSA-OAEP' | 'RSAES-PKCS1-v1_5';
export type RsaHash = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512';

export function bufferOf(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export function toBytes(value: ArrayBuffer | Uint8Array): Uint8Array {
  return value instanceof Uint8Array ? value : new Uint8Array(value);
}

export function hashLength(hash: RsaHash): number {
  return hash === 'SHA-1' ? 20 : hash === 'SHA-256' ? 32 : hash === 'SHA-384' ? 48 : 64;
}

export async function generateRsaKeyPair(bits: number, scheme: RsaScheme, hash: RsaHash): Promise<CryptoKeyPair> {
  const algorithm = { name: scheme, modulusLength: bits, publicExponent: new Uint8Array([1, 0, 1]), hash };
  return (await crypto.subtle.generateKey(algorithm, true, ['encrypt', 'decrypt'])) as CryptoKeyPair;
}

export async function exportKeyPem(key: CryptoKey, format: 'spki' | 'pkcs8'): Promise<string> {
  const der = toBytes(await crypto.subtle.exportKey(format, key));
  return derToPem(der, format === 'spki' ? 'PUBLIC KEY' : 'PRIVATE KEY');
}

export async function importRsaPublic(pem: string, scheme: RsaScheme, hash: RsaHash): Promise<CryptoKey> {
  return crypto.subtle.importKey('spki', bufferOf(pemBody(pem)), { name: scheme, hash }, false, ['encrypt']);
}

export async function importRsaPrivate(pem: string, scheme: RsaScheme, hash: RsaHash): Promise<CryptoKey> {
  return crypto.subtle.importKey('pkcs8', bufferOf(pemBody(pem)), { name: scheme, hash }, false, ['decrypt']);
}

export function rsaMaxBytes(bits: number, scheme: RsaScheme, hash: RsaHash): number {
  return scheme === 'RSA-OAEP' ? bits / 8 - 2 * hashLength(hash) - 2 : bits / 8 - 11;
}

export function modulusBits(key: CryptoKey): number {
  const algorithm = key.algorithm as RsaHashedKeyAlgorithm;
  return algorithm.modulusLength ?? 2048;
}

// ---------- ECIES (ECDH P-256 + HKDF-SHA-256 + AES-256-GCM) ----------

const ECIES_INFO = new TextEncoder().encode('dev-tools-vscode/ecies/v1');
const ECIES_VERSION = 1;

async function deriveEciesKey(privateKey: CryptoKey, publicKey: CryptoKey, salt: Uint8Array): Promise<CryptoKey> {
  const bits = await crypto.subtle.deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256);
  const hkdf = await crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: bufferOf(salt), info: bufferOf(ECIES_INFO) },
    hkdf,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function generateEcPair(curve: 'P-256' | 'P-384' = 'P-256'): Promise<CryptoKeyPair> {
  return (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: curve }, true, ['deriveBits'])) as CryptoKeyPair;
}

export async function exportEcPem(key: CryptoKey, format: 'spki' | 'pkcs8'): Promise<string> {
  return exportKeyPem(key, format);
}

export async function importEcPublic(pem: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('spki', bufferOf(pemBody(pem)), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
}

export async function importEcPrivate(pem: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('pkcs8', bufferOf(pemBody(pem)), { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
}

/** Packs `version | ephemeral key | iv | ciphertext+tag` into one byte string. */
export async function eciesEncrypt(recipientPublicKey: CryptoKey, plaintext: Uint8Array): Promise<Uint8Array> {
  const ephemeral = await generateEcPair();
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveEciesKey(ephemeral.privateKey, recipientPublicKey, salt);
  const ciphertext = toBytes(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: bufferOf(iv) }, key, bufferOf(plaintext)));
  const ephemeralRaw = toBytes(await crypto.subtle.exportKey('raw', ephemeral.publicKey));
  return concatBytes(new Uint8Array([ECIES_VERSION]), ephemeralRaw, salt, iv, ciphertext);
}

export async function eciesDecrypt(recipientPrivateKey: CryptoKey, packed: Uint8Array): Promise<Uint8Array> {
  if (packed.length < 1 + 65 + 16 + 12 + 16 || packed[0] !== ECIES_VERSION) throw new Error('Not a dev-tools ECIES payload.');
  const ephemeral = await crypto.subtle.importKey('raw', bufferOf(packed.subarray(1, 66)), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const salt = packed.subarray(66, 82);
  const iv = packed.subarray(82, 94);
  const ciphertext = packed.subarray(94);
  const key = await deriveEciesKey(recipientPrivateKey, ephemeral, salt);
  return toBytes(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bufferOf(iv) }, key, bufferOf(ciphertext)));
}

export async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  return toBytes(await crypto.subtle.digest('SHA-256', bufferOf(bytes)));
}
