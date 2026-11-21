/** Media metadata: view and edit title, author, dates and geo location; embed XMP/ID3 or export JSON. */
import {
  btn,
  downloadBlob,
  errorSlot,
  field,
  fileDrop,
  note,
  pane,
  readArrayBuffer,
  setError,
  split,
  textInput,
  toolbar,
} from '../components.ts';
import { escapeHtml, h } from '../dom.ts';
import { incomingToFile, bytesToArrayBuffer } from '../lib/incoming.ts';
import { buildId3, emptyTags, hasTags, parseId3 } from '../lib/id3.ts';
import { defineTool } from '../tool-types.ts';

type MediaKind = 'jpeg' | 'png' | 'mp3' | 'video' | 'other';

interface MediaFile {
  name: string;
  kind: MediaKind;
  bytes: Uint8Array;
  mime: string;
}

interface MetaFields {
  title: string;
  author: string;
  description: string;
  created: string;
  city: string;
  latitude: string;
  longitude: string;
}

const ascii = (bytes: Uint8Array, from: number, length: number): string => {
  let result = '';
  for (let index = 0; index < length && from + index < bytes.length; index++) {
    result += String.fromCharCode(bytes[from + index]);
  }
  return result;
};

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index++) {
    let value = index;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
})();

const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

const XMP_NAMESPACE = 'http://ns.adobe.com/xap/1.0/';

