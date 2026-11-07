/** Extra tools: duplicate detector, file splitter, JSON schema, JSON→C#/PHP,
 *  PNG compressor, randomizer, RESX translator, text delimiter, XSD generator. */
import {
  area,
  badge,
  btn,
  checkbox,
  copyBtn,
  downloadBlob,
  downloadBtn,
  errorSlot,
  field,
  fileDrop,
  note,
  pane,
  rangeField,
  readText,
  resultPane,
  select,
  selectField,
  setError,
  split,
  stats,
  table,
  textInput,
  toolbar,
} from '../components.ts';
import { formatBytes, h } from '../dom.ts';
import { defineTool } from '../tool-types.ts';

/* ------------------------------------------------------------------ */
/* Duplicate detector                                                  */
/* ------------------------------------------------------------------ */

function duplicatesTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'thirdparty-duplicates',
    group: 'thirdparty',
    icon: '<path d="M8 8m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z"/><path d="M16 8v-2a2 2 0 0 0 -2 -2h-8a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h2"/>',
    name: { en: 'Duplicate Detector', ru: 'Поиск дубликатов' },
    desc: {
      en: 'Find repeated lines or values and see how often they occur.',
      ru: 'Поиск повторяющихся строк и значений и их количество.',
    },
    keywords: 'duplicate find repeated unique lines',
    mount(root, ctx) {
      const input = area({ rows: 14, placeholder: 'one\ntwo\ntwo\nthree' });
      const output = h('div');
      const info = h('div');
      let ignoreCase = true;
      let trim = true;
      let splitByComma = false;

      const update = () => {
        const normalize = (value: string) => {
          let result = value;
          if (trim) result = result.trim();
          if (ignoreCase) result = result.toLowerCase();
          return result;
        };
        const values = splitByComma
          ? input.value.split(/[,\n]/)
          : input.value.split(/\r?\n/);
        const occurrences = new Map<string, { display: string; count: number; lines: number[] }>();
        values.forEach((value, index) => {
          if (!value.trim()) return;
          const key = normalize(value);
          const entry = occurrences.get(key) ?? { display: splitByComma ? value.trim() : value, count: 0, lines: [] };
          entry.count++;
          entry.lines.push(index + 1);
          occurrences.set(key, entry);
        });
        const duplicates = [...occurrences.values()].filter((entry) => entry.count > 1).sort((a, b) => b.count - a.count);
        info.replaceChildren(
          stats([
            [ctx.pick('Total values', 'Всего значений'), values.filter((value) => value.trim()).length],
            [ctx.pick('Unique values', 'Уникальных'), occurrences.size],
            [ctx.pick('Duplicates', 'Дубликатов'), duplicates.length],
          ]),
        );
        output.replaceChildren(
          duplicates.length
            ? table(
                [ctx.pick('Value', 'Значение'), ctx.pick('Count', 'Количество'), ctx.pick('Lines', 'Строки')],
                duplicates.slice(0, 500).map((entry) => [
                  entry.display,
                  badge(String(entry.count), entry.count > 3 ? 'bad' : 'warn'),
                  entry.lines.slice(0, 20).join(', ') + (entry.lines.length > 20 ? '…' : ''),
                ]),
              )
            : note(ctx.pick('No duplicates found.', 'Дубликаты не найдены.'), 'ok'),
        );
      };

      input.addEventListener('input', update);
      update();

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          h(
            'div',
            { class: 'dt-inline-options' },
            checkbox(ctx.pick('Ignore case', 'Игнорировать регистр'), true, (value) => {
              ignoreCase = value;
              update();
            }),
            checkbox(ctx.pick('Trim values', 'Обрезать пробелы'), true, (value) => {
              trim = value;
              update();
            }),
            checkbox(ctx.pick('Split by commas too', 'Разделять и по запятым'), false, (value) => {
              splitByComma = value;
              update();
            }),
          ),
          split(pane(ctx.pick('Input', 'Входные данные'), input), pane(ctx.pick('Duplicates', 'Дубликаты'), h('div', { class: 'dt-stack' }, info, output))),
        ),
      );
    },
  });
}

