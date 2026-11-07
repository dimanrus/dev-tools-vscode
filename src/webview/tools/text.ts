/** Text tools: escape/unescape, list comparer, markdown preview, analyzer, text comparer. */
import { diffChars, diffLines, diffWords } from 'diff';
import { marked } from 'marked';
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
  resultPane,
  select,
  setError,
  split,
  stats,
  table,
  toolbar,
} from '../components.ts';
import { h } from '../dom.ts';
import { defineTool } from '../tool-types.ts';
import { escapeText, unescapeText, type EscapeKind } from '../lib/escapers.ts';

const ESCAPE_FORMATS: Array<{ value: EscapeKind; en: string; ru: string }> = [
  { value: 'json', en: 'JSON string', ru: 'Строка JSON' },
  { value: 'html', en: 'HTML entities', ru: 'HTML-сущности' },
  { value: 'xml', en: 'XML entities', ru: 'XML-сущности' },
  { value: 'url', en: 'URL', ru: 'URL' },
  { value: 'csharp', en: 'C# / Java string', ru: 'Строка C# / Java' },
  { value: 'sql', en: 'SQL literal', ru: 'SQL-литерал' },
  { value: 'csv', en: 'CSV field', ru: 'Поле CSV' },
  { value: 'shell', en: 'Shell argument', ru: 'Аргумент shell' },
  { value: 'regex', en: 'Regular expression', ru: 'Регулярное выражение' },
  { value: 'unicode', en: 'Unicode escapes', ru: 'Unicode-последовательности' },
  { value: 'backslash', en: 'Backslash escapes', ru: 'Обратный слэш' },
];

function escapeTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'text-escape',
    group: 'text',
    icon: '<path d="M12 4l-8 8l8 8l8 -8z"/><path d="M8 12h8"/>',
    name: { en: 'Escape / Unescape', ru: 'Экранирование / Снятие' },
    desc: {
      en: 'Escape or unescape strings for JSON, HTML, XML, URL, SQL, C#, shell and more.',
      ru: 'Экранирование и снятие экранирования для JSON, HTML, XML, URL, SQL, C#, shell и др.',
    },
    keywords: 'escape unescape string quotes entities backslash',
    mount(root, ctx) {
      const input = area({ rows: 10, value: 'Hello "world" & <friends> \\ 100%' });
      const output = area({ readOnly: true, rows: 10 });
      const error = errorSlot();
      let kind: EscapeKind = 'json';
      let mode: 'escape' | 'unescape' = 'escape';
      let fullUrl = false;

      const formatSelect = select(
        ESCAPE_FORMATS.map((format) => ({ value: format.value, label: ctx.pick(format.en, format.ru) })),
        kind,
        (value) => {
          kind = value as EscapeKind;
          update();
        },
      );
      const modeSelect = select(
        [
          { value: 'escape', label: ctx.pick('Escape', 'Экранировать') },
          { value: 'unescape', label: ctx.pick('Unescape', 'Снять экранирование') },
        ],
        mode,
        (value) => {
          mode = value as 'escape' | 'unescape';
          update();
        },
      );
      const fullUrlToggle = checkbox(ctx.pick('Treat as a full URL', 'Считать полным URL'), false, (checked) => {
        fullUrl = checked;
        update();
      });

      const update = () => {
        try {
          output.value = mode === 'escape' ? escapeText(input.value, kind, fullUrl) : unescapeText(input.value, kind, fullUrl);
          setError(error, null);
        } catch (cause) {
          setError(error, cause instanceof Error ? cause.message : String(cause));
          output.value = '';
        }
      };

      input.addEventListener('input', update);
      update();

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          toolbar(formatSelect, modeSelect, (kind as string) === 'url' ? fullUrlToggle : null, btn(ctx.pick('Swap', 'Поменять'), () => {
            const temp = input.value;
            input.value = output.value;
            output.value = temp;
            mode = mode === 'escape' ? 'unescape' : 'escape';
            modeSelect.value = mode;
            update();
          }, { variant: 'ghost' })),
          error,
          split(
            pane(ctx.pick('Source text', 'Исходный текст'), input, [copyBtn(() => input.value)]),
            pane(ctx.pick('Result', 'Результат'), output, [copyBtn(() => output.value), downloadBtn(() => output.value, 'escaped.txt')]),
          ),
        ),
      );
    },
  });
}

function listComparerTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'text-list-comparer',
    group: 'text',
    icon: '<path d="M8 5h-3a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h3"/><path d="M16 5h3a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-3"/><path d="M12 5v14"/>',
    name: { en: 'List Comparer', ru: 'Сравнение списков' },
    desc: {
      en: 'Compare two lists line by line: what was added, removed and what is common.',
      ru: 'Сравнение двух списков построчно: что добавлено, удалено и что совпадает.',
    },
    keywords: 'list compare diff set difference intersection',
    mount(root, ctx) {
      const left = area({ rows: 14, placeholder: ctx.pick('First list', 'Первый список') });
      const right = area({ rows: 14, placeholder: ctx.pick('Second list', 'Второй список') });
      let ignoreCase = false;
      let trim = true;
      let ignoreEmpty = true;

      const leftHost = h('div');
      const rightHost = h('div');
      const statsHost = h('div');
      const tableHost = h('div');

      const options = h(
        'div',
        { class: 'dt-inline-options' },
        checkbox(ctx.pick('Ignore case', 'Игнорировать регистр'), false, (value) => {
          ignoreCase = value;
          update();
        }),
        checkbox(ctx.pick('Trim lines', 'Обрезать пробелы'), true, (value) => {
          trim = value;
          update();
        }),
        checkbox(ctx.pick('Ignore empty lines', 'Игнорировать пустые строки'), true, (value) => {
          ignoreEmpty = value;
          update();
        }),
      );

      const normalize = (text: string): string[] => {
        let lines = text.split(/\r?\n/);
        if (trim) lines = lines.map((line) => line.trim());
        if (ignoreEmpty) lines = lines.filter((line) => line.length > 0);
        if (ignoreCase) lines = lines.map((line) => line.toLowerCase());
        return lines;
      };

      const update = () => {
        const a = normalize(left.value);
        const b = normalize(right.value);
        const setA = new Set(a);
        const setB = new Set(b);
        const added = b.filter((line) => !setA.has(line));
        const removed = a.filter((line) => !setB.has(line));
        const common = a.filter((line) => setB.has(line));

        statsHost.replaceChildren(
          stats([
            [ctx.pick('Added', 'Добавлено'), added.length],
            [ctx.pick('Removed', 'Удалено'), removed.length],
            [ctx.pick('Common', 'Совпадает'), common.length],
            [ctx.pick('Unique', 'Уникально'), new Set([...a, ...b]).size],
          ]),
        );
        leftHost.replaceChildren(
          added.length ? h('ul', { class: 'dt-list' }, ...added.map((line) => h('li', {}, badge('+', 'ok'), ' ', line))) : note(ctx.pick('Nothing added', 'Ничего не добавлено'), 'ok'),
        );
        rightHost.replaceChildren(
          removed.length ? h('ul', { class: 'dt-list' }, ...removed.map((line) => h('li', {}, badge('−', 'bad'), ' ', line))) : note(ctx.pick('Nothing removed', 'Ничего не удалено'), 'ok'),
        );
        tableHost.replaceChildren(
          table(
            [ctx.pick('Comparison', 'Сравнение'), ctx.pick('Line', 'Строка')],
            [
              ...added.map((line) => [badge('added', 'ok'), line] as Array<string | Node>),
              ...removed.map((line) => [badge('removed', 'bad'), line] as Array<string | Node>),
            ],
          ),
        );
        if (!added.length && !removed.length) tableHost.replaceChildren(note(ctx.pick('The lists are identical.', 'Списки идентичны.'), 'ok'));
      };

      left.addEventListener('input', update);
      right.addEventListener('input', update);
      update();

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          options,
          split(pane(ctx.pick('List A', 'Список A'), left), pane(ctx.pick('List B', 'Список B'), right)),
          statsHost,
          h('div', { class: 'dt-split' }, h('div', { class: 'dt-col' }, pane(ctx.pick('Only in B', 'Только в B'), leftHost)), h('div', { class: 'dt-col' }, pane(ctx.pick('Only in A', 'Только в A'), rightHost))),
          pane(ctx.pick('Full comparison', 'Полное сравнение'), tableHost),
        ),
      );
    },
  });
}

