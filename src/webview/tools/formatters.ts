/** Formatters: JSON, SQL, XML. */
import {
  area,
  btn,
  checkbox,
  copyBtn,
  downloadBtn,
  errorSlot,
  field,
  note,
  pane,
  segmented,
  setError,
  split,
  stats,
  table,
  toolbar,
} from '../components.ts';
import { h } from '../dom.ts';
import { defineTool } from '../tool-types.ts';
import { locateJsonError } from '../lib/json.ts';

function jsonError(input: string, error: Error): string {
  if (/\(line \d+ column \d+\)/.test(error.message)) return error.message;
  const match = /position (\d+)/.exec(error.message);
  if (match) {
    const position = Number(match[1]);
    const before = input.slice(0, position);
    const line = before.split('\n').length;
    const column = position - before.lastIndexOf('\n');
    return `${error.message} (line ${line}, column ${column})`;
  }
  const located = locateJsonError(input);
  if (!located) return error.message;
  return `${located.message} (line ${located.line}, column ${located.column})`;
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) sorted[key] = sortValue(source[key]);
    return sorted;
  }
  return value;
}

function jsonFormatterTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'formatters-json',
    group: 'formatters',
    icon: '<path d="M8 4a2 2 0 0 0 -2 2v4a2 2 0 0 1 -2 2a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2"/><path d="M16 4a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2a2 2 0 0 0 -2 2v4a2 2 0 0 1 -2 2"/>',
    name: { en: 'JSON Formatter', ru: 'JSON: форматирование' },
    desc: {
      en: 'Beautify, minify, sort and validate JSON with precise error positions.',
      ru: 'Форматирование, минификация, сортировка и проверка JSON с указанием позиции ошибки.',
    },
    keywords: 'json format beautify minify validate sort',
    mount(root, ctx) {
      const input = area({ rows: 16, value: '{"name":"dev-tools","versions":[1,2],"meta":{"stable":true,"tags":["json","yaml"]}}' });
      const output = area({ readOnly: true, rows: 16 });
      const error = errorSlot();
      const info = h('div');
      let sortKeys = false;
      let indent = '2';

      const indentSelect = segmented(
        [
          { value: '2', label: '2', title: ctx.pick('2 spaces', '2 пробела') },
          { value: '4', label: '4', title: ctx.pick('4 spaces', '4 пробела') },
          { value: 'tab', label: ctx.pick('Tab', 'Таб'), title: ctx.pick('Tabs', 'Табуляция') },
        ],
        indent,
        (value) => {
          indent = value;
          render('format');
        },
      );

      const render = (mode: 'format' | 'minify' | 'escape') => {
        try {
          const parsed: unknown = JSON.parse(input.value);
          setError(error, null);
          const prepared = sortKeys ? sortValue(parsed) : parsed;
          const padding = indent === 'tab' ? '\t' : Number(indent);
          output.value =
            mode === 'format'
              ? JSON.stringify(prepared, null, padding)
              : mode === 'minify'
                ? JSON.stringify(prepared)
                : JSON.stringify(JSON.stringify(prepared));
          const statsText = `${input.value.length} → ${output.value.length}`;
          info.replaceChildren(
            stats([
              [ctx.pick('Input length', 'Длина входа'), input.value.length],
              [ctx.pick('Output length', 'Длина выхода'), output.value.length],
              [ctx.pick('Saved', 'Экономия'), statsText],
              [ctx.pick('Valid JSON', 'Корректный JSON'), ctx.pick('yes', 'да')],
            ]),
          );
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : String(cause);
          setError(error, jsonError(input.value, cause instanceof Error ? cause : new Error(message)));
          output.value = '';
          info.replaceChildren();
        }
      };

      input.addEventListener('input', () => render('format'));

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          toolbar(
            btn(ctx.pick('Format', 'Форматировать'), () => render('format'), { variant: 'primary' }),
            btn(ctx.pick('Minify', 'Минифицировать'), () => render('minify')),
            btn(ctx.pick('Sort keys', 'Сортировать ключи'), () => {
              sortKeys = true;
              render('format');
            }),
            btn(ctx.pick('To string literal', 'В строковый литерал'), () => render('escape')),
            indentSelect,
            checkbox(ctx.pick('Sort keys on format', 'Сортировать ключи при форматировании'), false, (value) => {
              sortKeys = value;
            }),
            copyBtn(() => output.value),
            downloadBtn(() => output.value, 'formatted.json'),
          ),
          error,
          split(pane('JSON', input, [copyBtn(() => input.value)]), pane(ctx.pick('Result', 'Результат'), output)),
          info,
        ),
      );
      render('format');
    },
  });
}