/* ------------------------------------------------------------------ */
/* File splitter                                                       */
/* ------------------------------------------------------------------ */

function fileSplitterTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'thirdparty-file-splitter',
    group: 'thirdparty',
    icon: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z"/><path d="M12 11v6"/><path d="M9 14h6"/>',
    name: { en: 'File Splitter', ru: 'Разделение файла' },
    desc: {
      en: 'Split a file into equal parts or by size, then download each chunk.',
      ru: 'Разделение файла на равные части или по размеру с загрузкой фрагментов.',
    },
    keywords: 'file split chunk parts merge join',
    mount(root, ctx) {
      let file: File | null = null;
      let mode: 'parts' | 'size' = 'parts';
      let parts = 3;
      let sizeKb = 256;
      const list = h('div');
      const info = h('div');
      const error = errorSlot();
      const fileLabel = h('span', { class: 'dt-file-name' }, '—');

      const build = () => {
        list.replaceChildren();
        info.replaceChildren();
        fileLabel.textContent = file ? `${file.name} · ${formatBytes(file.size)}` : '—';
        if (!file) return;
        const total = file.size;
        const chunkSize = mode === 'parts' ? Math.ceil(total / Math.max(1, parts)) : Math.max(1, sizeKb * 1024);
        const count = Math.max(1, Math.ceil(total / chunkSize));
        info.replaceChildren(
          stats([
            [ctx.pick('File size', 'Размер файла'), formatBytes(total)],
            [ctx.pick('Chunks', 'Фрагментов'), count],
            [ctx.pick('Chunk size', 'Размер фрагмента'), formatBytes(chunkSize)],
          ]),
        );
        const rows: Array<Array<string | Node>> = [];
        for (let index = 0; index < Math.min(count, 200); index++) {
          const start = index * chunkSize;
          const end = Math.min(total, start + chunkSize);
          const name = `${file.name}.part${String(index + 1).padStart(3, '0')}`;
          rows.push([
            String(index + 1),
            name,
            formatBytes(end - start),
            downloadBtn(() => file!.slice(start, end), name, ctx.pick('Save', 'Сохранить')),
          ]);
        }
        list.replaceChildren(table(['#', ctx.pick('Name', 'Имя'), ctx.pick('Size', 'Размер'), ''], rows));
        if (count > 200) list.appendChild(note(ctx.pick('Showing the first 200 chunks.', 'Показаны первые 200 фрагментов.'), 'warn'));
      };

      const upload = fileDrop({
        onFiles: (files) => {
          file = files[0];
          setError(error, null);
          build();
        },
      });

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          upload,
          h(
            'div',
            { class: 'dt-inline-form' },
            h('div', { class: 'dt-field' }, h('span', { class: 'dt-label' }, ctx.pick('Selected file', 'Выбранный файл')), fileLabel),
            selectField(ctx.pick('Split mode', 'Режим разделения'), [
              { value: 'parts', label: ctx.pick('Equal parts', 'Равные части') },
              { value: 'size', label: ctx.pick('By size', 'По размеру') },
            ], 'parts', (value) => {
              mode = value as typeof mode;
              build();
            }),
            field(ctx.pick('Parts', 'Частей'), textInput({ type: 'number', min: 2, max: 500, value: parts, onchange: (value) => {
              parts = Number(value) || 2;
              build();
            } })),
            field(ctx.pick('Chunk size, KB', 'Размер фрагмента, КБ'), textInput({ type: 'number', min: 1, value: sizeKb, onchange: (value) => {
              sizeKb = Number(value) || 1;
              build();
            } })),
          ),
          error,
          info,
          pane(ctx.pick('Chunks', 'Фрагменты'), list),
        ),
      );
    },
  });
}

/* ------------------------------------------------------------------ */
/* JSON Schema generator                                               */
/* ------------------------------------------------------------------ */

type JsonSchema = Record<string, unknown>;