function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,iframe,object,embed,link,style,form,input,button').forEach((node) => node.remove());
  doc.querySelectorAll('*').forEach((element) => {
    for (const attribute of Array.from(element.attributes)) {
      if (/^on/i.test(attribute.name) || (/^(href|src)$/i.test(attribute.name) && /^\s*javascript:/i.test(attribute.value))) {
        element.removeAttribute(attribute.name);
      }
    }
  });
  return doc.body.innerHTML;
}

function markdownTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'text-markdown-preview',
    group: 'text',
    icon: '<path d="M3 5m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z"/><path d="M7 15v-6l3 3l3 -3v6"/><path d="M16 15v-6"/>',
    name: { en: 'Markdown Preview', ru: 'Предпросмотр Markdown' },
    desc: {
      en: 'Render Markdown as HTML, inspect the markup and export the result.',
      ru: 'Рендеринг Markdown в HTML, просмотр разметки и экспорт результата.',
    },
    keywords: 'markdown md html preview',
    mount(root, ctx) {
      const input = area({
        rows: 18,
        value: '# Dev Tools\n\nA **developer toolbox** in one place.\n\n- JSON ↔ YAML\n- Regex tester\n- JWT decoder\n\n```js\nconsole.log("hello");\n```\n',
      });
      const preview = h('div', { class: 'dt-markdown' });
      const htmlArea = area({ readOnly: true, rows: 18 });
      let html = '';
      const error = errorSlot();

      const render = () => {
        try {
          html = sanitizeHtml(marked.parse(input.value, { async: false, gfm: true, breaks: false }) as string);
          preview.innerHTML = html;
          htmlArea.value = html;
          setError(error, null);
        } catch (cause) {
          setError(error, cause instanceof Error ? cause.message : String(cause));
        }
      };
      input.addEventListener('input', render);
      render();

      const viewSelect = select(
        [
          { value: 'preview', label: ctx.pick('Preview', 'Предпросмотр') },
          { value: 'html', label: 'HTML' },
        ],
        'preview',
      );
      const panes = h('div', { class: 'dt-md-panes' }, pane(ctx.pick('Markdown', 'Markdown'), input), pane(ctx.pick('Preview', 'Предпросмотр'), preview));
      viewSelect.addEventListener('change', () => {
        panes.replaceChildren();
        if (viewSelect.value === 'preview') {
          panes.append(pane(ctx.pick('Markdown', 'Markdown'), input), pane(ctx.pick('Preview', 'Предпросмотр'), preview));
        } else {
          panes.append(pane(ctx.pick('Markdown', 'Markdown'), input), pane('HTML', htmlArea, [copyBtn(() => html)]));
        }
      });

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          toolbar(
            viewSelect,
            btn(ctx.pick('Sample', 'Пример'), () => {
              input.value = '## Title\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n> Quote\n\n**bold** and `code`\n';
              render();
            }, { variant: 'ghost' }),
            downloadBtn(() => html, 'document.html', ctx.pick('Download HTML', 'Скачать HTML')),
          ),
          error,
          panes,
        ),
      );
    },
  });
}

function analyzerTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'text-analyzer',
    group: 'text',
    icon: '<path d="M4 4v16h16"/><path d="M7 15l3 -5l3 3l4 -7"/>',
    name: { en: 'Text Analyzer', ru: 'Анализ текста' },
    desc: {
      en: 'Count characters, words, sentences and get readability and word statistics.',
      ru: 'Подсчёт символов, слов, предложений, читаемости и статистики слов.',
    },
    keywords: 'text statistics count words characters entropy readability',
    mount(root, ctx) {
      const input = area({ rows: 14, placeholder: ctx.pick('Paste text to analyze…', 'Вставьте текст для анализа…') });
      const output = h('div');
      const wordsHost = h('div');

      const update = () => {
        const text = input.value;
        const characters = Array.from(text).length;
        const noSpaces = characters - (text.match(/\s/g)?.length ?? 0);
        const bytes = new TextEncoder().encode(text).length;
        const lines = text ? text.split(/\r?\n/).length : 0;
        const words = text.trim() ? text.trim().split(/\s+/) : [];
        const sentences = text.split(/[.!?…]+(?:\s|$)/).filter((part) => part.trim().length > 0).length;
        const paragraphs = text.split(/\n\s*\n/).filter((part) => part.trim().length > 0).length;

        const frequencies = new Map<string, number>();
        for (const word of words) {
          const key = word.toLowerCase().replace(/[^\p{L}\p{N}'-]+/gu, '');
          if (key) frequencies.set(key, (frequencies.get(key) ?? 0) + 1);
        }
        const unique = frequencies.size;
        const totalChars = text.length;
        let entropy = 0;
        if (totalChars > 0) {
          const counts = new Map<string, number>();
          for (const char of text) counts.set(char, (counts.get(char) ?? 0) + 1);
          for (const count of counts.values()) {
            const probability = count / totalChars;
            entropy -= probability * Math.log2(probability);
          }
        }
        const averageWord = words.length ? words.reduce((sum, word) => sum + word.length, 0) / words.length : 0;
        const readingMinutes = words.length / 200;
        const speakingMinutes = words.length / 130;
        const longestLine = lines ? Math.max(...text.split(/\r?\n/).map((line) => line.length)) : 0;

        output.replaceChildren(
          stats([
            [ctx.pick('Characters', 'Символов'), characters],
            [ctx.pick('Without spaces', 'Без пробелов'), noSpaces],
            ['UTF-8 ' + ctx.pick('bytes', 'байт'), bytes],
            [ctx.pick('Words', 'Слов'), words.length],
            [ctx.pick('Unique words', 'Уникальных слов'), unique],
            [ctx.pick('Sentences', 'Предложений'), sentences],
            [ctx.pick('Paragraphs', 'Абзацев'), paragraphs],
            [ctx.pick('Lines', 'Строк'), lines],
            [ctx.pick('Avg word length', 'Ср. длина слова'), averageWord.toFixed(1)],
            [ctx.pick('Longest line', 'Самая длинная строка'), longestLine],
            [ctx.pick('Reading time', 'Время чтения'), `${readingMinutes < 1 ? '<1' : Math.round(readingMinutes)} min`],
            [ctx.pick('Speaking time', 'Время речи'), `${speakingMinutes < 1 ? '<1' : Math.round(speakingMinutes)} min`],
            [ctx.pick('Unicode', 'Юникод'), `${Array.from(new Set(Array.from(text))).length} ${ctx.pick('unique chars', 'уник. символов')}`],
            [ctx.pick('Entropy', 'Энтропия'), `${entropy.toFixed(2)} bit`],
          ]),
        );

        const top = [...frequencies.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 20);
        wordsHost.replaceChildren(
          top.length
            ? table(
                [ctx.pick('Word', 'Слово'), ctx.pick('Count', 'Кол-во'), ctx.pick('Share', 'Доля')],
                top.map(([word, count]) => [word, String(count), `${((count / words.length) * 100).toFixed(1)} %`]),
              )
            : note(ctx.pick('No words yet', 'Пока нет слов'), 'info'),
        );
      };

      input.addEventListener('input', update);
      update();

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          pane(ctx.pick('Text', 'Текст'), input, [copyBtn(() => input.value)]),
          pane(ctx.pick('Statistics', 'Статистика'), output),
          pane(ctx.pick('Top words', 'Частые слова'), wordsHost),
        ),
      );
    },
  });
}

function comparerTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'text-comparer',
    group: 'text',
    icon: '<path d="M10 6h-6a1 1 0 0 0 -1 1v12a1 1 0 0 0 1 1h6"/><path d="M14 6h6a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1h-6"/><path d="M12 3v18"/>',
    name: { en: 'Text Comparer', ru: 'Сравнение текста' },
    desc: {
      en: 'See line, word or character differences between two texts.',
      ru: 'Поиск различий между текстами по строкам, словам и символам.',
    },
    keywords: 'diff compare text changes patch',
    mount(root, ctx) {
      const left = area({ rows: 12, value: 'The quick brown fox\njumps over the lazy dog\nsecond line\n' });
      const right = area({ rows: 12, value: 'The quick red fox\njumps over the lazy dog\nnew line here\n' });
      const host = h('div');
      const statsHost = h('div');
      let mode: 'lines' | 'words' | 'chars' = 'lines';
      let ignoreWhitespace = false;

      const modeSelect = select(
        [
          { value: 'lines', label: ctx.pick('Lines', 'Строки') },
          { value: 'words', label: ctx.pick('Words', 'Слова') },
          { value: 'chars', label: ctx.pick('Characters', 'Символы') },
        ],
        mode,
        (value) => {
          mode = value as typeof mode;
          update();
        },
      );

      const update = () => {
        const a = ignoreWhitespace ? left.value.replace(/\s+/g, ' ').trim() : left.value;
        const b = ignoreWhitespace ? right.value.replace(/\s+/g, ' ').trim() : right.value;
        const changes = mode === 'lines' ? diffLines(a, b) : mode === 'words' ? diffWords(a, b) : diffChars(a, b);
        const added = changes.filter((change) => change.added).reduce((sum, change) => sum + change.value.length, 0);
        const removed = changes.filter((change) => change.removed).reduce((sum, change) => sum + change.value.length, 0);

        statsHost.replaceChildren(
          stats([
            [ctx.pick('Added', 'Добавлено'), mode === 'lines' ? changes.filter((change) => change.added).reduce((sum, change) => sum + change.count!, 0) : added],
            [ctx.pick('Removed', 'Удалено'), mode === 'lines' ? changes.filter((change) => change.removed).reduce((sum, change) => sum + change.count!, 0) : removed],
            [ctx.pick('Changes', 'Изменений'), changes.filter((change) => change.added || change.removed).length],
            [ctx.pick('Identical', 'Идентичность'), added === 0 && removed === 0 ? ctx.pick('yes', 'да') : ctx.pick('no', 'нет')],
          ]),
        );

        const container = h('div', { class: `dt-diff ${mode === 'lines' ? 'dt-diff-lines' : 'dt-diff-inline'}` });
        for (const change of changes) {
          const tone = change.added ? 'is-add' : change.removed ? 'is-del' : '';
          if (mode === 'lines') {
            const lines = change.value.split('\n');
            if (lines[lines.length - 1] === '') lines.pop();
            for (const line of lines) {
              container.appendChild(
                h(
                  'div',
                  { class: `dt-diff-line ${tone}` },
                  h('span', { class: 'dt-diff-sign' }, change.added ? '+' : change.removed ? '−' : ' '),
                  h('span', { class: 'dt-diff-text' }, line.length ? line : ' '),
                ),
              );
            }
          } else {
            container.appendChild(h('span', { class: `dt-diff-token ${tone}` }, change.value));
          }
        }
        host.replaceChildren(container);
      };

      left.addEventListener('input', update);
      right.addEventListener('input', update);
      modeSelect.addEventListener('change', () => {
        mode = modeSelect.value as typeof mode;
        update();
      });

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          toolbar(
            modeSelect,
            checkbox(ctx.pick('Ignore whitespace changes', 'Игнорировать изменения пробелов'), false, (value) => {
              ignoreWhitespace = value;
              update();
            }),
            btn(ctx.pick('Swap', 'Поменять'), () => {
              const temp = left.value;
              left.value = right.value;
              right.value = temp;
              update();
            }, { variant: 'ghost' }),
          ),
          split(pane(ctx.pick('Original', 'Оригинал'), left), pane(ctx.pick('Modified', 'Изменённый'), right)),
          statsHost,
          pane(ctx.pick('Differences', 'Различия'), host, [], 'dt-diff-pane'),
        ),
      );
      update();
    },
  });
}

export const textTools = [escapeTool(), listComparerTool(), markdownTool(), analyzerTool(), comparerTool()];
