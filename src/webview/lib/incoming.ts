/** Helpers for files delivered from the VS Code explorer context menu. */
import type { IncomingFile } from '../tool-types.ts';

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',');
  const header = comma >= 0 ? dataUrl.slice(0, comma) : '';
  const body = comma >= 0 ? dataUrl.slice(comma + 1) : '';
  if (header.includes(';base64')) {
    const binary = atob(body);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }
  return new TextEncoder().encode(decodeURIComponent(body));
}

export function dataUrlToText(dataUrl: string): string {
  return new TextDecoder('utf-8').decode(dataUrlToBytes(dataUrl));
}

export function incomingToFile(incoming: IncomingFile): File {
  return new File([bytesToArrayBuffer(dataUrlToBytes(incoming.dataUrl))], incoming.name, { type: incoming.mime });
}

export function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export function incomingToBlob(incoming: IncomingFile): Blob {
  return new Blob([bytesToArrayBuffer(dataUrlToBytes(incoming.dataUrl))], { type: incoming.mime });
}