const SQL_BREAK = new Set([
  'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET',
  'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM', 'JOIN', 'LEFT JOIN',
  'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN', 'CROSS JOIN', 'UNION', 'UNION ALL', 'ON',
]);

const SQL_KEYWORDS = new Set([
  ...SQL_BREAK,
  'AND', 'OR', 'NOT', 'NULL', 'IS', 'IN', 'AS', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'CREATE', 'TABLE', 'ALTER', 'DROP',
  'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'DEFAULT', 'ASC', 'DESC', 'EXISTS', 'LIKE',
]);

function tokenizeSql(sql: string): string[] {
  const tokens: string[] = [];
  let index = 0;
  while (index < sql.length) {
    const char = sql[index];
    if (/\s/.test(char)) {
      index++;
      continue;
    }
    if (char === '-' && sql[index + 1] === '-') {
      const end = sql.indexOf('\n', index);
      tokens.push(sql.slice(index, end === -1 ? sql.length : end));
      index = end === -1 ? sql.length : end;
      continue;
    }
    if (char === '/' && sql[index + 1] === '*') {
      const end = sql.indexOf('*/', index + 2);
      tokens.push(sql.slice(index, end === -1 ? sql.length : end + 2));
      index = end === -1 ? sql.length : end + 2;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      let end = index + 1;
      while (end < sql.length) {
        if (sql[end] === char) {
          if (sql[end + 1] === char) {
            end += 2;
            continue;
          }
          end++;
          break;
        }
        end++;
      }
      tokens.push(sql.slice(index, end));
      index = end;
      continue;
    }
    if (/[A-Za-z_@]/.test(char)) {
      let end = index + 1;
      while (end < sql.length && /[\w$@.]/.test(sql[end])) end++;
      tokens.push(sql.slice(index, end));
      index = end;
      continue;
    }
    if (/\d/.test(char)) {
      let end = index + 1;
      while (end < sql.length && /[\d.]/.test(sql[end])) end++;
      tokens.push(sql.slice(index, end));
      index = end;
      continue;
    }
    tokens.push(char);
    index++;
  }
  return tokens;
}

