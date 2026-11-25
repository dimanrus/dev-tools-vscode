/** Testers: JSONPath, regular expressions, XML/XSD. */
import { JSONPath } from 'jsonpath-plus';
import {
  area,
  badge,
  btn,
  checkbox,
  copyBtn,
  downloadBtn,
  errorSlot,
  field,
  note,
  pane,
  select,
  setError,
  split,
  stats,
  table,
  textInput,
  toolbar,
} from '../components.ts';
import { escapeHtml, h } from '../dom.ts';
import { defineTool } from '../tool-types.ts';

function jsonPathTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'testers-jsonpath',
    group: 'testers',
    icon: '<path d="M4 7h16"/><path d="M4 12h10"/><path d="M4 17h7"/><path d="M17 14l4 4l-4 4"/><path d="M21 18h-8"/>',
    name: { en: 'JSONPath Tester', ru: 'JSONPath' },
    desc: {
      en: 'Query JSON documents with JSONPath expressions and inspect matches.',
      ru: 'Поиск по JSON с помощью выражений JSONPath и просмотр совпадений.',
    },
    keywords: 'jsonpath json query filter test',
    mount(root, ctx) {
      const input = area({
        rows: 14,
        value: '{\n  "store": {\n    "book": [\n      { "title": "Dev Tools", "price": 0, "tags": ["tools"] },\n      { "title": "Regex", "price": 25, "tags": ["text"] }\n    ]\n  }\n}',
      });
      const path = h('input', { class: 'dt-input dt-mono', type: 'text', value: '$.store.book[*].title', spellcheck: false });
      const output = h('div');
      const error = errorSlot();
      const summary = h('div');

      const evaluate = () => {
        try {
          const document: unknown = JSON.parse(input.value);
          const values = JSONPath({ path: path.value, json: document as object, wrap: true }) as unknown[];
          setError(error, null);
          summary.replaceChildren(
            stats([
              [ctx.pick('Matches', 'Совпадений'), values.length],
              [ctx.pick('Path', 'Путь'), path.value || '—'],
            ]),
          );
          if (!values.length) {
            output.replaceChildren(note(ctx.pick('No matches', 'Совпадений нет'), 'warn'));
            return;
          }
          output.replaceChildren(
            table(
              ['#', ctx.pick('Type', 'Тип'), ctx.pick('Value', 'Значение')],
              values.map((value, index) => [
                String(index + 1),
                value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value,
                h('code', { class: 'dt-mono' }, typeof value === 'object' ? JSON.stringify(value) : String(value)),
              ]),
            ),
            pane('JSON', area({ readOnly: true, rows: 10, value: JSON.stringify(values.length === 1 ? values[0] : values, null, 2) }), [copyBtn(() => JSON.stringify(values, null, 2))]),
          );
        } catch (cause) {
          setError(error, cause instanceof Error ? cause.message : String(cause));
          output.replaceChildren();
          summary.replaceChildren();
        }
      };

      input.addEventListener('input', evaluate);
      path.addEventListener('input', evaluate);

      const examples = ['$.store.book[*].title', '$..price', '$.store.book[?(@.price > 10)].title', '$.store.book[*].tags[*]'];
      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          h('div', { class: 'dt-inline-form' }, field('JSONPath', path), h('div', { class: 'dt-inline-actions' }, btn(ctx.pick('Evaluate', 'Выполнить'), evaluate, { variant: 'primary' }))),
          h('div', { class: 'dt-chips' }, ...examples.map((example) => btn(example, () => {
            path.value = example;
            evaluate();
          }, { variant: 'subtle', class: 'dt-chip' }))),
          error,
          summary,
          split(pane(ctx.pick('JSON document', 'JSON-документ'), input), pane(ctx.pick('Matches', 'Совпадения'), output)),
        ),
      );
      evaluate();
    },
  });
}

