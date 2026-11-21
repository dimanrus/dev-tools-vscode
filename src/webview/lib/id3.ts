/** Minimal ID3v2.4 reader/writer used by the audio editor and metadata tool. */

export interface Id3Cover {
  mime: string;
  bytes: Uint8Array;
}

export interface Id3Tags {
  title: string;
  artist: string;
  album: string;
  year: string;
  genre: string;
  track: string;
  comment: string;
  cover: Id3Cover | null;
}

export function emptyTags(): Id3Tags {
  return { title: '', artist: '', album: '', year: '', genre: '', track: '', comment: '', cover: null };
}

export function hasTags(tags: Id3Tags): boolean {
  return Boolean(
    tags.title || tags.artist || tags.album || tags.year || tags.genre || tags.track || tags.comment || tags.cover,
  );
}

const syncSafe = (value: number): number =>
  ((value & 0x7f000000) >>> 3) | ((value & 0x7f0000) >>> 2) | ((value & 0x7f00) >>> 1) | (value & 0x7f);

const readSyncSafe = (bytes: Uint8Array, offset: number): number =>
  ((bytes[offset] & 0x7f) << 21) |
  ((bytes[offset + 1] & 0x7f) << 14) |
  ((bytes[offset + 2] & 0x7f) << 7) |
  (bytes[offset + 3] & 0x7f);

const readUint32 = (bytes: Uint8Array, offset: number): number =>
  ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;

const decoder = new TextDecoder('utf-8');
const latin1 = new TextDecoder('latin1');

const decodeText = (bytes: Uint8Array, encoding: number): string => {
  if (encoding === 0) return latin1.decode(bytes);
  if (encoding === 3) return decoder.decode(bytes);
  if (encoding === 1 || encoding === 2) {
    const bigEndian = encoding === 2 || (bytes[0] === 0xfe && bytes[1] === 0xff);
    const start = bytes[0] === 0xff || bytes[0] === 0xfe ? 2 : 0;
    let result = '';
    for (let index = start; index + 1 < bytes.length; index += 2) {
      const code = bigEndian
        ? (bytes[index] << 8) | bytes[index + 1]
        : bytes[index] | (bytes[index + 1] << 8);
      result += String.fromCharCode(code);
    }
    return result.replace(/\0+$/, '');
  }
  return latin1.decode(bytes);
};

const splitTerminated = (bytes: Uint8Array, encoding: number): [Uint8Array, Uint8Array] => {
  const twoByte = encoding === 1 || encoding === 2;
  for (let index = 0; index + (twoByte ? 1 : 0) < bytes.length; index += twoByte ? 2 : 1) {
    if (twoByte ? bytes[index] === 0 && bytes[index + 1] === 0 : bytes[index] === 0) {
      return [bytes.subarray(0, index), bytes.subarray(index + (twoByte ? 2 : 1))];
    }
  }
  return [bytes, new Uint8Array(0)];
};

