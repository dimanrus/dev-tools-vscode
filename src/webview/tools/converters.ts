/** Converters: cron, date, JSON table/CSV, JSON <-> YAML, number base. */
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
  resultPane,
  row,
  select,
  setError,
  split,
  stats,
  table,
  textInput,
  toolbar,
} from '../components.ts';
import { h } from '../dom.ts';
import { defineTool } from '../tool-types.ts';
import { describeCron, nextRuns, parseCron } from '../lib/cron.ts';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';

function chronoTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'converters-cron-parser',
    group: 'converters',
    icon: '<path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/><path d="M12 7v5l3 3"/>',
    name: { en: 'Cron Parser', ru: 'Разбор Cron' },
    desc: {
      en: 'Explain a cron expression in plain words and preview the next runs.',
      ru: 'Расшифровка cron-выражения простыми словами и ближайшие запуски.',
    },
    keywords: 'cron crontab schedule quartz',
    mount(root, ctx) {
      const input = textInput({ value: '*/5 * * * *', class: 'dt-mono' });
      const summary = h('div', { class: 'dt-cron-summary' });
      const detailsHost = h('div', { class: 'dt-cron-details' });
      const runsHost = h('div', { class: 'dt-cron-runs' });
      const error = errorSlot();

      const presets = [
        { value: '*/5 * * * *', label: '*/5 * * * *' },
        { value: '0 * * * *', label: '0 * * * *' },
        { value: '0 9 * * 1-5', label: '0 9 * * 1-5' },
        { value: '30 2 1 * *', label: '30 2 1 * *' },
        { value: '0 0 * * 0', label: '0 0 * * 0' },
        { value: '@daily', label: '@daily' },
        { value: '@monthly', label: '@monthly' },
      ];
      const presetSelect = select(
        [{ value: '', label: ctx.pick('Choose a preset…', 'Выберите шаблон…') }, ...presets.map((preset) => ({ value: preset.value, label: preset.label }))],
        '',
        (value) => {
          if (!value) return;
          input.value = value;
          update();
        },
      );

      const update = () => {
        try {
          const parsed = parseCron(input.value);
          const description = describeCron(parsed, ctx.lang());
          setError(error, null);
          summary.replaceChildren(
            h('div', { class: 'dt-cron-title' }, description.summary),
            h('code', { class: 'dt-cron-raw' }, parsed.raw),
          );
          detailsHost.replaceChildren(table(['Field', 'Values'], description.details));
          const runs = nextRuns(parsed, new Date(), 8);
          if (!runs.length) {
            runsHost.replaceChildren(note(ctx.pick('No upcoming runs found.', 'Ближайшие запуски не найдены.'), 'warn'));
          } else {
            runsHost.replaceChildren(
              table(
                [ctx.pick('Next run', 'Следующий запуск'), 'ISO 8601', ctx.pick('Weekday', 'День недели')],
                runs.map((date) => [
                  date.toLocaleString(ctx.lang() === 'ru' ? 'ru-RU' : 'en-GB'),
                  date.toISOString(),
                  date.toLocaleDateString(ctx.lang() === 'ru' ? 'ru-RU' : 'en-GB', { weekday: 'long' }),
                ]),
              ),
            );
          }
        } catch (cause) {
          setError(error, cause instanceof Error ? cause.message : String(cause));
          summary.replaceChildren();
          detailsHost.replaceChildren();
          runsHost.replaceChildren();
        }
      };

      input.addEventListener('input', update);
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') update();
      });

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          h(
            'div',
            { class: 'dt-inline-form' },
            field('Cron', input),
            h('div', { class: 'dt-inline-actions' }, presetSelect, btn(ctx.pick('Parse', 'Разобрать'), update, { variant: 'primary' })),
          ),
          h('div', { class: 'dt-hint' }, 'minute hour day-of-month month day-of-week · * , - /'),
          error,
          summary,
          h('div', { class: 'dt-split' }, h('div', { class: 'dt-col' }, pane(ctx.pick('Fields', 'Поля'), detailsHost)), h('div', { class: 'dt-col' }, pane(ctx.pick('Upcoming runs', 'Ближайшие запуски'), runsHost))),
        ),
      );
      update();
      presetSelect.value = '';
    },
  });
}

function dateTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'converters-date',
    group: 'converters',
    icon: '<path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M4 11h16"/><path d="M8 15h2v2h-2z"/>',
    name: { en: 'Date & Timestamp', ru: 'Дата и время' },
    desc: {
      en: 'Convert timestamps, ISO dates and local time in every direction.',
      ru: 'Преобразование timestamp, ISO и локального времени во все стороны.',
    },
    keywords: 'date time unix epoch iso timestamp timezone',
    mount(root, ctx) {
      const input = textInput({ value: new Date().toISOString(), class: 'dt-mono' });
      const output = h('div');
      const error = errorSlot();
      const nowButton = btn(ctx.pick('Now', 'Сейчас'), () => {
        input.value = new Date().toISOString();
        update();
      }, { variant: 'ghost' });

      const parse = (value: string): Date | null => {
        const trimmed = value.trim();
        if (!trimmed) return null;
        if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
          const number = Number(trimmed);
          const absolute = Math.abs(number);
          if (absolute >= 1e14) return new Date(number / 1000);
          if (absolute >= 1e11) return new Date(number);
          return new Date(number * 1000);
        }
        const parsed = new Date(trimmed);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      };

      const dayOfYear = (date: Date): number => {
        const start = new Date(date.getFullYear(), 0, 0);
        return Math.floor((date.getTime() - start.getTime()) / 86_400_000);
      };

      const weekNumber = (date: Date): number => {
        const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const day = target.getUTCDay() || 7;
        target.setUTCDate(target.getUTCDate() + 4 - day);
        const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
        return Math.ceil(((target.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
      };

      const relative = (date: Date): string => {
        const delta = date.getTime() - Date.now();
        const absolute = Math.abs(delta);
        const formatter = new Intl.RelativeTimeFormat(ctx.lang() === 'ru' ? 'ru' : 'en', { numeric: 'auto' });
        const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
          ['year', 31_536_000_000],
          ['month', 2_592_000_000],
          ['day', 86_400_000],
          ['hour', 3_600_000],
          ['minute', 60_000],
          ['second', 1000],
        ];
        for (const [unit, size] of units) {
          if (absolute >= size || unit === 'second') return formatter.format(Math.round(delta / size), unit);
        }
        return '';
      };

      const update = () => {
        const date = parse(input.value);
        if (!date) {
          setError(error, ctx.pick('Cannot parse the value as a date.', 'Не удалось разобрать значение как дату.'));
          output.replaceChildren();
          return;
        }
        setError(error, null);
        const locale = ctx.lang() === 'ru' ? 'ru-RU' : 'en-GB';
        const rows: Array<[string, string]> = [
          [ctx.pick('Unix seconds', 'Unix (секунды)'), String(Math.floor(date.getTime() / 1000))],
          [ctx.pick('Unix milliseconds', 'Unix (миллисекунды)'), String(date.getTime())],
          ['ISO 8601 (UTC)', date.toISOString()],
          ['ISO 8601 (local)', new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().replace('Z', '')],
          [ctx.pick('Local date & time', 'Локальные дата и время'), date.toLocaleString(locale)],
          [ctx.pick('UTC date & time', 'UTC дата и время'), date.toUTCString()],
          [ctx.pick('Date only', 'Только дата'), date.toLocaleDateString(locale)],
          [ctx.pick('Time only', 'Только время'), date.toLocaleTimeString(locale)],
          ['RFC 2822', date.toUTCString()],
          [ctx.pick('Day of year', 'День года'), String(dayOfYear(date))],
          [ctx.pick('ISO week', 'Неделя ISO'), String(weekNumber(date))],
          [ctx.pick('Timezone offset', 'Смещение часового пояса'), `${-date.getTimezoneOffset() / 60} h`],
          [ctx.pick('Relative', 'Относительно сейчас'), relative(date)],
        ];
        output.replaceChildren(table([ctx.pick('Format', 'Формат'), ctx.pick('Value', 'Значение')], rows));
      };

      input.addEventListener('input', update);
      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          h('div', { class: 'dt-inline-form' }, field(ctx.pick('Date, ISO string or timestamp', 'Дата, ISO-строка или timestamp'), input), h('div', { class: 'dt-inline-actions' }, nowButton)),
          h('div', { class: 'dt-hint' }, ctx.pick('Seconds, milliseconds and microseconds are detected automatically.', 'Секунды, миллисекунды и микросекунды определяются автоматически.')),
          error,
          pane(ctx.pick('All formats', 'Все форматы'), output),
        ),
      );
      update();
    },
  });
}

function jsonTableTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'converters-json-table',
    group: 'converters',
    icon: '<path d="M3 5h18v4h-18z"/><path d="M3 11h18v4h-18z"/><path d="M3 17h18v4h-18z"/>',
    name: { en: 'JSON Array to Table / CSV', ru: 'JSON-массив в таблицу / CSV' },
    desc: {
      en: 'Turn a JSON array of objects into a readable table and CSV output.',
      ru: 'Преобразование массива JSON в таблицу и CSV.',
    },
    keywords: 'json csv table tsv excel export',
    mount(root, ctx) {
      const input = area({
        rows: 12,
        placeholder: '[{ "id": 1, "name": "Ada" }]',
        value: '[\n  { "id": 1, "name": "Ada", "role": "engineer" },\n  { "id": 2, "name": "Alan", "role": "scientist" }\n]',
      });
      const delimiter = select(
        [
          { value: ',', label: ctx.pick('Comma (,)', 'Запятая (,)') },
          { value: ';', label: ctx.pick('Semicolon (;)', 'Точка с запятой (;)') },
          { value: '\t', label: ctx.pick('Tab', 'Табуляция') },
          { value: '|', label: ctx.pick('Pipe (|)', 'Вертикальная черта (|)') },
        ],
        ',',
        () => update(),
      );
      let includeHeader = true;
      const withHeader = checkbox(ctx.pick('Include header row', 'Включить строку заголовка'), true, (checked) => {
        includeHeader = checked;
        update();
      });
      const tableHost = h('div');
      const csvArea = area({ readOnly: true, rows: 10 });
      const error = errorSlot();
      let currentCsv = '';

      const stringifyCell = (value: unknown): string => {
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
      };

      const quote = (value: string): string => {
        const needsQuotes = value.includes(delimiter.value) || /["\n\r]/.test(value);
        return needsQuotes ? `"${value.replace(/"/g, '""')}"` : value;
      };

      const update = () => {
        try {
          const parsed: unknown = JSON.parse(input.value);
          if (!Array.isArray(parsed)) throw new Error(ctx.pick('Root value must be an array.', 'Корневое значение должно быть массивом.'));
          const records = parsed.map((item): Record<string, unknown> =>
            item && typeof item === 'object' ? (item as Record<string, unknown>) : { value: item },
          );
          const columns: string[] = [];
          for (const record of records) {
            for (const key of Object.keys(record)) if (!columns.includes(key)) columns.push(key);
          }
          if (!columns.length) throw new Error(ctx.pick('No columns found.', 'Колонки не найдены.'));

          tableHost.replaceChildren(
            table(
              columns,
              records.map((record) => columns.map((column) => stringifyCell(record[column]))),
            ),
          );

          const lines: string[] = [];
          if (includeHeader) lines.push(columns.map(quote).join(delimiter.value));
          for (const record of records) lines.push(columns.map((column) => quote(stringifyCell(record[column]))).join(delimiter.value));
          currentCsv = lines.join('\n');
          csvArea.value = currentCsv;
          setError(error, null);
        } catch (cause) {
          setError(error, cause instanceof Error ? cause.message : String(cause));
          tableHost.replaceChildren();
          csvArea.value = '';
          currentCsv = '';
        }
      };

      input.addEventListener('input', update);
      update();

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          split(
            pane(ctx.pick('JSON input', 'JSON на входе'), input),
            h(
              'div',
              { class: 'dt-stack' },
              toolbar(delimiter, withHeader, copyBtn(() => currentCsv), downloadBtn(() => currentCsv, 'data.csv')),
              error,
              pane(ctx.pick('Table', 'Таблица'), tableHost),
              pane(ctx.pick('CSV', 'CSV'), csvArea, [copyBtn(() => currentCsv), downloadBtn(() => currentCsv, 'data.csv')]),
            ),
          ),
          h('div', { class: 'dt-hint' }, ctx.pick('Nested values are serialized as JSON.', 'Вложенные значения сериализуются в JSON.')),
          stats([
            [ctx.pick('Rows', 'Строк'), tableHost.querySelectorAll('tbody tr').length],
            [ctx.pick('CSV size', 'Размер CSV'), `${currentCsv.length} B`],
          ]),
        ),
      );
    },
  });
}

function jsonYamlTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'converters-json-yaml',
    group: 'converters',
    icon: '<path d="M7 4v16"/><path d="M17 4v16"/><path d="M4 8h6"/><path d="M14 16h6"/>',
    name: { en: 'JSON ↔ YAML', ru: 'JSON ↔ YAML' },
    desc: {
      en: 'Convert JSON to YAML and back with live validation.',
      ru: 'Конвертация JSON в YAML и обратно с проверкой ошибок.',
    },
    keywords: 'json yaml yml convert',
    mount(root, ctx) {
      const jsonArea = area({ rows: 16, value: '{\n  "name": "dev-tools",\n  "version": "1.0.0",\n  "tools": ["json", "yaml", "jwt"]\n}' });
      const yamlArea = area({ rows: 16 });
      const error = errorSlot();

      const convert = (source: 'json' | 'yaml') => {
        try {
          if (source === 'json') {
            const value: unknown = JSON.parse(jsonArea.value);
            yamlArea.value = yamlDump(value, { indent: 2, lineWidth: 120, noRefs: true });
          } else {
            const value: unknown = yamlLoad(yamlArea.value);
            jsonArea.value = JSON.stringify(value, null, 2);
          }
          setError(error, null);
        } catch (cause) {
          setError(error, cause instanceof Error ? cause.message : String(cause));
        }
      };

      jsonArea.addEventListener('input', () => convert('json'));
      yamlArea.addEventListener('input', () => convert('yaml'));

      const swap = btn(ctx.pick('Swap', 'Поменять'), () => {
        const temp = jsonArea.value;
        jsonArea.value = yamlArea.value;
        yamlArea.value = temp;
        try {
          JSON.parse(jsonArea.value);
          convert('json');
        } catch {
          convert('yaml');
        }
      }, { variant: 'ghost' });

      convert('json');

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          toolbar(swap, btn(ctx.pick('Format JSON', 'Форматировать JSON'), () => convert('json'), { variant: 'primary' })),
          error,
          split(pane('JSON', jsonArea, [copyBtn(() => jsonArea.value)]), pane('YAML', yamlArea, [copyBtn(() => yamlArea.value)])),
        ),
      );
    },
  });
}

function numberBaseTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'converters-number-base',
    group: 'converters',
    icon: '<path d="M7 8h10"/><path d="M7 12h10"/><path d="M7 16h10"/><path d="M4 5v14"/><path d="M20 5v14"/>',
    name: { en: 'Number Base', ru: 'Системы счисления' },
    desc: {
      en: 'Convert integers between binary, octal, decimal, hex and any base up to 36.',
      ru: 'Перевод целых чисел между двоичной, восьмеричной, десятичной, шестнадцатеричной и любыми системами до 36.',
    },
    keywords: 'number base binary hex octal decimal radix bigint',
    mount(root, ctx) {
      const input = textInput({ value: '255', class: 'dt-mono' });
      const baseSelect = select(
        [
          { value: '2', label: '2 — binary' },
          { value: '8', label: '8 — octal' },
          { value: '10', label: '10 — decimal' },
          { value: '16', label: '16 — hexadecimal' },
          { value: '36', label: '36 — base36' },
        ],
        '10',
        () => update(),
      );
      const output = h('div');
      const error = errorSlot();

      const parseBig = (value: string, base: number): bigint => {
        const digits = value.trim().toLowerCase().replace(/^0[bxo]/, '').replace(/[\s_,]/g, '');
        if (!digits) throw new Error(ctx.pick('Enter a number.', 'Введите число.'));
        let result = 0n;
        const bigBase = BigInt(base);
        for (const char of digits) {
          const digit = Number.parseInt(char, 36);
          if (Number.isNaN(digit) || digit >= base) {
            throw new Error(ctx.pick(`Digit "${char}" is not valid for base ${base}.`, `Символ "${char}" недопустим для основания ${base}.`));
          }
          result = result * bigBase + BigInt(digit);
        }
        return result;
      };

      const update = () => {
        try {
          const base = Number(baseSelect.value);
          const value = parseBig(input.value, base);
          setError(error, null);
          const binary = value.toString(2);
          output.replaceChildren(
            table(
              [ctx.pick('Base', 'Основание'), ctx.pick('Value', 'Значение')],
              [
                ['2 · ' + ctx.pick('binary', 'двоичная'), binary],
                ['8 · ' + ctx.pick('octal', 'восьмеричная'), value.toString(8)],
                ['10 · ' + ctx.pick('decimal', 'десятичная'), value.toString(10)],
                ['16 · ' + ctx.pick('hex', 'шестнадцатеричная'), value.toString(16).toUpperCase()],
                ['36 · base36', value.toString(36).toUpperCase()],
              ],
            ),
            h('div', { class: 'dt-bit-view dt-mono' }, binary.replace(/\B(?=(\d{4})+(?!\d))/g, ' ')),
          );
        } catch (cause) {
          setError(error, cause instanceof Error ? cause.message : String(cause));
          output.replaceChildren();
        }
      };

      input.addEventListener('input', update);
      baseSelect.addEventListener('change', update);
      update();

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          h('div', { class: 'dt-inline-form' }, field(ctx.pick('Number', 'Число'), input), field(ctx.pick('Input base', 'Основание входа'), baseSelect)),
          error,
          pane(ctx.pick('All bases', 'Все системы'), output),
        ),
      );
    },
  });
}

export const converterTools = [chronoTool(), dateTool(), jsonTableTool(), jsonYamlTool(), numberBaseTool()];