function formatSql(sql: string, indentSize: number, uppercase: boolean): string {
  const tokens = tokenizeSql(sql);
  // Merge multi-word keywords into single tokens.
  const merged: string[] = [];
  for (let index = 0; index < tokens.length; index++) {
    const word = tokens[index].toUpperCase();
    const next = (tokens[index + 1] ?? '').toUpperCase();
    if ((word === 'GROUP' || word === 'ORDER' || word === 'UNION') && next === 'BY') {
      merged.push(`${word} BY`);
      index++;
      continue;
    }
    if (word === 'UNION' && next === 'ALL') {
      merged.push('UNION ALL');
      index++;
      continue;
    }
    if (['LEFT', 'RIGHT', 'INNER', 'OUTER', 'CROSS'].includes(word) && next === 'JOIN') {
      merged.push(`${word} JOIN`);
      index++;
      continue;
    }
    if (word === 'INSERT' && next === 'INTO') {
      merged.push('INSERT INTO');
      index++;
      continue;
    }
    if (word === 'DELETE' && next === 'FROM') {
      merged.push('DELETE FROM');
      index++;
      continue;
    }
    merged.push(tokens[index]);
  }

  let output = '';
  let depth = 0;
  let clause = '';
  let lineStart = true;

  const write = (text: string, indentLevel: number) => {
    if (lineStart) {
      output += ' '.repeat(Math.max(0, indentLevel) * indentSize);
      lineStart = false;
    }
    output += text;
  };
  const newLine = () => {
    output = output.replace(/[ \t]+$/, '');
    if (!output.endsWith('\n')) output += '\n';
    lineStart = true;
  };

  for (let index = 0; index < merged.length; index++) {
    const token = merged[index];
    const upper = token.toUpperCase();
    const isKeyword = SQL_KEYWORDS.has(upper);

    if (upper === '(') {
      write(token, depth);
      depth++;
      continue;
    }
    if (upper === ')') {
      depth = Math.max(0, depth - 1);
      write(token, depth);
      continue;
    }
    if (upper === ';') {
      write(token, depth);
      newLine();
      clause = '';
      continue;
    }
    if (SQL_BREAK.has(upper)) {
      if (!lineStart) newLine();
      clause = upper;
      write(uppercase ? upper : token, depth);
      lineStart = false;
      continue;
    }
    if (upper === ',' && (clause === 'SELECT' || clause === 'GROUP BY' || clause === 'ORDER BY')) {
      write(token, depth);
      newLine();
      continue;
    }
    if (upper === 'AND' || upper === 'OR') {
      newLine();
      write(uppercase ? upper : token, depth + 1);
      continue;
    }

    const text = isKeyword && uppercase ? upper : token;
    const previous = output.slice(-1);
    if (previous && !/[\s(.]/.test(previous) && previous !== ',') output += ' ';
    const continuation = clause === 'SELECT' || clause === 'DELETE FROM' || clause === 'GROUP BY' || clause === 'ORDER BY';
    write(text, depth + (continuation ? 1 : 0));
  }

  return output
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sqlFormatterTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'formatters-sql',
    group: 'formatters',
    icon: '<path d="M12 3c4.97 0 9 1.34 9 3s-4.03 3 -9 3s-9 -1.34 -9 -3s4.03 -3 9 -3z"/><path d="M3 6v6c0 1.66 4.03 3 9 3s9 -1.34 9 -3v-6"/><path d="M3 12v6c0 1.66 4.03 3 9 3s9 -1.34 9 -3v-6"/>',
    name: { en: 'SQL Formatter', ru: 'SQL: форматирование' },
    desc: {
      en: 'Pretty-print SQL queries with clause-aware indentation.',
      ru: 'Форматирование SQL-запросов с учётом структуры и отступов.',
    },
    keywords: 'sql format prettify query database',
    mount(root, ctx) {
      const input = area({ rows: 16, value: 'select u.id, u.name, count(o.id) as orders from users u left join orders o on o.user_id = u.id where u.active = 1 and u.created_at > \'2024-01-01\' group by u.id, u.name order by orders desc limit 10;' });
      const output = area({ readOnly: true, rows: 16 });
      const error = errorSlot();
      let uppercase = true;
      let indent = 2;

      const update = () => {
        try {
          output.value = formatSql(input.value, indent, uppercase);
          setError(error, null);
        } catch (cause) {
          setError(error, cause instanceof Error ? cause.message : String(cause));
        }
      };
      input.addEventListener('input', update);

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          toolbar(
            btn(ctx.pick('Format', 'Форматировать'), update, { variant: 'primary' }),
            btn(ctx.pick('Minify', 'Минифицировать'), () => {
              output.value = input.value.replace(/\s+/g, ' ').trim();
            }),
            segmented(
              [
                { value: '2', label: '2', title: ctx.pick('2 spaces', '2 пробела') },
                { value: '4', label: '4', title: ctx.pick('4 spaces', '4 пробела') },
              ],
              '2',
              (value) => {
                indent = Number(value);
                update();
              },
            ),
            checkbox(ctx.pick('Uppercase keywords', 'Ключевые слова заглавными'), true, (value) => {
              uppercase = value;
              update();
            }),
            copyBtn(() => output.value),
            downloadBtn(() => output.value, 'query.sql'),
          ),
          error,
          split(pane('SQL', input), pane(ctx.pick('Result', 'Результат'), output)),
        ),
      );
      update();
    },
  });
}

