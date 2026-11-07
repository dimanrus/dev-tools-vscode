/** Generators: hash, lorem ipsum, password, UUID, ULID, RSA, semver. */
import { compare, inc, major, minor, patch, satisfies, valid, validRange } from 'semver';
import {
  area,
  btn,
  checkbox,
  copyBtn,
  downloadBtn,
  errorSlot,
  field,
  iconBtn,
  note,
  pane,
  rangeField,
  resultPane,
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
import { base64ToBytes, bytesToBase64, utf8ToBase64 } from '../lib/bytes.ts';

const HASH_ALGORITHMS: Array<[string, string]> = [
  ['md5', 'MD5'],
  ['sha1', 'SHA-1'],
  ['sha256', 'SHA-256'],
  ['sha384', 'SHA-384'],
  ['sha512', 'SHA-512'],
  ['crc32', 'CRC-32'],
];

function hexToBase64(hex: string): string {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index++) bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  return bytesToBase64(bytes);
}

function hashTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'generators-hash',
    group: 'generators',
    icon: '<path d="M4 9h16"/><path d="M4 15h16"/><path d="M10 3l-2 18"/><path d="M16 3l-2 18"/>',
    name: { en: 'Hash / Checksum', ru: 'Хеш / Контрольная сумма' },
    desc: {
      en: 'Compute MD5, SHA-1/2 and CRC-32 digests, including HMAC signatures.',
      ru: 'Вычисление MD5, SHA-1/2 и CRC-32, включая HMAC-подписи.',
    },
    keywords: 'hash md5 sha1 sha256 sha512 crc32 hmac checksum',
    mount(root, ctx) {
      const input = area({ rows: 10, value: 'The quick brown fox jumps over the lazy dog' });
      const key = textInput({ placeholder: ctx.pick('Optional HMAC key', 'Необязательный ключ HMAC') });
      const output = h('div');
      const error = errorSlot();
      let encoding: 'hex' | 'base64' = 'hex';
      let uppercase = false;
      let token = 0;

      const compute = async () => {
        const current = ++token;
        try {
          const result = await ctx.rpc<Record<string, string>>('hash', {
            data: utf8ToBase64(input.value),
            algorithms: HASH_ALGORITHMS.map(([id]) => id),
            hmacKey: key.value ? utf8ToBase64(key.value) : undefined,
          });
          if (current !== token) return;
          const rows: Array<Array<string | Node>> = HASH_ALGORITHMS.map(([id, label]) => {
            const value = encoding === 'hex' ? result[id] : hexToBase64(result[id]);
            const display = uppercase ? value.toUpperCase() : value;
            return [
              label,
              h('div', { class: 'dt-hash-row' }, h('code', { class: 'dt-hash-value' }, display), iconBtn(
                '<path d="M8 8m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z"/><path d="M16 8v-2a2 2 0 0 0 -2 -2h-8a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h2"/>',
                ctx.pick('Copy', 'Копировать'),
                () => void navigator.clipboard.writeText(display),
              )),
            ];
          });
          output.replaceChildren(table([ctx.pick('Algorithm', 'Алгоритм'), ctx.pick('Digest', 'Значение')], rows));
          setError(error, null);
        } catch (cause) {
          if (current !== token) return;
          setError(error, cause instanceof Error ? cause.message : String(cause));
        }
      };

      let timer: number | undefined;
      const schedule = () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => void compute(), 180);
      };
      input.addEventListener('input', schedule);
      key.addEventListener('input', schedule);

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          toolbar(
            select(
              [
                { value: 'hex', label: 'Hex' },
                { value: 'base64', label: 'Base64' },
              ],
              'hex',
              (value) => {
                encoding = value as typeof encoding;
                void compute();
              },
            ),
            checkbox('UPPERCASE', false, (value) => {
              uppercase = value;
              void compute();
            }),
            btn(ctx.pick('Recompute', 'Пересчитать'), () => void compute(), { variant: 'primary' }),
            copyBtn(() => (output.querySelector('.dt-hash-value')?.textContent ?? '')),
          ),
          error,
          split(pane(ctx.pick('Text', 'Текст'), input), pane(ctx.pick('HMAC key (optional)', 'Ключ HMAC (необязательно)'), key)),
          pane(ctx.pick('Digests', 'Хеши'), output),
        ),
      );
      void compute();
    },
  });
}

const LOREM_WORDS =
  'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum'.split(
    ' ',
  );

function loremTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'generators-lorem',
    group: 'generators',
    icon: '<path d="M4 6h16"/><path d="M4 10h16"/><path d="M4 14h10"/><path d="M4 18h13"/>',
    name: { en: 'Lorem Ipsum', ru: 'Lorem Ipsum' },
    desc: {
      en: 'Generate placeholder paragraphs, sentences or words as text or HTML.',
      ru: 'Генерация текста-заполнителя: абзацы, предложения или слова, текст или HTML.',
    },
    keywords: 'lorem ipsum placeholder dummy text filler',
    mount(root, ctx) {
      let paragraphs = 3;
      let sentences = 4;
      let words = 12;
      let startWithLorem = true;
      let asHtml = false;
      const output = area({ readOnly: true, rows: 16 });

      const random = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

      const buildSentence = (): string => {
        const parts: string[] = [];
        for (let index = 0; index < words; index++) parts.push(random(LOREM_WORDS));
        const text = parts.join(' ');
        return text.charAt(0).toUpperCase() + text.slice(1) + '.';
      };

      const generate = () => {
        const result: string[] = [];
        for (let paragraph = 0; paragraph < paragraphs; paragraph++) {
          const sentencesList: string[] = [];
          for (let sentence = 0; sentence < sentences; sentence++) sentencesList.push(buildSentence());
          let text = sentencesList.join(' ');
          if (paragraph === 0 && startWithLorem) text = `Lorem ipsum dolor sit amet, ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
          result.push(text);
        }
        output.value = asHtml ? result.map((text) => `<p>${text}</p>`).join('\n') : result.join('\n\n');
      };

      const controls = h(
        'div',
        { class: 'dt-stack' },
        rangeField(ctx.pick('Paragraphs', 'Абзацев'), 1, 20, paragraphs, (value) => {
          paragraphs = value;
          generate();
        }),
        rangeField(ctx.pick('Sentences per paragraph', 'Предложений в абзаце'), 1, 12, sentences, (value) => {
          sentences = value;
          generate();
        }),
        rangeField(ctx.pick('Words per sentence', 'Слов в предложении'), 3, 30, words, (value) => {
          words = value;
          generate();
        }),
        h(
          'div',
          { class: 'dt-inline-options' },
          checkbox(ctx.pick('Start with "Lorem ipsum"', 'Начинать с "Lorem ipsum"'), true, (value) => {
            startWithLorem = value;
            generate();
          }),
          checkbox(ctx.pick('Wrap in <p> tags', 'Обернуть в теги <p>'), false, (value) => {
            asHtml = value;
            generate();
          }),
        ),
      );

      generate();

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          split(controls, h('div', { class: 'dt-stack' }, toolbar(copyBtn(() => output.value), downloadBtn(() => output.value, 'lorem.txt')), pane(ctx.pick('Result', 'Результат'), output))),
        ),
      );
    },
  });
}

function passwordTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'generators-password',
    group: 'generators',
    icon: '<path d="M5 11a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"/><path d="M13 11h8"/><path d="M17 11v3"/><path d="M20 11v2"/>',
    name: { en: 'Password Generator', ru: 'Генератор паролей' },
    desc: {
      en: 'Create strong random passwords with a configurable character set.',
      ru: 'Создание надёжных паролей с настраиваемым набором символов.',
    },
    keywords: 'password generator random secure entropy',
    mount(root, ctx) {
      let length = 20;
      let count = 5;
      let lower = true;
      let upper = true;
      let digits = true;
      let symbols = true;
      let excludeSimilar = true;
      const similar = 'il1Lo0O';
      const output = area({ readOnly: true, rows: 10 });
      const info = h('div');

      const generate = () => {
        let alphabet = '';
        if (lower) alphabet += 'abcdefghijklmnopqrstuvwxyz';
        if (upper) alphabet += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        if (digits) alphabet += '0123456789';
        if (symbols) alphabet += '!@#$%^&*()-_=+[]{};:,.?/';
        if (excludeSimilar) alphabet = Array.from(alphabet).filter((char) => !similar.includes(char)).join('');
        if (!alphabet) {
          output.value = '';
          info.replaceChildren(note(ctx.pick('Select at least one character set.', 'Выберите хотя бы один набор символов.'), 'warn'));
          return;
        }
        const bytes = crypto.getRandomValues(new Uint8Array(length * count));
        const limit = 256 - (256 % alphabet.length);
        const passwords: string[] = [];
        let cursor = 0;
        for (let index = 0; index < count; index++) {
          let password = '';
          while (password.length < length) {
            const byte = bytes[cursor++ % bytes.length];
            if (byte >= limit) continue;
            password += alphabet[byte % alphabet.length];
          }
          passwords.push(password);
        }
        output.value = passwords.join('\n');
        const entropy = length * Math.log2(alphabet.length);
        info.replaceChildren(
          stats([
            [ctx.pick('Length', 'Длина'), length],
            [ctx.pick('Alphabet', 'Алфавит'), alphabet.length],
            [ctx.pick('Entropy', 'Энтропия'), `${entropy.toFixed(1)} bit`],
            [ctx.pick('Strength', 'Надёжность'), entropy > 100 ? 'excellent' : entropy > 70 ? 'strong' : entropy > 45 ? 'medium' : 'weak'],
          ]),
        );
      };

      const controls = h(
        'div',
        { class: 'dt-stack' },
        rangeField(ctx.pick('Length', 'Длина'), 4, 128, length, (value) => {
          length = value;
          generate();
        }),
        rangeField(ctx.pick('How many', 'Количество'), 1, 50, count, (value) => {
          count = value;
          generate();
        }),
        h(
          'div',
          { class: 'dt-inline-options' },
          checkbox('a-z', true, (value) => {
            lower = value;
            generate();
          }),
          checkbox('A-Z', true, (value) => {
            upper = value;
            generate();
          }),
          checkbox('0-9', true, (value) => {
            digits = value;
            generate();
          }),
          checkbox('!@#$', true, (value) => {
            symbols = value;
            generate();
          }),
          checkbox(ctx.pick('Exclude similar (il1Lo0O)', 'Исключить похожие (il1Lo0O)'), true, (value) => {
            excludeSimilar = value;
            generate();
          }),
        ),
        btn(ctx.pick('Generate', 'Сгенерировать'), generate, { variant: 'primary', icon: '<path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"/>' }),
      );

      generate();

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          split(controls, h('div', { class: 'dt-stack' }, toolbar(copyBtn(() => output.value), downloadBtn(() => output.value, 'passwords.txt')), pane(ctx.pick('Passwords', 'Пароли'), output))),
          info,
        ),
      );
    },
  });
}

function uuidV7(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let time = Date.now();
  for (let index = 5; index >= 0; index--) {
    bytes[index] = time & 0xff;
    time = Math.floor(time / 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function uuidTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'generators-uuid',
    group: 'generators',
    icon: '<path d="M4 8l8 -4l8 4v8l-8 4l-8 -4z"/><path d="M4 8l8 4l8 -4"/><path d="M12 12v8"/>',
    name: { en: 'UUID Generator', ru: 'Генератор UUID' },
    desc: {
      en: 'Generate RFC 4122 v4, time-ordered v7 and nil UUIDs in bulk.',
      ru: 'Массовая генерация UUID v4, упорядоченных v7 и nil.',
    },
    keywords: 'uuid guid v4 v7 random identifier',
    mount(root, ctx) {
      let version: 'v4' | 'v7' | 'nil' = 'v4';
      let count = 10;
      let uppercase = false;
      let braces = false;
      let hyphens = true;
      const output = area({ readOnly: true, rows: 14 });

      const generate = () => {
        const values: string[] = [];
        for (let index = 0; index < count; index++) {
          let value: string;
          if (version === 'nil') value = '00000000-0000-0000-0000-000000000000';
          else if (version === 'v7') value = uuidV7();
          else value = crypto.randomUUID();
          if (!hyphens) value = value.replace(/-/g, '');
          if (uppercase) value = value.toUpperCase();
          if (braces) value = `{${value}}`;
          values.push(value);
        }
        output.value = values.join('\n');
      };

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          h(
            'div',
            { class: 'dt-inline-form' },
            field(
              ctx.pick('Version', 'Версия'),
              select(
                [
                  { value: 'v4', label: 'v4 — random' },
                  { value: 'v7', label: 'v7 — time ordered' },
                  { value: 'nil', label: 'nil' },
                ],
                'v4',
                (value) => {
                  version = value as typeof version;
                  generate();
                },
              ),
            ),
            field(
              ctx.pick('Count', 'Количество'),
              select(
                ['1', '5', '10', '25', '50', '100'].map((value) => ({ value, label: value })),
                '10',
                (value) => {
                  count = Number(value);
                  generate();
                },
              ),
            ),
          ),
          h(
            'div',
            { class: 'dt-inline-options' },
            checkbox('UPPERCASE', false, (value) => {
              uppercase = value;
              generate();
            }),
            checkbox('{braces}', false, (value) => {
              braces = value;
              generate();
            }),
            checkbox(ctx.pick('Hyphens', 'Дефисы'), true, (value) => {
              hyphens = value;
              generate();
            }),
          ),
          toolbar(btn(ctx.pick('Generate', 'Сгенерировать'), generate, { variant: 'primary' }), copyBtn(() => output.value), downloadBtn(() => output.value, 'uuids.txt')),
          pane('UUID', output),
        ),
      );
      generate();
    },
  });
}

const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function ulid(): string {
  let time = Date.now();
  let encoded = '';
  for (let index = 0; index < 10; index++) {
    encoded = ULID_ALPHABET[time % 32] + encoded;
    time = Math.floor(time / 32);
  }
  const random = crypto.getRandomValues(new Uint8Array(16));
  return encoded + Array.from(random, (byte) => ULID_ALPHABET[byte % 32]).join('');
}

function ulidTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'generators-ulid',
    group: 'generators',
    icon: '<path d="M7 8l-4 4l4 4"/><path d="M17 8l4 4l-4 4"/><path d="M12 6l0 12"/>',
    name: { en: 'ULID Generator', ru: 'Генератор ULID' },
    desc: {
      en: 'Generate sortable, URL-safe ULIDs with a decoded timestamp.',
      ru: 'Генерация сортируемых ULID и разбор встроенной метки времени.',
    },
    keywords: 'ulid identifier sortable timestamp',
    mount(root, ctx) {
      let count = 10;
      const output = area({ readOnly: true, rows: 14 });
      const info = h('div');

      const decode = (value: string): { time: Date; random: string } | null => {
        if (value.length !== 26) return null;
        let time = 0;
        for (const char of value.slice(0, 10)) {
          const index = ULID_ALPHABET.indexOf(char.toUpperCase());
          if (index < 0) return null;
          time = time * 32 + index;
        }
        return { time: new Date(time), random: value.slice(10) };
      };

      const generate = () => {
        const values = Array.from({ length: count }, () => ulid());
        output.value = values.join('\n');
        const decoded = decode(values[0]);
        info.replaceChildren(
          stats([
            [ctx.pick('Timestamp', 'Метка времени'), decoded ? decoded.time.toISOString() : '—'],
            [ctx.pick('Count', 'Количество'), count],
            [ctx.pick('Length', 'Длина'), 26],
          ]),
        );
      };

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          h(
            'div',
            { class: 'dt-inline-form' },
            field(
              ctx.pick('Count', 'Количество'),
              select(['1', '5', '10', '25', '50'].map((value) => ({ value, label: value })), '10', (value) => {
                count = Number(value);
                generate();
              }),
            ),
            btn(ctx.pick('Generate', 'Сгенерировать'), generate, { variant: 'primary' }),
            copyBtn(() => output.value),
            downloadBtn(() => output.value, 'ulids.txt'),
          ),
          pane('ULID', output),
          info,
        ),
      );
      generate();
    },
  });
}

function rsaTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'generators-rsa',
    group: 'generators',
    icon: '<path d="M11 4a5 5 0 1 0 2.6 9.3l1.4 1.4v2h2v2h2v2h3v-3l-8.1 -8.1a5 5 0 0 0 -4.9 -5.6z"/><path d="M8 8h.01"/>',
    name: { en: 'RSA Key Generator', ru: 'Генератор RSA-ключей' },
    desc: {
      en: 'Create RSA key pairs in PEM format for testing and development.',
      ru: 'Создание пар RSA-ключей в формате PEM для разработки и тестов.',
    },
    keywords: 'rsa key pair pem pkcs8 spki certificate cryptography',
    mount(root, ctx) {
      let bits = 2048;
      const privateArea = area({ readOnly: true, rows: 12 });
      const publicArea = area({ readOnly: true, rows: 8 });
      const error = errorSlot();
      const info = h('div');
      const generateButton = btn(ctx.pick('Generate key pair', 'Сгенерировать пару'), () => void generate(), {
        variant: 'primary',
        icon: '<path d="M12 3v12"/><path d="M8 11l4 4l4 -4"/><path d="M4 19h16"/>',
      });

      const generate = async () => {
        generateButton.disabled = true;
        setError(error, null);
        try {
          const before = performance.now();
          const result = await ctx.rpc<{ privateKey: string; publicKey: string }>('rsa', { bits });
          privateArea.value = result.privateKey;
          publicArea.value = result.publicKey;
          info.replaceChildren(
            stats([
              [ctx.pick('Key size', 'Размер ключа'), `${bits} bit`],
              [ctx.pick('Elapsed', 'Время'), `${Math.round(performance.now() - before)} ms`],
              [ctx.pick('Format', 'Формат'), 'PKCS#8 / SPKI PEM'],
            ]),
          );
        } catch (cause) {
          setError(error, cause instanceof Error ? cause.message : String(cause));
        } finally {
          generateButton.disabled = false;
        }
      };

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          h(
            'div',
            { class: 'dt-inline-form' },
            field(
              ctx.pick('Key size', 'Размер ключа'),
              select(
                [
                  { value: '2048', label: '2048 bit' },
                  { value: '3072', label: '3072 bit' },
                  { value: '4096', label: '4096 bit' },
                ],
                '2048',
                (value) => {
                  bits = Number(value);
                },
              ),
            ),
            generateButton,
          ),
          error,
          info,
          split(
            pane(ctx.pick('Private key', 'Приватный ключ'), privateArea, [copyBtn(() => privateArea.value), downloadBtn(() => privateArea.value, 'private.pem')]),
            pane(ctx.pick('Public key', 'Публичный ключ'), publicArea, [copyBtn(() => publicArea.value), downloadBtn(() => publicArea.value, 'public.pem')]),
          ),
          note(ctx.pick('Keys are generated locally in the extension host and never leave your machine.', 'Ключи создаются локально в процессе расширения и не покидают вашу машину.'), 'info'),
        ),
      );
    },
  });
}

function semverTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'generators-semver',
    group: 'generators',
    icon: '<path d="M7 7h10v10"/><path d="M7 17l10 -10"/><path d="M4 20l3 -3"/><path d="M17 4l3 -3"/>',
    name: { en: 'Semver Calculator', ru: 'Калькулятор SemVer' },
    desc: {
      en: 'Compare versions, check ranges and compute the next release numbers.',
      ru: 'Сравнение версий, проверка диапазонов и следующие номера релизов.',
    },
    keywords: 'semver version compare range bump next release',
    mount(root, ctx) {
      const left = textInput({ value: '1.2.3', class: 'dt-mono' });
      const right = textInput({ value: '2.0.0-beta.1', class: 'dt-mono' });
      const range = textInput({ value: '>=1.0.0 <2.0.0', class: 'dt-mono' });
      const output = h('div');
      const error = errorSlot();

      const update = () => {
        try {
          setError(error, null);
          const a = valid(left.value);
          const b = valid(right.value);
          const rows: Array<[string, string]> = [];

          if (a && b) {
            const difference = compare(a, b);
            rows.push([ctx.pick('Comparison', 'Сравнение'), difference === 0 ? `${a} = ${b}` : difference < 0 ? `${a} < ${b}` : `${a} > ${b}`]);
            rows.push(['compare()', String(difference)]);
          }
          if (a) {
            rows.push([ctx.pick('Major', 'Мажорная'), String(major(a))]);
            rows.push([ctx.pick('Minor', 'Минорная'), String(minor(a))]);
            rows.push([ctx.pick('Patch', 'Патч'), String(patch(a))]);
            rows.push([ctx.pick('Next patch', 'Следующий патч'), inc(a, 'patch') ?? '—']);
            rows.push([ctx.pick('Next minor', 'Следующий минор'), inc(a, 'minor') ?? '—']);
            rows.push([ctx.pick('Next major', 'Следующий мажор'), inc(a, 'major') ?? '—']);
          }
          if (validRange(range.value)) {
            rows.push([ctx.pick('Range is valid', 'Диапазон корректен'), range.value]);
            if (a) rows.push([ctx.pick('Version in range', 'Версия в диапазоне'), satisfies(a, range.value) ? '✓ true' : '✗ false']);
            if (b) rows.push([`${b} ${ctx.pick('in range', 'в диапазоне')}`, satisfies(b, range.value) ? '✓ true' : '✗ false']);
          } else {
            rows.push([ctx.pick('Range is valid', 'Диапазон корректен'), '✗ invalid']);
          }

          output.replaceChildren(table([ctx.pick('Metric', 'Показатель'), ctx.pick('Value', 'Значение')], rows));
        } catch (cause) {
          setError(error, cause instanceof Error ? cause.message : String(cause));
          output.replaceChildren();
        }
      };

      for (const element of [left, right, range]) element.addEventListener('input', update);

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          h(
            'div',
            { class: 'dt-inline-form' },
            field(ctx.pick('Version A', 'Версия A'), left),
            field(ctx.pick('Version B', 'Версия B'), right),
            field(ctx.pick('Range', 'Диапазон'), range),
          ),
          error,
          pane(ctx.pick('Result', 'Результат'), output),
        ),
      );
      update();
    },
  });
}

export const generatorTools = [hashTool(), loremTool(), passwordTool(), uuidTool(), ulidTool(), rsaTool(), semverTool()];
