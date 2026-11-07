/** Escape / unescape helpers for common formats. */

export type EscapeKind =
  | 'json'
  | 'html'
  | 'xml'
  | 'url'
  | 'csharp'
  | 'sql'
  | 'csv'
  | 'shell'
  | 'regex'
  | 'unicode'
  | 'backslash';

const HTML_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const XML_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

function decodeEntities(value: string): string {
  const helper = document.createElement('textarea');
  helper.innerHTML = value;
  return helper.value;
}

export function escapeText(value: string, kind: EscapeKind, fullUrl = false): string {
  switch (kind) {
    case 'json':
      return JSON.stringify(value).slice(1, -1);
    case 'html':
      return value.replace(/[&<>"']/g, (char) => HTML_MAP[char]);
    case 'xml':
      return value.replace(/[&<>"']/g, (char) => XML_MAP[char]);
    case 'url':
      return fullUrl ? encodeURI(value) : encodeURIComponent(value);
    case 'csharp':
      return value
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n')
        .replace(/\t/g, '\\t')
        .replace(/\0/g, '\\0');
    case 'sql':
      return value.replace(/'/g, "''");
    case 'csv':
      return `"${value.replace(/"/g, '""')}"`;
    case 'shell':
      return `'${value.replace(/'/g, "'\\''")}'`;
    case 'regex':
      return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    case 'unicode':
      return Array.from(value)
        .map((char) => {
          const code = char.codePointAt(0) ?? 0;
          if (code > 0xffff) {
            const high = Math.floor((code - 0x10000) / 0x400) + 0xd800;
            const low = ((code - 0x10000) % 0x400) + 0xdc00;
            return `\\u${high.toString(16).padStart(4, '0')}\\u${low.toString(16).padStart(4, '0')}`;
          }
          if (code < 0x20 || code > 0x7e) return `\\u${code.toString(16).padStart(4, '0')}`;
          return char;
        })
        .join('');
    case 'backslash':
      return value
        .replace(/\\/g, '\\\\')
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n')
        .replace(/\t/g, '\\t');
    default:
      return value;
  }
}

export function unescapeText(value: string, kind: EscapeKind, fullUrl = false): string {
  switch (kind) {
    case 'json': {
      try {
        return JSON.parse(`"${value.replace(/"/g, '\\"')}"`) as string;
      } catch {
        return value
          .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\');
      }
    }
    case 'html':
    case 'xml':
      return decodeEntities(value);
    case 'url':
      return fullUrl ? decodeURI(value) : decodeURIComponent(value);
    case 'csharp':
      return value
        .replace(/\\r/g, '\r')
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\0/g, '\0')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
    case 'sql':
      return value.replace(/''/g, "'");
    case 'csv':
      return value.replace(/^"|"$/g, '').replace(/""/g, '"');
    case 'shell':
      return value.replace(/^'|'$/g, '').replace(/'\\''/g, "'");
    case 'regex':
      return value.replace(/\\(.)/g, '$1');
    case 'unicode':
      return value
        .replace(/\\u\{([0-9a-fA-F]{1,6})\}/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
        .replace(/\\u([0-9a-fA-F]{4})\\u([0-9a-fA-F]{4})/g, (_, high: string, low: string) =>
          String.fromCharCode(parseInt(high, 16), parseInt(low, 16)),
        )
        .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
    case 'backslash':
      return value
        .replace(/\\r/g, '\r')
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\\\/g, '\\');
    default:
      return value;
  }
}
