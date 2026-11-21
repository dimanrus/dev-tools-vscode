/**
 * Symmetric cipher catalogue.
 *
 * Everything that ships in a small audited library runs in the webview through
 * @noble/ciphers, so the standalone preview works without the extension host.
 * Modes that only OpenSSL provides (OFB, CCM, OCB, SIV, XTS, Camellia, ARIA, SM4)
 * are proxied to the extension host over RPC.
 */
import { aeskw, aeskwp, cbc, cfb, ctr, ecb, gcm, gcmsiv } from '@noble/ciphers/aes.js';
import { chacha20, chacha20poly1305, xchacha20, xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { bytesToHex, concatBytes, hexToBytes } from './codec.ts';

export type CipherFamily = 'aes' | 'chacha' | 'camellia' | 'aria' | 'sm4';
export type CipherEngine = 'noble' | 'host';

export interface SymmetricSpec {
  id: string;
  family: CipherFamily;
  /** Short mode name, e.g. GCM. */
  mode: string;
  modeLabel: string;
  /** Full label shown in selects. */
  label: string;
  keySizes: number[];
  ivSize: number;
  blockSize: number;
  tagSize: number;
  engine: CipherEngine;
  /** Host algorithm template, `{bits}` is replaced with the AES key size. */
  host?: string;
  /** Key wrapping modes take a key as the payload. */
  wrap?: boolean;
  /** AES-SIV and XTS need a double-length key. */
  keyMultiplier?: number;
  note?: string;
}

interface ModeDef {
  mode: string;
  label: string;
  ivSize: number;
  tagSize: number;
  engine: CipherEngine;
  blockSize: number;
  keyMultiplier?: number;
  wrap?: boolean;
  note?: string;
}

const AES_MODES: ModeDef[] = [
  { mode: 'ecb', label: 'ECB', ivSize: 0, tagSize: 0, engine: 'noble', blockSize: 16, note: 'ECB leaks patterns, use CBC/GCM instead.' },
  { mode: 'cbc', label: 'CBC', ivSize: 16, tagSize: 0, engine: 'noble', blockSize: 16 },
  { mode: 'ctr', label: 'CTR', ivSize: 16, tagSize: 0, engine: 'noble', blockSize: 0 },
  { mode: 'cfb', label: 'CFB', ivSize: 16, tagSize: 0, engine: 'noble', blockSize: 0 },
  { mode: 'ofb', label: 'OFB', ivSize: 16, tagSize: 0, engine: 'host', blockSize: 0 },
  { mode: 'gcm', label: 'GCM', ivSize: 12, tagSize: 16, engine: 'noble', blockSize: 0 },
  { mode: 'ccm', label: 'CCM', ivSize: 12, tagSize: 16, engine: 'host', blockSize: 0 },
  { mode: 'ocb', label: 'OCB', ivSize: 12, tagSize: 16, engine: 'host', blockSize: 0 },
  { mode: 'gcmsiv', label: 'GCM-SIV', ivSize: 12, tagSize: 16, engine: 'noble', blockSize: 0 },
  { mode: 'siv', label: 'SIV', ivSize: 0, tagSize: 16, engine: 'host', blockSize: 0, keyMultiplier: 2 },
  { mode: 'kw', label: 'KW', ivSize: 0, tagSize: 0, engine: 'noble', blockSize: 0, wrap: true },
  { mode: 'kwp', label: 'KWP', ivSize: 0, tagSize: 0, engine: 'noble', blockSize: 0, wrap: true },
  { mode: 'xts', label: 'XTS', ivSize: 16, tagSize: 0, engine: 'host', blockSize: 16, keyMultiplier: 2 },
];

const EXTRA_MODES: Record<'camellia' | 'aria' | 'sm4', ModeDef[]> = {
  camellia: ['ecb', 'cbc', 'ctr', 'cfb', 'cfb8', 'ofb'].map((mode) => ({
    mode,
    label: mode.toUpperCase(),
    ivSize: mode === 'ecb' ? 0 : 16,
    tagSize: 0,
    engine: 'host' as const,
    blockSize: mode === 'ecb' || mode === 'cbc' ? 16 : 0,
  })),
  aria: ['ecb', 'cbc', 'ctr', 'cfb', 'cfb8', 'ofb', 'gcm', 'ccm'].map((mode) => ({
    mode,
    label: mode.toUpperCase(),
    ivSize: mode === 'ecb' ? 0 : mode === 'gcm' || mode === 'ccm' ? 12 : 16,
    tagSize: mode === 'gcm' || mode === 'ccm' ? 16 : 0,
    engine: 'host' as const,
    blockSize: mode === 'ecb' || mode === 'cbc' ? 16 : 0,
  })),
  sm4: ['ecb', 'cbc', 'ctr', 'cfb', 'ofb', 'gcm', 'ccm'].map((mode) => ({
    mode,
    label: mode.toUpperCase(),
    ivSize: mode === 'ecb' ? 0 : mode === 'gcm' || mode === 'ccm' ? 12 : 16,
    tagSize: mode === 'gcm' || mode === 'ccm' ? 16 : 0,
    engine: 'host' as const,
    blockSize: mode === 'ecb' || mode === 'cbc' ? 16 : 0,
  })),
};

export const SYMMETRIC_SPECS: SymmetricSpec[] = [
  ...[128, 192, 256].flatMap((bits) =>
    AES_MODES.map((mode) => {
      const keyBytes = (bits / 8) * (mode.keyMultiplier ?? 1);
      return {
        id: `aes-${bits}-${mode.mode}`,
        family: 'aes' as const,
        mode: mode.mode,
        modeLabel: mode.label,
        label: `AES-${bits} ${mode.label}`,
        keySizes: [keyBytes],
        ivSize: mode.ivSize,
        blockSize: mode.blockSize,
        tagSize: mode.tagSize,
        engine: mode.engine,
        host: mode.engine === 'host' ? `aes-${bits}-${mode.mode}` : undefined,
        wrap: mode.wrap,
        keyMultiplier: mode.keyMultiplier,
        note: mode.note,
      };
    }),
  ),
  {
    id: 'chacha20',
    family: 'chacha',
    mode: 'chacha20',
    modeLabel: 'ChaCha20',
    label: 'ChaCha20',
    keySizes: [32],
    ivSize: 12,
    blockSize: 0,
    tagSize: 0,
    engine: 'noble',
  },
  {
    id: 'chacha20-poly1305',
    family: 'chacha',
    mode: 'chacha20-poly1305',
    modeLabel: 'ChaCha20-Poly1305',
    label: 'ChaCha20-Poly1305',
    keySizes: [32],
    ivSize: 12,
    blockSize: 0,
    tagSize: 16,
    engine: 'noble',
  },
  {
    id: 'xchacha20',
    family: 'chacha',
    mode: 'xchacha20',
    modeLabel: 'XChaCha20',
    label: 'XChaCha20',
    keySizes: [32],
    ivSize: 24,
    blockSize: 0,
    tagSize: 0,
    engine: 'noble',
  },
  {
    id: 'xchacha20-poly1305',
    family: 'chacha',
    mode: 'xchacha20-poly1305',
    modeLabel: 'XChaCha20-Poly1305',
    label: 'XChaCha20-Poly1305',
    keySizes: [32],
    ivSize: 24,
    blockSize: 0,
    tagSize: 16,
    engine: 'noble',
  },
  ...(['camellia', 'aria'] as const).flatMap((family) =>
    [128, 192, 256].flatMap((bits) =>
      EXTRA_MODES[family].map((mode) => ({
        id: `${family}-${bits}-${mode.mode}`,
        family,
        mode: mode.mode,
        modeLabel: mode.label,
        label: `${family === 'camellia' ? 'Camellia' : 'ARIA'}-${bits} ${mode.label}`,
        keySizes: [bits / 8],
        ivSize: mode.ivSize,
        blockSize: mode.blockSize,
        tagSize: mode.tagSize,
        engine: mode.engine,
        host: `${family}-${bits}-${mode.mode}`,
      })),
    ),
  ),
  ...EXTRA_MODES.sm4.map((mode) => ({
    id: `sm4-${mode.mode}`,
    family: 'sm4' as const,
    mode: mode.mode,
    modeLabel: mode.label,
    label: `SM4 ${mode.label}`,
    keySizes: [16],
    ivSize: mode.ivSize,
    blockSize: mode.blockSize,
    tagSize: mode.tagSize,
    engine: mode.engine,
    host: `sm4-${mode.mode}`,
  })),
];

export function specsForFamily(family: CipherFamily): SymmetricSpec[] {
  return SYMMETRIC_SPECS.filter((spec) => spec.family === family);
}

export function findSpec(id: string): SymmetricSpec {
  const spec = SYMMETRIC_SPECS.find((item) => item.id === id);
  if (!spec) throw new Error(`Unknown algorithm: ${id}`);
  return spec;
}

export interface SymmetricRequest {
  encrypt: boolean;
  key: Uint8Array;
  iv: Uint8Array;
  aad: Uint8Array;
  data: Uint8Array;
  tag: Uint8Array;
  padding: boolean;
  counter?: number;
}

export interface SymmetricOutput {
  data: Uint8Array;
  tag: Uint8Array;
}

export type RpcCall = <T = unknown>(method: string, params?: unknown) => Promise<T>;

const EMPTY = new Uint8Array(0);

function splitTag(output: Uint8Array, tagSize: number): SymmetricOutput {
  return { data: output.subarray(0, output.length - tagSize), tag: output.subarray(output.length - tagSize) };
}

export async function runSymmetric(rpc: RpcCall, spec: SymmetricSpec, request: SymmetricRequest): Promise<SymmetricOutput> {
  const { key, iv, aad, data, tag, encrypt } = request;
  if (!spec.keySizes.includes(key.length)) {
    throw new Error(`${spec.label} expects a ${spec.keySizes.map((size) => `${size}-byte`).join(' or ')} key, got ${key.length} bytes.`);
  }
  if (spec.ivSize > 0 && iv.length !== spec.ivSize) {
    throw new Error(`${spec.label} expects a ${spec.ivSize}-byte IV/nonce, got ${iv.length} bytes.`);
  }
  if (spec.ivSize === 0 && iv.length > 0) throw new Error(`${spec.label} does not use an IV.`);
  if (spec.tagSize > 0 && !encrypt && tag.length !== spec.tagSize) {
    throw new Error(`${spec.label} expects a ${spec.tagSize}-byte authentication tag, got ${tag.length} bytes.`);
  }

  if (spec.engine === 'host') {
    const algorithm = (spec.host ?? spec.id).replace('{bits}', String(key.length * 8));
    const result = await rpc<{ data: string; tag: string }>('cipher', {
      action: encrypt ? 'encrypt' : 'decrypt',
      algorithm,
      key: bytesToHex(key),
      iv: spec.ivSize > 0 ? bytesToHex(iv) : '',
      aad: aad.length ? bytesToHex(aad) : '',
      tag: tag.length ? bytesToHex(tag) : '',
      tagLength: spec.tagSize,
      padding: request.padding,
      data: bytesToHex(data),
    });
    return { data: hexToBytes(result.data), tag: result.tag ? hexToBytes(result.tag) : EMPTY };
  }

  if (spec.family === 'chacha') {
    if (spec.mode === 'chacha20') {
      return { data: chacha20(key, iv, data, undefined, request.counter ?? 1), tag: EMPTY };
    }
    if (spec.mode === 'xchacha20') {
      return { data: xchacha20(key, iv, data, undefined, request.counter ?? 1), tag: EMPTY };
    }
    const cipher = spec.mode === 'chacha20-poly1305' ? chacha20poly1305(key, iv, aad) : xchacha20poly1305(key, iv, aad);
    return encrypt ? splitTag(cipher.encrypt(data), 16) : { data: cipher.decrypt(concatBytes(data, tag)), tag: EMPTY };
  }

  // AES through @noble/ciphers.
  switch (spec.mode) {
    case 'ecb': {
      const cipher = ecb(key, { disablePadding: !request.padding });
      return { data: encrypt ? cipher.encrypt(data) : cipher.decrypt(data), tag: EMPTY };
    }
    case 'cbc': {
      const cipher = cbc(key, iv, { disablePadding: !request.padding });
      return { data: encrypt ? cipher.encrypt(data) : cipher.decrypt(data), tag: EMPTY };
    }
    case 'ctr':
      return { data: ctr(key, iv).encrypt(data), tag: EMPTY };
    case 'cfb':
      return { data: cfb(key, iv).encrypt(data), tag: EMPTY };
    case 'gcm': {
      const cipher = gcm(key, iv, aad);
      return encrypt ? splitTag(cipher.encrypt(data), 16) : { data: cipher.decrypt(concatBytes(data, tag)), tag: EMPTY };
    }
    case 'gcmsiv': {
      const cipher = gcmsiv(key, iv, aad);
      return encrypt ? splitTag(cipher.encrypt(data), 16) : { data: cipher.decrypt(concatBytes(data, tag)), tag: EMPTY };
    }
    case 'kw':
      return { data: encrypt ? aeskw(key).encrypt(data) : aeskw(key).decrypt(data), tag: EMPTY };
    case 'kwp':
      return { data: encrypt ? aeskwp(key).encrypt(data) : aeskwp(key).decrypt(data), tag: EMPTY };
    default:
      throw new Error(`Unsupported mode: ${spec.mode}`);
  }
}