function escapeXmlText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function prettyXml(node: Node, indent = '  '): string {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.nodeValue ?? '').trim();
    return text ? `${indent}${escapeXmlText(text)}\n` : '';
  }
  if (node.nodeType === Node.COMMENT_NODE) return `${indent}<!--${node.nodeValue ?? ''}-->\n`;
  if (node.nodeType === Node.PROCESSING_INSTRUCTION_NODE) return `${indent}<?${node.nodeName} ${node.nodeValue ?? ''}?>\n`;
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const element = node as Element;
  const attributes = Array.from(element.attributes)
    .map((attribute) => ` ${attribute.name}="${attribute.value}"`)
    .join('');
  const children = Array.from(element.childNodes).filter(
    (child) => child.nodeType !== Node.TEXT_NODE || (child.nodeValue ?? '').trim(),
  );
  if (!children.length) return `${indent}<${element.tagName}${attributes}/>\n`;
  if (children.length === 1 && children[0].nodeType === Node.TEXT_NODE) {
    return `${indent}<${element.tagName}${attributes}>${escapeXmlText((children[0].nodeValue ?? '').trim())}</${element.tagName}>\n`;
  }
  const inner = children.map((child) => prettyXml(child, indent + '  ')).join('');
  return `${indent}<${element.tagName}${attributes}>\n${inner}${indent}</${element.tagName}>\n`;
}

function xmlFormatterTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'formatters-xml',
    group: 'formatters',
    icon: '<path d="M8 7l-5 5l5 5"/><path d="M16 7l5 5l-5 5"/><path d="M13 5l-2 14"/>',
    name: { en: 'XML Formatter', ru: 'XML: форматирование' },
    desc: {
      en: 'Validate and pretty-print XML documents with a structure summary.',
      ru: 'Проверка и форматирование XML-документов со сводкой структуры.',
    },
    keywords: 'xml format pretty print validate',
    mount(root, ctx) {
      const input = area({ rows: 16, value: '<?xml version="1.0" encoding="UTF-8"?><catalog><book id="1"><title>Dev Tools</title><price>0</price></book><book id="2"><title>Regex</title></book></catalog>' });
      const output = area({ readOnly: true, rows: 16 });
      const error = errorSlot();
      const summary = h('div');

      const parse = (): Document | null => {
        const document = new DOMParser().parseFromString(input.value, 'application/xml');
        const parserError = document.querySelector('parsererror');
        if (parserError) {
          setError(error, parserError.textContent?.trim() ?? 'Invalid XML');
          return null;
        }
        setError(error, null);
        return document;
      };

      const update = () => {
        const document = parse();
        if (!document) {
          output.value = '';
          summary.replaceChildren();
          return;
        }
        output.value = `<?xml version="1.0" encoding="UTF-8"?>\n${prettyXml(document.documentElement)}`.trimEnd();
        const elements = document.getElementsByTagName('*').length;
        const attributes = Array.from(document.getElementsByTagName('*')).reduce(
          (sum, element) => sum + element.attributes.length,
          0,
        );
        summary.replaceChildren(
          stats([
            [ctx.pick('Root element', 'Корневой элемент'), document.documentElement.tagName],
            [ctx.pick('Elements', 'Элементов'), elements],
            [ctx.pick('Attributes', 'Атрибутов'), attributes],
            [ctx.pick('Size', 'Размер'), `${new TextEncoder().encode(input.value).length} B`],
          ]),
        );
      };

      input.addEventListener('input', update);
      update();

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          toolbar(
            btn(ctx.pick('Format', 'Форматировать'), update, { variant: 'primary' }),
            btn(ctx.pick('Minify', 'Минифицировать'), () => {
              const document = parse();
              if (!document) return;
              output.value = new XMLSerializer().serializeToString(document).replace(/>\s+</g, '><');
            }),
            copyBtn(() => output.value),
            downloadBtn(() => output.value, 'formatted.xml'),
          ),
          error,
          split(pane('XML', input), pane(ctx.pick('Result', 'Результат'), output)),
          summary,
        ),
      );
    },
  });
}

export const formatterTools = [jsonFormatterTool(), sqlFormatterTool(), xmlFormatterTool()];