const REGEX_EXAMPLES: Array<{ label: [string, string]; pattern: string; flags: string; sample: string }> = [
  { label: ['Email address', 'Email-адрес'], pattern: '[\\w.+-]+@[\\w-]+\\.[\\w.-]+', flags: 'g', sample: 'Contact: dev@example.com, support@dev.tools.' },
  { label: ['URL', 'URL'], pattern: 'https?://[^\\s]+', flags: 'g', sample: 'Docs https://example.com/docs and http://localhost:3000/api.' },
  { label: ['IPv4 address', 'IPv4-адрес'], pattern: '\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b', flags: 'g', sample: 'Gateway 192.168.0.1, DNS 8.8.8.8.' },
  { label: ['UUID', 'UUID'], pattern: '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', flags: 'gi', sample: 'id=3f2504e0-4f89-11d3-9a0c-0305e82c3301' },
  { label: ['ISO date', 'Дата ISO'], pattern: '(?<year>\\d{4})-(?<month>\\d{2})-(?<day>\\d{2})', flags: 'g', sample: 'Created 2026-11-21, updated 2026-12-01.' },
  { label: ['Time 24h', 'Время 24ч'], pattern: '\\b([01]?\\d|2[0-3]):([0-5]\\d)(?::([0-5]\\d))?\\b', flags: 'g', sample: 'Starts at 09:30 and ends at 18:45:10.' },
  { label: ['HEX color', 'HEX-цвет'], pattern: '#(?:[0-9a-f]{3}){1,2}\\b', flags: 'gi', sample: 'Colors: #fff, #3b82f6, #0f172a.' },
  { label: ['Phone (international)', 'Телефон (межд.)'], pattern: '\\+?\\d[\\d\\s().-]{7,}\\d', flags: 'g', sample: 'Call +1 (555) 123-4567 or +44 20 7946 0958.' },
  { label: ['Russian phone', 'Российский телефон'], pattern: '(?:\\+7|8)[\\s-]?\\(?\\d{3}\\)?[\\s-]?\\d{3}[\\s-]?\\d{2}[\\s-]?\\d{2}', flags: 'g', sample: '+7 (999) 123-45-67 и 8 800 555 35 35.' },
  { label: ['Hashtags', 'Хештеги'], pattern: '#(\\w+)', flags: 'g', sample: 'Post about #regex and #devtools.' },
  { label: ['Quoted strings', 'Строки в кавычках'], pattern: '"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"', flags: 'g', sample: 'He said "hello \\"world\\"" today.' },
  { label: ['HTML tag', 'HTML-тег'], pattern: '<(?<tag>[a-z][\\w-]*)\\b[^>]*>(.*?)</\\k<tag>>', flags: 'gis', sample: '<p class="lead">Hello</p><div>World</div>' },
  { label: ['JSON key-value', 'JSON ключ-значение'], pattern: '"(?<key>[^"]+)"\\s*:\\s*("(?<value>[^"]*)"|(?<number>-?\\d+(?:\\.\\d+)?))', flags: 'g', sample: '{"name": "Dev Tools", "version": 1.1}' },
  { label: ['Semver', 'Semver'], pattern: '\\b(\\d+)\\.(\\d+)\\.(\\d+)(?:-([0-9a-z.-]+))?\\b', flags: 'gi', sample: 'Uses 1.1.0 and 2.0.0-beta.1.' },
  { label: ['Cyrillic words', 'Кириллические слова'], pattern: '\\b[А-Яа-яЁё]{3,}\\b', flags: 'g', sample: 'Dev Tools — удобные инструменты разработчика.' },
  { label: ['Duplicate words', 'Повторяющиеся слова'], pattern: '\\b(\\w+)\\s+\\1\\b', flags: 'gi', sample: 'This is a a test with with duplicates.' },
  { label: ['Number with separators', 'Число с разделителями'], pattern: '\\b\\d{1,3}(?:[ ,]\\d{3})+(?:\\.\\d+)?\\b', flags: 'g', sample: 'Revenue 1 234 567 and 12,345.67.' },
];

const CHEATSHEET: Array<[string, string, string]> = [
  ['\\d', 'digit', 'цифра'],
  ['\\w', 'word character', 'словесный символ'],
  ['\\s', 'whitespace', 'пробельный символ'],
  ['^…$', 'start / end of string', 'начало / конец строки'],
  ['a*', 'zero or more', 'ноль или более'],
  ['a+', 'one or more', 'один или более'],
  ['a?', 'optional', 'необязательный'],
  ['a{2,4}', 'between 2 and 4', 'от 2 до 4'],
  ['[abc]', 'character set', 'набор символов'],
  ['[^abc]', 'negated set', 'отрицание набора'],
  ['(a|b)', 'alternation', 'альтернатива'],
  ['(?<name>…)', 'named group', 'именованная группа'],
  ['(?=…)', 'lookahead', 'опережающая проверка'],
  ['(?!…)', 'negative lookahead', 'негативная проверка'],
  ['(?<=…)', 'lookbehind', 'ретроспективная проверка'],
];

function regexTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'testers-regex',
    group: 'testers',
    icon: '<path d="M4 6h4l2 4l2 -4h4"/><path d="M9 10l-2 8"/><path d="M19 8l-4 8"/><path d="M14 20h4"/>',
    name: { en: 'Regular Expression Tester', ru: 'Тестер регулярных выражений' },
    desc: {
      en: 'Test patterns live, inspect groups, and preview replacements.',
      ru: 'Проверка шаблонов в реальном времени, группы и предпросмотр замены.',
    },
    keywords: 'regex regexp pattern match groups replace',
    mount(root, ctx) {
      const pattern = h('input', { class: 'dt-input dt-mono dt-grow', type: 'text', value: '(?<word>\\b\\w{4,}\\b)', spellcheck: false });
      const text = area({ rows: 8, value: 'Dev Tools makes developers happy. Happy coding!' });
      const replacement = textInput({ value: '<$&>', class: 'dt-mono' });
      const highlight = h('div', { class: 'dt-regex-highlight dt-mono' });
      const matchesHost = h('div');
      const groupsHost = h('div');
      const replaceHost = h('div');
      const error = errorSlot();
      const flags = new Set(['g']);

      const exampleSelect = select(
        [
          { value: 'custom', label: ctx.pick('Custom pattern', 'Свой шаблон') },
          ...REGEX_EXAMPLES.map((example, index) => ({
            value: String(index),
            label: ctx.pick(example.label[0], example.label[1]),
          })),
        ],
        'custom',
        (value) => {
          if (value === 'custom') return;
          const example = REGEX_EXAMPLES[Number(value)];
          if (!example) return;
          pattern.value = example.pattern;
          text.value = example.sample;
          flags.clear();
          for (const flag of example.flags) flags.add(flag);
          for (const input of Array.from(flagBar.querySelectorAll<HTMLInputElement>('input'))) {
            input.checked = flags.has(input.dataset.flag ?? '');
          }
          evaluate();
        },
      );

      const flagBar = h(
        'div',
        { class: 'dt-flags' },
        ...['g', 'i', 'm', 's', 'u'].map((flag) => {
          const input = h('input', {
            type: 'checkbox',
            class: 'dt-check',
            checked: flags.has(flag),
            dataset: { flag },
          });
          input.addEventListener('change', () => {
            if (input.checked) flags.add(flag);
            else flags.delete(flag);
            evaluate();
          });
          return h('label', { class: 'dt-flag' }, input, h('span', {}, flag));
        }),
      );

      const evaluate = () => {
        const flagString = [...flags].join('');
        try {
          const regex = new RegExp(pattern.value, flagString);
          setError(error, null);

          const global = new RegExp(pattern.value, flagString.includes('g') ? flagString : `${flagString}g`);
          const all = [...text.value.matchAll(global)];

          // Highlight view
          let cursor = 0;
          let html = '';
          for (const match of all) {
            const index = match.index ?? 0;
            html += escapeHtml(text.value.slice(cursor, index));
            html += `<mark class="dt-mark">${escapeHtml(match[0]) || '∅'}</mark>`;
            cursor = index + match[0].length;
          }
          html += escapeHtml(text.value.slice(cursor));
          highlight.innerHTML = html;

          statsHost(matchesHost, all);
          groupsHost.replaceChildren(...buildGroups(all));
          replaceHost.replaceChildren(
            h('code', { class: 'dt-mono dt-replace-preview' }, text.value.replace(global, replacement.value)),
          );
        } catch (cause) {
          setError(error, cause instanceof Error ? cause.message : String(cause));
          highlight.textContent = text.value;
          matchesHost.replaceChildren();
          groupsHost.replaceChildren();
          replaceHost.replaceChildren();
        }
      };

      const buildGroups = (matches: RegExpMatchArray[]): Node[] => {
        const rows: Array<Array<string | Node>> = [];
        matches.slice(0, 100).forEach((match, index) => {
          if (match.groups) {
            for (const [name, value] of Object.entries(match.groups)) {
              rows.push([String(index + 1), name, value ?? '']);
            }
          } else {
            for (let group = 1; group < match.length; group++) {
              rows.push([String(index + 1), String(group), match[group] ?? '']);
            }
          }
        });
        if (!rows.length) {
          return [note(ctx.pick('This pattern has no capture groups.', 'В этом шаблоне нет групп захвата.'), 'info')];
        }
        return [
          stats([
            [ctx.pick('Groups', 'Групп'), rows.length],
            [ctx.pick('Matches', 'Совпадений'), matches.length],
          ]),
          table([ctx.pick('Match', 'Совпадение'), ctx.pick('Group', 'Группа'), ctx.pick('Value', 'Значение')], rows),
        ];
      };

      const statsHost = (host: HTMLElement, matches: RegExpMatchArray[]) => {
        host.replaceChildren(
          stats([
            [ctx.pick('Matches', 'Совпадений'), matches.length],
            [ctx.pick('Unique', 'Уникальных'), new Set(matches.map((match) => match[0])).size],
            [ctx.pick('Flags', 'Флаги'), [...flags].join('') || '—'],
          ]),
          matches.length
            ? table(
                ['#', ctx.pick('Match', 'Совпадение'), ctx.pick('Index', 'Позиция'), ctx.pick('Groups', 'Группы')],
                matches.slice(0, 200).map((match, index) => [
                  String(index + 1),
                  h('code', {}, match[0] || '∅'),
                  String(match.index ?? 0),
                  (match.groups ? Object.entries(match.groups) : []).map(([name, value]) => `${name}=${value}`).join(', ') || match.slice(1).join(', ') || '—',
                ]),
              )
            : note(ctx.pick('No matches', 'Совпадений нет'), 'warn'),
        );
      };

      pattern.addEventListener('input', evaluate);
      text.addEventListener('input', evaluate);
      replacement.addEventListener('input', evaluate);
      pattern.addEventListener('input', () => {
        exampleSelect.value = 'custom';
      });

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          field(ctx.pick('Example', 'Пример'), exampleSelect),
          h('div', { class: 'dt-regex-bar' }, h('span', { class: 'dt-regex-slash' }, '/'), pattern, h('span', { class: 'dt-regex-slash' }, '/'), flagBar),
          error,
          split(
            h('div', { class: 'dt-stack' }, pane(ctx.pick('Test string', 'Тестовая строка'), text), pane(ctx.pick('Highlighted matches', 'Подсветка совпадений'), highlight)),
            h(
              'div',
              { class: 'dt-stack' },
              pane(ctx.pick('Matches', 'Совпадения'), matchesHost),
              pane(ctx.pick('Groups', 'Группы'), groupsHost),
              pane(ctx.pick('Replace with', 'Заменить на'), h('div', { class: 'dt-stack' }, replacement, replaceHost)),
            ),
          ),
          pane(
            ctx.pick('Cheat sheet', 'Шпаргалка'),
            table(
              [ctx.pick('Pattern', 'Шаблон'), ctx.pick('Meaning', 'Значение')],
              CHEATSHEET.map(([token, en, ru]) => [h('code', {}, token), ctx.pick(en, ru)]),
            ),
          ),
        ),
      );
      evaluate();
    },
  });
}