const buildXmp = (fields: MetaFields): Uint8Array => {
  const latitude = Number(fields.latitude);
  const longitude = Number(fields.longitude);
  const geo =
    Number.isFinite(latitude) && Number.isFinite(longitude) && (latitude || longitude)
      ? `<exif:GPSLatitude>${escapeHtml(fields.latitude)}</exif:GPSLatitude>
   <exif:GPSLongitude>${escapeHtml(fields.longitude)}</exif:GPSLongitude>
   <exif:GPSLatitudeRef>${latitude >= 0 ? 'N' : 'S'}</exif:GPSLatitudeRef>
   <exif:GPSLongitudeRef>${longitude >= 0 ? 'E' : 'W'}</exif:GPSLongitudeRef>`
      : '';
  const xml = `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
   xmlns:dc="http://purl.org/dc/elements/1.1/"
   xmlns:xmp="http://ns.adobe.com/xap/1.0/"
   xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"
   xmlns:exif="http://ns.adobe.com/exif/1.0/">
   <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${escapeHtml(fields.title)}</rdf:li></rdf:Alt></dc:title>
   <dc:creator><rdf:Seq><rdf:li>${escapeHtml(fields.author)}</rdf:li></rdf:Seq></dc:creator>
   <dc:description><rdf:Alt><rdf:li xml:lang="x-default">${escapeHtml(fields.description)}</rdf:li></rdf:Alt></dc:description>
   <xmp:CreateDate>${escapeHtml(fields.created)}</xmp:CreateDate>
   <photoshop:City>${escapeHtml(fields.city)}</photoshop:City>
   ${geo}
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
  return new TextEncoder().encode(xml);
};

const insertJpegXmp = (bytes: Uint8Array, xmp: Uint8Array): Uint8Array => {
  const header = new TextEncoder().encode(`${XMP_NAMESPACE}\0`);
  const payloadLength = header.length + xmp.length;
  if (payloadLength + 2 > 0xffff) throw new Error('XMP payload is too large for JPEG.');
  const app1 = new Uint8Array(4 + payloadLength);
  app1[0] = 0xff;
  app1[1] = 0xe1;
  const size = payloadLength + 2;
  app1[2] = (size >> 8) & 0xff;
  app1[3] = size & 0xff;
  app1.set(header, 4);
  app1.set(xmp, 4 + header.length);

  const parts: Uint8Array[] = [bytes.subarray(0, 2)];
  let offset = 2;
  while (offset + 4 <= bytes.length && bytes[offset] === 0xff) {
    const marker = bytes[offset + 1];
    if (marker === 0xda) break;
    const segmentSize = (bytes[offset + 2] << 8) | bytes[offset + 3];
    const end = offset + 2 + segmentSize;
    const namespace = ascii(bytes, offset + 4, XMP_NAMESPACE.length + 1);
    const isXmp = marker === 0xe1 && namespace === `${XMP_NAMESPACE}\0`;
    if (!isXmp) parts.push(bytes.subarray(offset, end));
    offset = end;
  }
  parts.splice(1, 0, app1);
  parts.push(bytes.subarray(offset));
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let position = 0;
  for (const part of parts) {
    output.set(part, position);
    position += part.length;
  }
  return output;
};

const pngChunk = (type: string, data: Uint8Array): Uint8Array => {
  const result = new Uint8Array(12 + data.length);
  const view = new DataView(result.buffer);
  view.setUint32(0, data.length, false);
  for (let index = 0; index < 4; index++) result[4 + index] = type.charCodeAt(index);
  result.set(data, 8);
  view.setUint32(8 + data.length, crc32(result.subarray(4, 8 + data.length)), false);
  return result;
};

const insertPngXmp = (bytes: Uint8Array, xmp: Uint8Array): Uint8Array => {
  const keyword = new TextEncoder().encode('XML:com.adobe.xmp');
  const data = new Uint8Array(keyword.length + 5 + xmp.length);
  data.set(keyword, 0);
  let offset = keyword.length;
  data[offset++] = 0;
  data[offset++] = 0;
  data[offset++] = 0;
  data[offset++] = 0;
  data[offset++] = 0;
  data.set(xmp, offset);
  const chunk = pngChunk('iTXt', data);

  const withoutExisting: Uint8Array[] = [bytes.subarray(0, 8)];
  let position = 8;
  while (position + 12 <= bytes.length) {
    const length = ((bytes[position] << 24) | (bytes[position + 1] << 16) | (bytes[position + 2] << 8) | bytes[position + 3]) >>> 0;
    const type = ascii(bytes, position + 4, 4);
    const end = position + 12 + length;
    if (end > bytes.length) break;
    const isXmp =
      type === 'iTXt' &&
      ascii(bytes, position + 8, 'XML:com.adobe.xmp'.length) === 'XML:com.adobe.xmp';
    if (!isXmp) withoutExisting.push(bytes.subarray(position, end));
    position = end;
    if (type === 'IEND') break;
  }
  if (position < bytes.length) withoutExisting.push(bytes.subarray(position));
  const parts: Uint8Array[] = [];
  for (let index = 0; index < withoutExisting.length; index++) {
    parts.push(withoutExisting[index]);
    if (index === 1 && ascii(withoutExisting[0], 0, 8) === '\x89PNG\r\n\x1a\n') parts.push(chunk);
  }
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let cursor = 0;
  for (const part of parts) {
    output.set(part, cursor);
    cursor += part.length;
  }
  return output;
};

const decodeEntities = (value: string): string =>
  value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');

const readXmp = (bytes: Uint8Array): Partial<MetaFields> => {
  const text = new TextDecoder('utf-8').decode(bytes);
  if (!text.includes('x:xmpmeta')) return {};
  const pick = (pattern: RegExp): string => {
    const match = pattern.exec(text);
    return match ? decodeEntities(match[1].trim()) : '';
  };
  return {
    title: pick(/<dc:title>[\s\S]*?<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/),
    author: pick(/<dc:creator>[\s\S]*?<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/),
    description: pick(/<dc:description>[\s\S]*?<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/),
    created: pick(/<xmp:CreateDate>([\s\S]*?)<\/xmp:CreateDate>/),
    city: pick(/<photoshop:City>([\s\S]*?)<\/photoshop:City>/),
    latitude: pick(/<exif:GPSLatitude>([\s\S]*?)<\/exif:GPSLatitude>/),
    longitude: pick(/<exif:GPSLongitude>([\s\S]*?)<\/exif:GPSLongitude>/),
  };
};

function mediaMetadataTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'media-metadata',
    group: 'media',
    icon: '<path d="M5 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2z"/><path d="M12 3v8"/><path d="M9 8l3 3l3 -3"/><path d="M8 16h8"/>',
    name: { en: 'Media Metadata', ru: 'Метаданные файлов' },
    desc: {
      en: 'View and edit title, author, creation date and location; embed XMP into JPEG/PNG, ID3 into MP3 or export JSON.',
      ru: 'Просмотр и редактирование названия, автора, даты и геолокации; XMP для JPEG/PNG, ID3 для MP3 или JSON.',
    },
    keywords: 'metadata exif xmp id3 photo video author created date gps location google yandex maps',
    mount(root, ctx) {
      let media: MediaFile | null = null;
      let previewUrl = '';
      const fields: MetaFields = { title: '', author: '', description: '', created: '', city: '', latitude: '', longitude: '' };

      const error = errorSlot();
      const preview = h('div', { class: 'dt-meta-preview' });
      const stats = h('div', { class: 'dt-stats' });
      const nameLabel = h('div', { class: 'dt-hint' });

      const input = (label: [string, string], key: keyof MetaFields, type = 'text'): HTMLElement =>
        field(
          ctx.pick(label[0], label[1]),
          textInput({
            type,
            value: fields[key],
            oninput: (value) => {
              fields[key] = value;
            },
          }),
        );

      const openExternal = async (url: string): Promise<void> => {
        try {
          await ctx.rpc('openExternal', { url });
        } catch {
          window.open(url, '_blank', 'noopener');
        }
      };

      const detectKind = (file: File): MediaKind => {
        const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
        if (extension === 'jpg' || extension === 'jpeg') return 'jpeg';
        if (extension === 'png') return 'png';
        if (extension === 'mp3') return 'mp3';
        if (['mp4', 'mov', 'webm', 'mkv', 'avi', 'gif'].includes(extension)) return 'video';
        return 'other';
      };

      const load = (file: File): void => {
        setError(error, null);
        void readArrayBuffer(file)
          .then((data) => {
            const bytes = new Uint8Array(data.slice(0));
            const kind = detectKind(file);
            media = { name: file.name, kind, bytes, mime: file.type };
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            previewUrl = URL.createObjectURL(new Blob([bytes], { type: file.type }));
            preview.replaceChildren();
            if (kind === 'jpeg' || kind === 'png') {
              preview.appendChild(h('img', { src: previewUrl, class: 'dt-meta-media', alt: '' }));
            } else if (kind === 'video') {
              preview.appendChild(h('video', { src: previewUrl, class: 'dt-meta-media', controls: true }));
            } else {
              preview.appendChild(
                h(
                  'div',
                  { class: 'dt-hint' },
                  file.type.startsWith('audio/') ? ctx.pick('Audio file', 'Аудиофайл') : file.name,
                ),
              );
            }
            nameLabel.textContent = `${file.name} · ${(bytes.length / 1024).toFixed(1)} KB · ${file.type || 'unknown'}`;
            const box: string[] = [];
            if (kind === 'jpeg' || kind === 'png') {
              const image = new Image();
              image.onload = () => {
                box.push(`${image.naturalWidth} × ${image.naturalHeight}`);
                stats.replaceChildren(...box.map((text) => h('div', { class: 'dt-stat' }, h('div', { class: 'dt-stat-value' }, text), h('div', { class: 'dt-stat-label' }, ctx.pick('Size', 'Размер')))));
              };
              image.src = previewUrl;
            }
            if (kind === 'mp3') {
              const parsed = parseId3(bytes);
              if (parsed) {
                fields.title = parsed.title;
                fields.author = parsed.artist;
                fields.description = parsed.comment;
                fields.created = parsed.year;
              }
            } else {
              Object.assign(fields, readXmp(bytes));
            }
            rebuildFields();
          })
          .catch(() => setError(error, ctx.pick('Cannot read this file.', 'Не удалось прочитать файл.')));
      };

      const fieldsHost = h('div', { class: 'dt-stack' });
      let rebuildFields = (): void => {
        fieldsHost.replaceChildren();
      };

      const applyMetadata = async (): Promise<void> => {
        if (!media) {
          setError(error, ctx.pick('Load a file first.', 'Сначала загрузите файл.'));
          return;
        }
        const base = media.name.replace(/\.[^.]+$/, '') || 'file';
        try {
          if (media.kind === 'jpeg') {
            downloadBlob(
              `${base}-metadata.jpg`,
              new Blob([bytesToArrayBuffer(insertJpegXmp(media.bytes, buildXmp(fields)))], { type: 'image/jpeg' }),
            );
            return;
          }
          if (media.kind === 'png') {
            downloadBlob(
              `${base}-metadata.png`,
              new Blob([bytesToArrayBuffer(insertPngXmp(media.bytes, buildXmp(fields)))], { type: 'image/png' }),
            );
            return;
          }
          if (media.kind === 'mp3') {
            const existing = parseId3(media.bytes);
            const tags = existing ?? emptyTags();
            tags.title = fields.title;
            tags.artist = fields.author;
            tags.comment = fields.description;
            tags.year = fields.created.slice(0, 4) || tags.year;
            if (!hasTags(tags)) {
              downloadBlob(`${base}-metadata.mp3`, new Blob([bytesToArrayBuffer(media.bytes)], { type: 'audio/mpeg' }));
              return;
            }
            const tagBytes = buildId3(tags);
            let audioOffset = 0;
            if (media.bytes[0] === 0x49 && media.bytes[1] === 0x44 && media.bytes[2] === 0x33) {
              const size =
                ((media.bytes[6] & 0x7f) << 21) |
                ((media.bytes[7] & 0x7f) << 14) |
                ((media.bytes[8] & 0x7f) << 7) |
                (media.bytes[9] & 0x7f);
              audioOffset = 10 + size;
            }
            const audio = media.bytes.subarray(audioOffset);
            const merged = new Uint8Array(tagBytes.length + audio.length);
            merged.set(tagBytes, 0);
            merged.set(audio, tagBytes.length);
            downloadBlob(`${base}-metadata.mp3`, new Blob([bytesToArrayBuffer(merged)], { type: 'audio/mpeg' }));
            return;
          }
          const json = JSON.stringify({ ...fields, file: media.name }, null, 2);
          downloadBlob(`${base}.metadata.json`, new Blob([json], { type: 'application/json' }));
          setError(
            error,
            ctx.pick(
              'This format has no writable tag container in the webview; a JSON sidecar was exported.',
              'Для этого формата в webview нет записываемых тегов; экспортирован JSON sidecar.',
            ),
          );
        } catch {
          setError(error, ctx.pick('Metadata export failed.', 'Не удалось сохранить метаданные.'));
        }
      };

      const openMap = (provider: 'google' | 'yandex' | 'osm'): void => {
        const lat = Number(fields.latitude);
        const lng = Number(fields.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || (!lat && !lng)) {
          setError(error, ctx.pick('Enter latitude and longitude first.', 'Сначала укажите широту и долготу.'));
          return;
        }
        const url =
          provider === 'google'
            ? `https://www.google.com/maps?q=${lat},${lng}`
            : provider === 'yandex'
              ? `https://yandex.ru/maps/?pt=${lng},${lat}&z=13&l=map`
              : `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=14/${lat}/${lng}`;
        void openExternal(url);
      };

      rebuildFields = (): void => {
        fieldsHost.replaceChildren(
          input(['Title', 'Название'], 'title'),
          input(['Author', 'Автор'], 'author'),
          input(['Description', 'Описание'], 'description'),
          input(['Created (ISO date)', 'Дата создания (ISO)'], 'created', 'datetime-local'),
          input(['City / place', 'Город / место'], 'city'),
          h(
            'div',
            { class: 'dt-inline-form' },
            input(['Latitude', 'Широта'], 'latitude'),
            input(['Longitude', 'Долгота'], 'longitude'),
          ),
          toolbar(
            btn(ctx.pick('Google Maps', 'Google Карты'), () => openMap('google'), { variant: 'ghost' }),
            btn(ctx.pick('Yandex Maps', 'Яндекс Карты'), () => openMap('yandex'), { variant: 'ghost' }),
            btn(ctx.pick('OpenStreetMap', 'OpenStreetMap'), () => openMap('osm'), { variant: 'ghost' }),
          ),
          note(
            ctx.pick(
              'Maps open in your browser at the entered coordinates. JPEG/PNG get embedded XMP, MP3 gets ID3 tags.',
              'Карты открываются в браузере по указанным координатам. В JPEG/PNG встраивается XMP, в MP3 — ID3.',
            ),
            'info',
          ),
          btn(ctx.pick('Download with metadata', 'Скачать с метаданными'), () => void applyMetadata(), { variant: 'primary' }),
        );
      };

      const upload = fileDrop({
        accept: 'image/*,video/*,audio/*,.mp3,.mp4,.mov,.png,.jpg,.jpeg',
        hint: ctx.pick('Drop an image, video or audio file', 'Перетащите изображение, видео или аудио'),
        onFiles: (files) => {
          if (files[0]) load(files[0]);
        },
      });

      rebuildFields();

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          error,
          upload,
          split(
            h(
              'div',
              { class: 'dt-col' },
              pane(ctx.pick('Preview', 'Предпросмотр'), h('div', { class: 'dt-stack' }, preview, nameLabel, stats)),
            ),
            h(
              'div',
              { class: 'dt-col' },
              pane(ctx.pick('Metadata', 'Метаданные'), fieldsHost),
            ),
          ),
        ),
      );

      const incoming = ctx.takeIncoming();
      if (incoming) load(incomingToFile(incoming));
    },
  });
}

export const mediaMetadataTools = [mediaMetadataTool()];