function inferSchema(value: unknown): JsonSchema {
  if (value === null) return { type: 'null' };
  if (Array.isArray(value)) {
    if (!value.length) return { type: 'array', items: {} };
    const schemas = value.map(inferSchema);
    return { type: 'array', items: mergeSchemas(schemas) };
  }
  if (typeof value === 'string') {
    const isDate = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value);
    return isDate ? { type: 'string', format: 'date-time' } : { type: 'string' };
  }
  if (typeof value === 'number') return { type: Number.isInteger(value) ? 'integer' : 'number' };
  if (typeof value === 'boolean') return { type: 'boolean' };
  if (typeof value === 'object') {
    const properties: Record<string, JsonSchema> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) properties[key] = inferSchema(child);
    return { type: 'object', properties, required: Object.keys(properties), additionalProperties: false };
  }
  return {};
}

function mergeSchemas(schemas: JsonSchema[]): JsonSchema {
  const unique = schemas.filter((schema, index) => schemas.findIndex((other) => JSON.stringify(other) === JSON.stringify(schema)) === index);
  if (unique.length === 1) return unique[0];
  const types = new Set(unique.map((schema) => schema.type as string | undefined));
  if (types.size === 1 && types.has('object')) {
    const properties: Record<string, JsonSchema> = {};
    const required: string[] = [];
    for (const schema of unique) {
      const children = (schema.properties ?? {}) as Record<string, JsonSchema>;
      for (const [key, child] of Object.entries(children)) {
        properties[key] = properties[key] ? mergeSchemas([properties[key], child]) : child;
      }
      const schemaRequired = (schema.required ?? []) as string[];
      if (!required.length) required.push(...schemaRequired);
      else for (const key of [...required]) if (!schemaRequired.includes(key)) required.splice(required.indexOf(key), 1);
    }
    return { type: 'object', properties, required, additionalProperties: false };
  }
  return { anyOf: unique };
}

function jsonSchemaTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'thirdparty-json-schema',
    group: 'thirdparty',
    icon: '<path d="M9 4h6l4 4v12h-14v-16z"/><path d="M9 12h6"/><path d="M9 16h4"/>',
    name: { en: 'JSON Schema Generator', ru: 'Генератор JSON Schema' },
    desc: {
      en: 'Infer a JSON Schema (draft 2020-12) from a sample JSON document.',
      ru: 'Построение JSON Schema (draft 2020-12) по примеру JSON.',
    },
    keywords: 'json schema infer generate validation',
    mount(root, ctx) {
      const input = area({
        rows: 14,
        value: '{\n  "id": 1,\n  "name": "Ada",\n  "admin": true,\n  "tags": ["math", "code"],\n  "address": { "city": "London", "zip": "N1" }\n}',
      });
      const output = area({ readOnly: true, rows: 14 });
      const error = errorSlot();
      let title = 'Root';

      const generate = () => {
        try {
          const value: unknown = JSON.parse(input.value);
          const schema = inferSchema(value);
          output.value = JSON.stringify(
            {
              $schema: 'https://json-schema.org/draft/2020-12/schema',
              title,
              ...schema,
            },
            null,
            2,
          );
          setError(error, null);
        } catch (cause) {
          setError(error, cause instanceof Error ? cause.message : String(cause));
          output.value = '';
        }
      };
      input.addEventListener('input', generate);
      generate();

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          toolbar(
            textInput({ value: title, placeholder: 'title', oninput: (value) => {
              title = value;
            } }),
            btn(ctx.pick('Generate', 'Сгенерировать'), generate, { variant: 'primary' }),
            copyBtn(() => output.value),
            downloadBtn(() => output.value, 'schema.json'),
          ),
          error,
          split(pane(ctx.pick('JSON sample', 'Пример JSON'), input), pane('JSON Schema', output)),
        ),
      );
    },
  });
}

/* ------------------------------------------------------------------ */
/* PNG compressor                                                      */
/* ------------------------------------------------------------------ */

function pngCompressorTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'thirdparty-png-compressor',
    group: 'thirdparty',
    icon: '<path d="M4 17l4 -4l4 4l3 -3l5 5"/><path d="M4 5h16v14h-16z"/><path d="M12 9v4"/>',
    name: { en: 'PNG Compressor', ru: 'Сжатие PNG' },
    desc: {
      en: 'Reduce PNG size by downscaling and re-encoding the image.',
      ru: 'Уменьшение размера PNG за счёт масштабирования и перекодирования.',
    },
    keywords: 'png compress optimize resize image',
    mount(root, ctx) {
      let file: File | null = null;
      let image: HTMLImageElement | null = null;
      let scale = 1;
      let result: Blob | null = null;
      const preview = h('img', { class: 'dt-preview-img', alt: 'preview' });
      const info = h('div');
      const error = errorSlot();

      const compress = () => {
        if (!image) return;
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) return;
        context.imageSmoothingQuality = 'high';
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (!blob) return;
          result = blob;
          preview.src = URL.createObjectURL(blob);
          info.replaceChildren(
            stats([
              [ctx.pick('Original', 'Исходный размер'), file ? formatBytes(file.size) : '—'],
              [ctx.pick('Compressed', 'Новый размер'), formatBytes(blob.size)],
              [ctx.pick('Saved', 'Экономия'), file ? `${Math.max(0, (1 - blob.size / file.size) * 100).toFixed(1)} %` : '—'],
              [ctx.pick('Dimensions', 'Размеры'), `${canvas.width} × ${canvas.height}`],
            ]),
          );
          setError(error, null);
        }, 'image/png');
      };

      const upload = fileDrop({
        accept: 'image/png,image/*',
        onFiles: async (files) => {
          file = files[0];
          const dataUrl = URL.createObjectURL(file);
          const loaded = new Image();
          loaded.onload = () => {
            image = loaded;
            compress();
          };
          loaded.onerror = () => setError(error, ctx.pick('Cannot read image.', 'Не удалось прочитать изображение.'));
          loaded.src = dataUrl;
        },
      });

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          upload,
          rangeField(ctx.pick('Scale', 'Масштаб'), 10, 100, 100, (value) => {
            scale = value / 100;
            compress();
          }),
          error,
          pane(ctx.pick('Result', 'Результат'), h('div', { class: 'dt-stack' }, preview, info, toolbar(downloadBtn(() => result ?? new Blob(), () => `${(file?.name ?? 'image').replace(/\.png$/i, '')}.min.png`)))),
          note(ctx.pick('PNG is lossless: the main gains come from reducing the resolution.', 'PNG — формат без потерь: основной выигрыш даёт уменьшение разрешения.'), 'info'),
        ),
      );
    },
  });
}

/* ------------------------------------------------------------------ */
/* Randomizer                                                          */
/* ------------------------------------------------------------------ */