export function parseId3(bytes: Uint8Array): Id3Tags | null {
  if (bytes.length < 10 || bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return null;
  const major = bytes[3];
  const size = readSyncSafe(bytes, 6);
  const end = Math.min(bytes.length, 10 + size);
  const tags = emptyTags();
  let offset = 10;
  while (offset + 10 <= end) {
    const id = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    if (!/^[A-Z0-9]{4}$/.test(id)) break;
    const frameSize = major >= 4 ? readSyncSafe(bytes, offset + 4) : readUint32(bytes, offset + 4);
    if (!frameSize || offset + 10 + frameSize > end) break;
    const body = bytes.subarray(offset + 10, offset + 10 + frameSize);
    if (body.length > 1) {
      const encoding = body[0];
      if (id.startsWith('T') && id !== 'TXXX') {
        const value = decodeText(body.subarray(1), encoding);
        if (id === 'TIT2') tags.title = value;
        else if (id === 'TPE1') tags.artist = value;
        else if (id === 'TALB') tags.album = value;
        else if (id === 'TYER' || id === 'TDRC') tags.year = value;
        else if (id === 'TCON') tags.genre = value;
        else if (id === 'TRCK') tags.track = value;
      } else if (id === 'COMM' && body.length > 4) {
        const [description, text] = splitTerminated(body.subarray(4), encoding);
        void description;
        tags.comment = decodeText(text, encoding);
      } else if (id === 'APIC' && body.length > 4) {
        const [mimeBytes, rest] = splitTerminated(body.subarray(1), 0);
        const mime = latin1.decode(mimeBytes);
        if (rest.length > 1) {
          const pictureType = rest[0];
          const [, data] = splitTerminated(rest.subarray(1), encoding);
          if (pictureType === 3 || !tags.cover) {
            tags.cover = { mime: mime || 'image/jpeg', bytes: new Uint8Array(data) };
          }
        }
      }
    }
    offset += 10 + frameSize;
  }
  return tags;
}

const utf8 = new TextEncoder();

const frame = (id: string, body: Uint8Array): Uint8Array => {
  const result = new Uint8Array(10 + body.length);
  for (let index = 0; index < 4; index++) result[index] = id.charCodeAt(index);
  const size = syncSafe(body.length);
  result[4] = (size >>> 21) & 0x7f;
  result[5] = (size >>> 14) & 0x7f;
  result[6] = (size >>> 7) & 0x7f;
  result[7] = size & 0x7f;
  result.set(body, 10);
  return result;
};

const textFrame = (id: string, value: string): Uint8Array | null => {
  if (!value.trim()) return null;
  const encoded = utf8.encode(value);
  const body = new Uint8Array(encoded.length + 1);
  body[0] = 3;
  body.set(encoded, 1);
  return frame(id, body);
};

const commentFrame = (value: string): Uint8Array | null => {
  if (!value.trim()) return null;
  const text = utf8.encode(value);
  const body = new Uint8Array(1 + 3 + 1 + text.length);
  body[0] = 3;
  body[1] = 0x65;
  body[2] = 0x6e;
  body[3] = 0x67;
  body[4] = 0;
  body.set(text, 5);
  return frame('COMM', body);
};

const coverFrame = (cover: Id3Cover): Uint8Array => {
  const mime = utf8.encode(cover.mime);
  const body = new Uint8Array(1 + mime.length + 1 + 1 + 1 + cover.bytes.length);
  let offset = 0;
  body[offset++] = 3;
  body.set(mime, offset);
  offset += mime.length;
  body[offset++] = 0;
  body[offset++] = 3;
  body[offset++] = 0;
  body.set(cover.bytes, offset);
  return frame('APIC', body);
};

export function buildId3(tags: Id3Tags): Uint8Array {
  const frames: Uint8Array[] = [];
  const push = (part: Uint8Array | null): void => {
    if (part) frames.push(part);
  };
  push(textFrame('TIT2', tags.title));
  push(textFrame('TPE1', tags.artist));
  push(textFrame('TALB', tags.album));
  push(textFrame('TDRC', tags.year));
  push(textFrame('TCON', tags.genre));
  push(textFrame('TRCK', tags.track));
  push(commentFrame(tags.comment));
  if (tags.cover) push(coverFrame(tags.cover));
  const contentSize = frames.reduce((total, part) => total + part.length, 0);
  const padding = 1024;
  const headerSize = contentSize + padding;
  const header = new Uint8Array(10);
  header[0] = 0x49;
  header[1] = 0x44;
  header[2] = 0x33;
  header[3] = 4;
  header[4] = 0;
  header[5] = 0;
  const safe = syncSafe(headerSize);
  header[6] = (safe >>> 21) & 0x7f;
  header[7] = (safe >>> 14) & 0x7f;
  header[8] = (safe >>> 7) & 0x7f;
  header[9] = safe & 0x7f;
  const result = new Uint8Array(10 + headerSize);
  result.set(header, 0);
  let offset = 10;
  for (const part of frames) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}
