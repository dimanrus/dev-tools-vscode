/** Byte codecs shared by the cryptography tools. */
import { base64ToBytes, bytesToBase64 } from '../bytes.ts';

export type DataEncoding = 'utf8' | 'hex' | 'base64' | 'base64url';

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: false });

export function utf8ToBytes(text: string): Uint8Array {
  return encoder.encode(text);
}

export function bytesToUtf8(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

export function hexToBytes(value: string): Uint8Array {
  const clean = value.replace(/^0x/i, '').replace(/[\s:,_-]+/g, '');
  if (!clean.length) return new Uint8Array(0);
  if (clean.length % 2) throw new Error('Hex string must contain an even number of digits.');
  if (!/^[0-9a-f]+$/i.test(clean)) throw new Error('Hex string contains invalid characters.');
  const bytes = new Uint8Array(clean.length / 2);
  for (let index = 0; index < bytes.length; index++) bytes[index] = Number.parseInt(clean.slice(index * 2, index * 2 + 2), 16);
  return bytes;
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlToBytes(value: string): Uint8Array {
  return base64ToBytes(value);
}

export function encodeData(bytes: Uint8Array, encoding: DataEncoding): string {
  switch (encoding) {
    case 'hex':
      return bytesToHex(bytes);
    case 'base64':
      return bytesToBase64(bytes);
    case 'base64url':
      return bytesToBase64Url(bytes);
    default:
      return bytesToUtf8(bytes);
  }
}

export function decodeData(value: string, encoding: DataEncoding): Uint8Array {
  switch (encoding) {
    case 'hex':
      return hexToBytes(value);
    case 'base64':
    case 'base64url':
      return base64ToBytes(value);
    default:
      return utf8ToBytes(value);
  }
}

export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index++) diff |= left[index] ^ right[index];
  return diff === 0;
}

/** Human readable key/IV requirement, e.g. "16 bytes / 128 bit". */
export function describeSize(bytes: number): string {
  return `${bytes} B / ${bytes * 8} bit`;
}

export function fingerprint(bytes: Uint8Array): string {
  const hex = bytesToHex(bytes);
  return hex.length > 32 ? `${hex.slice(0, 16)}…${hex.slice(-16)}` : hex || '—';
}

/** PKCS#7 padding (used by block ciphers that expect aligned input). */
export function pkcs7Pad(bytes: Uint8Array, blockSize: number): Uint8Array {
  const padding = blockSize - (bytes.length % blockSize);
  return concatBytes(bytes, new Uint8Array(padding).fill(padding));
}

export function pkcs7Unpad(bytes: Uint8Array, blockSize: number): Uint8Array {
  if (!bytes.length || bytes.length % blockSize) throw new Error('Padded data must be a multiple of the block size.');
  const padding = bytes[bytes.length - 1];
  if (padding < 1 || padding > blockSize || padding > bytes.length) throw new Error('Invalid PKCS#7 padding.');
  for (let index = bytes.length - padding; index < bytes.length; index++) {
    if (bytes[index] !== padding) throw new Error('Invalid PKCS#7 padding.');
  }
  return bytes.subarray(0, bytes.length - padding);
}