function randomInt(min: number, max: number): number {
  const range = max - min + 1;
  const limit = Math.floor(0x100000000 / range) * range;
  const buffer = new Uint32Array(1);
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= limit);
  return min + (buffer[0] % range);
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const swap = randomInt(0, index);
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function randomizerTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'thirdparty-randomizer',
    group: 'thirdparty',
    icon: '<path d="M4 4h5l4 5"/><path d="M4 20h5l4 -5"/><path d="M14 12h2a3 3 0 0 0 3 -3v-5"/><path d="M16 7l3 -3l3 3"/><path d="M16 17l3 3l3 -3"/>',
    name: { en: 'Randomizer', ru: 'Рандомайзер' },
    desc: {
      en: 'Random numbers, dice rolls, coin flips, shuffles and prize draws.',
      ru: 'Случайные числа, кубики, монетка, перемешивание и розыгрыши.',
    },
    keywords: 'random number dice coin shuffle pick lottery',
    mount(root, ctx) {
      let mode: 'number' | 'dice' | 'coin' | 'shuffle' | 'pick' = 'number';
      let min = 1;
      let max = 100;
      let count = 1;
      const listArea = area({ rows: 8, value: 'Alice\nBob\nCharlie\nDana' });
      const output = area({ readOnly: true, rows: 10 });
      const error = errorSlot();

      const modes = select(
        [
          { value: 'number', label: ctx.pick('Random number', 'Случайное число') },
          { value: 'dice', label: ctx.pick('Dice', 'Кости') },
          { value: 'coin', label: ctx.pick('Coin flip', 'Монетка') },
          { value: 'shuffle', label: ctx.pick('Shuffle list', 'Перемешать список') },
          { value: 'pick', label: ctx.pick('Pick winners', 'Выбрать победителей') },
        ],
        mode,
        (value) => {
          mode = value as typeof mode;
          run();
        },
      );

      const run = () => {
        try {
          setError(error, null);
          if (mode === 'number') {
            const values = Array.from({ length: Math.max(1, count) }, () => randomInt(Math.min(min, max), Math.max(min, max)));
            output.value = values.join(', ');
          } else if (mode === 'dice') {
            const rolls = Array.from({ length: Math.max(1, count) }, () => randomInt(1, 6));
            output.value = `${rolls.join(', ')}\n${ctx.pick('Total', 'Сумма')}: ${rolls.reduce((sum, value) => sum + value, 0)}`;
          } else if (mode === 'coin') {
            const flips = Array.from({ length: Math.max(1, count) }, () => (randomInt(0, 1) ? 'heads' : 'tails'));
            output.value = flips.join(', ');
          } else {
            const items = listArea.value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
            if (!items.length) throw new Error(ctx.pick('Add items to the list first.', 'Сначала добавьте элементы в список.'));
            const shuffled = shuffle(items);
            output.value = mode === 'shuffle' ? shuffled.join('\n') : shuffled.slice(0, Math.max(1, count)).join('\n');
          }
        } catch (cause) {
          setError(error, cause instanceof Error ? cause.message : String(cause));
          output.value = '';
        }
      };

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          h(
            'div',
            { class: 'dt-inline-form' },
            field(ctx.pick('Mode', 'Режим'), modes),
            field(ctx.pick('Count', 'Количество'), textInput({ type: 'number', min: 1, max: 1000, value: count, onchange: (value) => {
              count = Number(value) || 1;
              run();
            } })),
            field(ctx.pick('Min', 'Мин'), textInput({ type: 'number', value: min, onchange: (value) => {
              min = Number(value) || 0;
              run();
            } })),
            field(ctx.pick('Max', 'Макс'), textInput({ type: 'number', value: max, onchange: (value) => {
              max = Number(value) || 0;
              run();
            } })),
          ),
          error,
          split(pane(ctx.pick('Items (for shuffle / pick)', 'Элементы (для перемешивания)'), listArea), h('div', { class: 'dt-stack' }, toolbar(btn(ctx.pick('Roll', 'Запустить'), run, { variant: 'primary' }), copyBtn(() => output.value)), pane(ctx.pick('Result', 'Результат'), output))),
        ),
      );
      run();
    },
  });
}

/* ------------------------------------------------------------------ */
/* RESX translator                                                     */
/* ------------------------------------------------------------------ */

function resxTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'thirdparty-resx-translator',
    group: 'thirdparty',
    icon: '<path d="M4 5h16v14h-16z"/><path d="M4 10h16"/><path d="M10 10v9"/><path d="M4 15h6"/>',
    name: { en: 'RESX Translator', ru: 'Переводчик RESX' },
    desc: {
      en: 'Load a .resx file, translate values in place and export a new file.',
      ru: 'Загрузка .resx, перевод значений и экспорт нового файла.',
    },
    keywords: 'resx resource translation localization',
    mount(root, ctx) {
      let document: Document | null = null;
      const rows: Array<{ name: string; value: string; comment: string; input: HTMLInputElement }> = [];
      const host = h('div');
      const error = errorSlot();
      const info = h('div');

      const load = (text: string) => {
        try {
          document = new DOMParser().parseFromString(text, 'application/xml');
          const parserError = document.querySelector('parsererror');
          if (parserError) throw new Error(parserError.textContent?.trim() ?? 'Invalid RESX');
          rows.length = 0;
          const dataNodes = Array.from(document.querySelectorAll('data')).slice(0, 400);
          for (const node of dataNodes) {
            const name = node.getAttribute('name') ?? '';
            const valueNode = Array.from(node.children).find((child) => child.localName === 'value');
            const commentNode = Array.from(node.children).find((child) => child.localName === 'comment');
            const value = valueNode?.textContent ?? '';
            const comment = commentNode?.textContent ?? '';
            const input = textInput({ value });
            rows.push({ name, value, comment, input });
          }
          host.replaceChildren(
            table(
              [ctx.pick('Name', 'Имя'), ctx.pick('Source value', 'Исходное значение'), ctx.pick('Translation', 'Перевод'), ctx.pick('Comment', 'Комментарий')],
              rows.map((row) => [h('code', {}, row.name), h('span', { class: 'dt-resx-source' }, row.value), row.input, h('span', { class: 'dt-hint' }, row.comment)]),
            ),
          );
          info.replaceChildren(stats([[ctx.pick('Entries', 'Записей'), rows.length]]));
          setError(error, null);
        } catch (cause) {
          setError(error, cause instanceof Error ? cause.message : String(cause));
          host.replaceChildren();
        }
      };

      const exportFile = () => {
        if (!document) return '';
        const clone = document.cloneNode(true) as Document;
        const dataNodes = Array.from(clone.querySelectorAll('data'));
        dataNodes.forEach((node, index) => {
          const row = rows[index];
          if (!row) return;
          let valueNode = Array.from(node.children).find((child) => child.localName === 'value');
          if (!valueNode) {
            valueNode = clone.createElement('value');
            node.appendChild(valueNode);
          }
          valueNode.textContent = row.input.value;
        });
        return new XMLSerializer().serializeToString(clone);
      };

      const upload = fileDrop({
        accept: '.resx,.xml',
        onFiles: async (files) => load(await readText(files[0])),
      });

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          upload,
          error,
          info,
          toolbar(downloadBtn(() => exportFile(), 'translated.resx'), copyBtn(() => exportFile())),
          pane(ctx.pick('Entries', 'Записи'), host),
        ),
      );
    },
  });
}

/* ------------------------------------------------------------------ */
/* Text delimiter                                                      */
/* ------------------------------------------------------------------ */

function delimiterTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'thirdparty-text-delimiter',
    group: 'thirdparty',
    icon: '<path d="M4 6h16"/><path d="M8 6v12"/><path d="M16 6v12"/><path d="M4 18h16"/>',
    name: { en: 'Text Delimiter', ru: 'Разделители текста' },
    desc: {
      en: 'Split text into columns, rearrange them and join with another delimiter.',
      ru: 'Разбор текста на колонки, перестановка и объединение другим разделителем.',
    },
    keywords: 'delimiter csv tsv split join columns',
    mount(root, ctx) {
      const input = area({ rows: 12, value: 'name,role,city\nAda,engineer,London\nAlan,scientist,London' });
      let delimiter = ',';
      let outputDelimiter = '\t';
      let quoted = true;
      let transpose = false;
      const output = area({ readOnly: true, rows: 12 });
      const tableHost = h('div');
      const error = errorSlot();

      const parse = (text: string): string[][] => {
        if (!quoted) return text.split(/\r?\n/).map((line) => line.split(delimiter));
        const rows: string[][] = [];
        let row: string[] = [];
        let cell = '';
        let inQuotes = false;
        for (let index = 0; index < text.length; index++) {
          const char = text[index];
          if (inQuotes) {
            if (char === '"' && text[index + 1] === '"') {
              cell += '"';
              index++;
            } else if (char === '"') {
              inQuotes = false;
            } else {
              cell += char;
            }
          } else if (char === '"' && cell === '') {
            inQuotes = true;
          } else if (text.startsWith(delimiter, index)) {
            row.push(cell);
            cell = '';
            index += delimiter.length - 1;
          } else if (char === '\n') {
            row.push(cell);
            rows.push(row);
            row = [];
            cell = '';
          } else if (char !== '\r') {
            cell += char;
          }
        }
        if (cell.length || row.length) {
          row.push(cell);
          rows.push(row);
        }
        return rows;
      };

      const quote = (value: string) => (value.includes(outputDelimiter) || value.includes('"') ? `"${value.replace(/"/g, '""')}"` : value);

      const update = () => {
        try {
          let rows = parse(input.value);
          if (transpose) {
            const width = Math.max(...rows.map((row) => row.length));
            rows = Array.from({ length: width }, (_, column) => rows.map((row) => row[column] ?? ''));
          }
          output.value = rows.map((row) => row.map(quote).join(outputDelimiter)).join('\n');
          tableHost.replaceChildren(
            table(
              rows[0]?.map((_, index) => `#${index + 1}`) ?? [],
              rows.slice(0, 200).map((row) => row.map((cell) => cell || ' ')),
            ),
          );
          setError(error, null);
        } catch (cause) {
          setError(error, cause instanceof Error ? cause.message : String(cause));
        }
      };

      input.addEventListener('input', update);

      const delimiters = [
        { value: ',', label: ctx.pick('Comma', 'Запятая') },
        { value: ';', label: ctx.pick('Semicolon', 'Точка с запятой') },
        { value: '\t', label: ctx.pick('Tab', 'Табуляция') },
        { value: '|', label: ctx.pick('Pipe', 'Вертикальная черта') },
        { value: ' ', label: ctx.pick('Space', 'Пробел') },
      ];

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          h(
            'div',
            { class: 'dt-inline-form' },
            selectField(ctx.pick('Input delimiter', 'Входной разделитель'), delimiters, delimiter, (value) => {
              delimiter = value;
              update();
            }),
            selectField(ctx.pick('Output delimiter', 'Выходной разделитель'), delimiters, outputDelimiter, (value) => {
              outputDelimiter = value;
              update();
            }),
            checkbox(ctx.pick('Quoted fields', 'Поля в кавычках'), true, (value) => {
              quoted = value;
              update();
            }),
            checkbox(ctx.pick('Transpose', 'Транспонировать'), false, (value) => {
              transpose = value;
              update();
            }),
          ),
          error,
          split(pane(ctx.pick('Input', 'Вход'), input), pane(ctx.pick('Output', 'Результат'), output, [copyBtn(() => output.value), downloadBtn(() => output.value, 'result.csv')])),
          pane(ctx.pick('Parsed table', 'Разобранная таблица'), tableHost),
        ),
      );
      update();
    },
  });
}

/* ------------------------------------------------------------------ */
/* XSD generator                                                       */
/* ------------------------------------------------------------------ */

interface XmlTreeNode {
  name: string;
  attributes: Array<[string, string]>;
  children: XmlTreeNode[];
  text: string;
}

function buildTree(element: Element): XmlTreeNode {
  return {
    name: element.localName,
    attributes: Array.from(element.attributes).map((attribute) => [attribute.name, attribute.value]),
    children: Array.from(element.children).map(buildTree),
    text: Array.from(element.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => (node.nodeValue ?? '').trim())
      .join(' '),
  };
}

function inferXmlType(node: XmlTreeNode): string {
  if (node.children.length) return 'complex';
  const text = node.text.trim();
  if (!text) return 'xs:string';
  if (/^-?\d+$/.test(text)) return 'xs:integer';
  if (/^-?\d*\.\d+$/.test(text)) return 'xs:decimal';
  if (/^(true|false)$/i.test(text)) return 'xs:boolean';
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return 'xs:date';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text)) return 'xs:dateTime';
  return 'xs:string';
}

