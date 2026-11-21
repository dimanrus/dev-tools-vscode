/** PEM/DER helpers for keys and signatures. */
import { bytesToBase64, base64ToBytes } from '../bytes.ts';

export interface PemBlock {
  label: string;
  der: Uint8Array;
}

export function wrapBase64(text: string, width = 64): string {
  const lines: string[] = [];
  for (let index = 0; index < text.length; index += width) lines.push(text.slice(index, index + width));
  return lines.join('\n');
}

export function derToPem(der: Uint8Array, label: string): string {
  return `-----BEGIN ${label}-----\n${wrapBase64(bytesToBase64(der))}\n-----END ${label}-----`;
}

export function parsePem(pem: string): PemBlock {
  const match = /-----BEGIN ([^-]+)-----([\s\S]+?)-----END \1-----/.exec(pem);
  if (!match) throw new Error('No PEM block found in the input.');
  return { label: match[1].trim(), der: base64ToBytes(match[2]) };
}

export function pemBody(pem: string): Uint8Array {
  return parsePem(pem).der;
}

/** Detects the PEM label of a key, e.g. PUBLIC KEY or PRIVATE KEY. */
export function pemLabel(pem: string): string {
  return /-----BEGIN ([^-]+)-----/.exec(pem)?.[1].trim() ?? '';
}