interface XsdElement {
  name: string;
  type?: string;
  minOccurs?: string;
  maxOccurs?: string;
  children: XsdElement[];
}

const XSD_NS = 'http://www.w3.org/2001/XMLSchema';

function readXsdElements(container: Element): XsdElement[] {
  const elements: XsdElement[] = [];
  for (const child of Array.from(container.children)) {
    if (child.localName === 'element') {
      const name = child.getAttribute('name') ?? '';
      if (!name) continue;
      const children: XsdElement[] = [];
      const complexType = Array.from(child.children).find((node) => node.localName === 'complexType');
      if (complexType) {
        for (const inner of Array.from(complexType.children)) {
          if (['sequence', 'all', 'choice'].includes(inner.localName)) children.push(...readXsdElements(inner));
        }
      }
      elements.push({
        name,
        type: child.getAttribute('type') ?? undefined,
        minOccurs: child.getAttribute('minOccurs') ?? undefined,
        maxOccurs: child.getAttribute('maxOccurs') ?? undefined,
        children,
      });
    } else if (['sequence', 'all', 'choice', 'complexType'].includes(child.localName)) {
      elements.push(...readXsdElements(child));
    }
  }
  return elements;
}

function xmlXsdTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'testers-xml-xsd',
    group: 'testers',
    icon: '<path d="M4 4h16v16h-16z"/><path d="M9 9l-2 3l2 3"/><path d="M15 9l2 3l-2 3"/>',
    name: { en: 'XML / XSD Validator', ru: 'Проверка XML / XSD' },
    desc: {
      en: 'Check XML well-formedness and compare the structure against an XSD schema.',
      ru: 'Проверка корректности XML и структуры по XSD-схеме.',
    },
    keywords: 'xml xsd validate schema wellformed',
    mount(root, ctx) {
      const xml = area({
        rows: 12,
        value: '<?xml version="1.0" encoding="UTF-8"?>\n<catalog>\n  <book id="1">\n    <title>Dev Tools</title>\n    <price>0</price>\n  </book>\n</catalog>',
      });
      const xsd = area({
        rows: 12,
        value: '<?xml version="1.0" encoding="UTF-8"?>\n<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">\n  <xs:element name="catalog">\n    <xs:complexType>\n      <xs:sequence>\n        <xs:element name="book" maxOccurs="unbounded">\n          <xs:complexType>\n            <xs:sequence>\n              <xs:element name="title" type="xs:string"/>\n              <xs:element name="price" type="xs:decimal"/>\n            </xs:sequence>\n          </xs:complexType>\n        </xs:element>\n      </xs:sequence>\n    </xs:complexType>\n  </xs:element>\n</xs:schema>',
      });
      const output = h('div');
      const error = errorSlot();

      const validate = () => {
        const messages: Array<[string, Node]> = [];
        setError(error, null);

        const xmlDoc = new DOMParser().parseFromString(xml.value, 'application/xml');
        const xmlError = xmlDoc.querySelector('parsererror');
        if (xmlError) {
          output.replaceChildren(note(`${ctx.pick('XML is not well-formed', 'XML некорректен')}: ${xmlError.textContent?.trim()}`, 'error'));
          return;
        }
        messages.push([ctx.pick('XML well-formed', 'XML корректен'), badge('✓', 'ok')]);

        const xsdDoc = new DOMParser().parseFromString(xsd.value, 'application/xml');
        const xsdError = xsdDoc.querySelector('parsererror');
        if (xsdError) {
          messages.push([ctx.pick('XSD is not well-formed', 'XSD некорректен'), badge('✗', 'bad')]);
          output.replaceChildren(note(xsdError.textContent?.trim() ?? 'Invalid XSD', 'error'));
          return;
        }
        messages.push([ctx.pick('XSD well-formed', 'XSD корректен'), badge('✓', 'ok')]);

        const rootElement = Array.from(xsdDoc.documentElement.children).find((element) => element.localName === 'element');
        if (!rootElement) {
          output.replaceChildren(note(ctx.pick('No root xs:element found in the schema.', 'В схеме не найден корневой xs:element.'), 'warn'));
          return;
        }

        const expectedRoot = rootElement.getAttribute('name') ?? '';
        const rootName = xmlDoc.documentElement.localName;
        const rootMatches = expectedRoot === rootName;
        messages.push([ctx.pick('Root element', 'Корневой элемент'), badge(rootMatches ? `✓ ${rootName}` : `✗ ${rootName} (expected ${expectedRoot})`, rootMatches ? 'ok' : 'bad')]);

        const schema = readXsdElements(rootElement);
        const missing: string[] = [];
        const check = (element: Element, definitions: XsdElement[]) => {
          for (const definition of definitions) {
            const found = Array.from(element.children).filter((child) => child.localName === definition.name);
            if (!found.length && definition.minOccurs !== '0') missing.push(`<${element.localName}> → <${definition.name}>`);
            for (const child of found) check(child, definition.children);
          }
        };
        check(xmlDoc.documentElement, schema);

        messages.push([
          ctx.pick('Required elements', 'Обязательные элементы'),
          missing.length ? badge(`✗ ${missing.length}`, 'bad') : badge('✓', 'ok'),
        ]);

        output.replaceChildren(
          table([ctx.pick('Check', 'Проверка'), ctx.pick('Result', 'Результат')], messages),
          missing.length
            ? note(`${ctx.pick('Missing elements:', 'Отсутствуют элементы:')} ${missing.join(', ')}`, 'error')
            : note(ctx.pick('The structure matches the schema.', 'Структура соответствует схеме.'), 'ok'),
          pane(ctx.pick('Schema summary', 'Сводка схемы'), schemaTree(schema, ctx.pick)),
        );
      };

      const schemaTree = (elements: XsdElement[], pick: (en: string, ru: string) => string, depth = 0): HTMLElement =>
        h(
          'ul',
          { class: 'dt-tree', style: depth ? { paddingLeft: '16px' } : undefined },
          ...elements.map((element) =>
            h(
              'li',
              {},
              h('code', {}, element.name),
              element.type ? h('span', { class: 'dt-tree-type' }, ` : ${element.type}`) : null,
              element.maxOccurs === 'unbounded' ? h('span', { class: 'dt-tree-type' }, ` [0..∞]`) : null,
              depth < 6 ? schemaTree(element.children, pick, depth + 1) : null,
            ),
          ),
        );

      for (const element of [xml, xsd]) element.addEventListener('input', validate);

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          toolbar(btn(ctx.pick('Validate', 'Проверить'), validate, { variant: 'primary' })),
          error,
          split(pane('XML', xml, [copyBtn(() => xml.value)]), pane('XSD', xsd)),
          pane(ctx.pick('Validation result', 'Результат проверки'), output),
        ),
      );
      validate();
    },
  });
}

export const testerTools = [jsonPathTool(), regexTool(), xmlXsdTool()];