function elementDeclaration(node: XmlTreeNode, indent: string, maxOccurs: string): string {
  const attributes = node.attributes
    .filter(([name]) => !name.startsWith('xmlns'))
    .map(([name]) => `${indent}    <xs:attribute name="${name}" type="xs:string" use="required"/>`)
    .join('\n');

  if (!node.children.length) {
    const type = inferXmlType(node);
    if (!attributes) return `${indent}<xs:element name="${node.name}" type="${type}"${maxOccurs}/>`;
    return (
      `${indent}<xs:element name="${node.name}"${maxOccurs}>\n` +
      `${indent}  <xs:complexType>\n` +
      `${indent}    <xs:simpleContent>\n` +
      `${indent}      <xs:extension base="${type}">\n` +
      `${attributes}\n` +
      `${indent}      </xs:extension>\n` +
      `${indent}    </xs:simpleContent>\n` +
      `${indent}  </xs:complexType>\n` +
      `${indent}</xs:element>`
    );
  }

  const grouped = new Map<string, XmlTreeNode[]>();
  for (const child of node.children) {
    const list = grouped.get(child.name) ?? [];
    list.push(child);
    grouped.set(child.name, list);
  }

  const children = [...grouped.entries()]
    .map(([, nodes]) => elementDeclaration(nodes[0], `${indent}      `, nodes.length > 1 ? ' maxOccurs="unbounded"' : ''))
    .join('\n');

  return (
    `${indent}<xs:element name="${node.name}"${maxOccurs}>\n` +
    `${indent}  <xs:complexType>\n` +
    `${indent}    <xs:sequence>\n` +
    `${children}\n` +
    `${indent}    </xs:sequence>\n` +
    (attributes ? `${attributes}\n` : '') +
    `${indent}  </xs:complexType>\n` +
    `${indent}</xs:element>`
  );
}

function xsdGeneratorTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'thirdparty-xsd-generator',
    group: 'thirdparty',
    icon: '<path d="M4 4h16v16h-16z"/><path d="M4 9h16"/><path d="M9 9v11"/>',
    name: { en: 'XSD Generator', ru: 'Генератор XSD' },
    desc: {
      en: 'Create an XSD schema from an XML sample with inferred types.',
      ru: 'Создание XSD-схемы по примеру XML с определением типов.',
    },
    keywords: 'xsd xml schema generate',
    mount(root, ctx) {
      const input = area({
        rows: 14,
        value: '<?xml version="1.0"?>\n<catalog>\n  <book id="1">\n    <title>Dev Tools</title>\n    <price>0.00</price>\n    <inStock>true</inStock>\n  </book>\n  <book id="2">\n    <title>Regex</title>\n    <price>25.50</price>\n    <inStock>false</inStock>\n  </book>\n</catalog>',
      });
      const output = area({ readOnly: true, rows: 16 });
      const error = errorSlot();

      const generate = () => {
        try {
          const document = new DOMParser().parseFromString(input.value, 'application/xml');
          const parserError = document.querySelector('parsererror');
          if (parserError) throw new Error(parserError.textContent?.trim() ?? 'Invalid XML');
          const tree = buildTree(document.documentElement);
          const body = elementDeclaration(tree, '  ', '');
          output.value = `<?xml version="1.0" encoding="UTF-8"?>\n<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" elementFormDefault="qualified">\n${body}\n</xs:schema>`;
          setError(error, null);
        } catch (cause) {
          setError(error, cause instanceof Error ? cause.message : String(cause));
          output.value = '';
        }
      };
      input.addEventListener('input', generate);
      generate();

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          toolbar(btn(ctx.pick('Generate XSD', 'Сгенерировать XSD'), generate, { variant: 'primary' }), copyBtn(() => output.value), downloadBtn(() => output.value, 'schema.xsd')),
          error,
          split(pane('XML sample', input), pane('XSD', output)),
        ),
      );
    },
  });
}

export const thirdPartyTools = [
  duplicatesTool(),
  fileSplitterTool(),
  jsonSchemaTool(),
  pngCompressorTool(),
  randomizerTool(),
  resxTool(),
  delimiterTool(),
  xsdGeneratorTool(),
];
