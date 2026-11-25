/** Fake data generator: names, contacts, addresses and companies with CSV/JSON export. */
import {
  btn,
  checkbox,
  copyText,
  downloadBlob,
  field,
  note,
  pane,
  select,
  split,
  stats,
  table,
  textInput,
  toolbar,
} from '../components.ts';
import { h } from '../dom.ts';
import { defineTool } from '../tool-types.ts';

type Locale = 'ru' | 'en';
type ColumnId =
  | 'firstName'
  | 'lastName'
  | 'patronymic'
  | 'fullName'
  | 'email'
  | 'phone'
  | 'address'
  | 'city'
  | 'region'
  | 'zip'
  | 'country'
  | 'company'
  | 'birthDate'
  | 'username'
  | 'password';

interface Column {
  id: ColumnId;
  label: [string, string];
}

const COLUMNS: Column[] = [
  { id: 'firstName', label: ['First name', 'Имя'] },
  { id: 'lastName', label: ['Last name', 'Фамилия'] },
  { id: 'patronymic', label: ['Patronymic', 'Отчество'] },
  { id: 'fullName', label: ['Full name', 'ФИО'] },
  { id: 'email', label: ['Email', 'Email'] },
  { id: 'phone', label: ['Phone', 'Телефон'] },
  { id: 'address', label: ['Address', 'Адрес'] },
  { id: 'city', label: ['City', 'Город'] },
  { id: 'region', label: ['Region', 'Регион'] },
  { id: 'zip', label: ['ZIP', 'Индекс'] },
  { id: 'country', label: ['Country', 'Страна'] },
  { id: 'company', label: ['Company', 'Компания'] },
  { id: 'birthDate', label: ['Birth date', 'Дата рождения'] },
  { id: 'username', label: ['Username', 'Логин'] },
  { id: 'password', label: ['Password', 'Пароль'] },
];

const DATA: Record<Locale, {
  firstMale: string[];
  firstFemale: string[];
  lastMale: string[];
  lastFemale: string[];
  middleMale: string[];
  middleFemale: string[];
  cities: string[];
  regions: string[];
  streets: string[];
  countries: string[];
  companies: string[];
  domains: string[];
}> = {
  ru: {
    firstMale: ['Александр', 'Дмитрий', 'Иван', 'Сергей', 'Алексей', 'Михаил', 'Андрей', 'Павел'],
    firstFemale: ['Мария', 'Анна', 'Екатерина', 'Ольга', 'Наталья', 'Юлия', 'Татьяна', 'Елена'],
    lastMale: ['Иванов', 'Кузнецов', 'Соколов', 'Новиков', 'Морозов', 'Волков', 'Фёдоров', 'Романов'],
    lastFemale: ['Иванова', 'Кузнецова', 'Соколова', 'Новикова', 'Морозова', 'Волкова', 'Фёдорова', 'Романова'],
    middleMale: ['Александрович', 'Дмитриевич', 'Иванович', 'Михайлович', 'Николаевич'],
    middleFemale: ['Александровна', 'Дмитриевна', 'Ивановна', 'Михайловна', 'Николаевна'],
    cities: ['Москва', 'Санкт-Петербург', 'Казань', 'Новосибирск', 'Екатеринбург', 'Нижний Новгород', 'Краснодар', 'Самара', 'Омск', 'Ростов-на-Дону'],
    regions: ['Московская область', 'Ленинградская область', 'Республика Татарстан', 'Новосибирская область', 'Свердловская область', 'Краснодарский край'],
    streets: ['ул. Ленина', 'ул. Гагарина', 'пр-т Мира', 'ул. Советская', 'ул. Пушкина', 'наб. Реки Фонтанки', 'ул. Садовая'],
    countries: ['Россия', 'Беларусь', 'Казахстан', 'Армения', 'Грузия'],
    companies: ['ООО «Ромашка»', 'АО «Вектор»', 'ООО «ТехноСофт»', 'ПАО «Северсталь-Инжиниринг»', 'ООО «ДатаЛаб»', 'АО «Кодекс»'],
    domains: ['example.ru', 'mail.ru', 'yandex.ru', 'inbox.ru', 'dev.tools'],
  },
  en: {
    firstMale: ['James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph'],
    firstFemale: ['Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan', 'Jessica'],
    lastMale: ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'],
    lastFemale: ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'],
    middleMale: ['A.', 'B.', 'C.', 'D.', 'E.', 'J.'],
    middleFemale: ['A.', 'B.', 'C.', 'D.', 'E.', 'J.'],
    cities: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Seattle', 'Boston', 'Austin', 'Denver', 'Miami'],
    regions: ['California', 'Texas', 'New York', 'Florida', 'Washington', 'Illinois', 'Colorado'],
    streets: ['Main St', 'Oak Ave', 'Maple Dr', 'Cedar Ln', 'Pine Rd', 'Sunset Blvd', 'Park Ave'],
    countries: ['United States', 'United Kingdom', 'Canada', 'Australia', 'Germany'],
    companies: ['Acme Corp', 'Globex', 'Initech', 'Umbrella Labs', 'DevTools Inc', 'Northwind'],
    domains: ['example.com', 'mail.com', 'gmail.com', 'outlook.com', 'dev.tools'],
  },
};

const TRANSLITERATION: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

const transliterate = (value: string): string =>
  value
    .toLowerCase()
    .split('')
    .map((char) => TRANSLITERATION[char] ?? char)
    .join('')
    .replace(/[^a-z0-9]+/g, '.');

const mulberry32 = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const hashSeed = (text: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

function fakeDataTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'generators-fake-data',
    group: 'generators',
    icon: '<path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0"/><path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2"/><path d="M18 3l3 0"/><path d="M19.5 1.5v3"/>',
    name: { en: 'Fake Data Generator', ru: 'Генератор данных' },
    desc: {
      en: 'Generate realistic names, phones, addresses, emails and companies, then export CSV or JSON.',
      ru: 'Генерация реалистичных ФИО, телефонов, адресов, email и компаний с экспортом в CSV или JSON.',
    },
    keywords: 'fake data test data names фio email phone address csv json mock seed generator',
    fill: true,
    mount(root, ctx) {
      let locale: Locale = 'ru';
      let rows = 20;
      let seed = 'dev-tools';
      let delimiter: ',' | ';' | '\t' = ',';
      let template = '{lastName} {firstName}';
      let selected = new Set<ColumnId>(['firstName', 'lastName', 'fullName', 'email', 'phone', 'city']);
      let records: Array<Record<string, string>> = [];

      const columnsHost = h('div', { class: 'dt-check-grid' });
      const previewHost = h('div');
      const info = h('div');

      const randomValue = (random: () => number, list: string[]): string => list[Math.floor(random() * list.length)];

      const generateRecord = (random: () => number, data: (typeof DATA)[Locale]): Record<string, string> => {
        const female = random() < 0.5;
        const first = randomValue(random, female ? data.firstFemale : data.firstMale);
        const last = randomValue(random, female ? data.lastFemale : data.lastMale);
        const middle = randomValue(random, female ? data.middleFemale : data.middleMale);
        const city = randomValue(random, data.cities);
        const street = randomValue(random, data.streets);
        const number = 1 + Math.floor(random() * 180);
        const flat = 1 + Math.floor(random() * 120);
        const firstLatin = transliterate(first);
        const lastLatin = transliterate(last);
        const suffix = 1 + Math.floor(random() * 999);
        const year = 1960 + Math.floor(random() * 46);
        const month = 1 + Math.floor(random() * 12);
        const day = 1 + Math.floor(random() * 28);
        const password = Array.from({ length: 12 }, () =>
          'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%'[
            Math.floor(random() * 67)
          ],
        ).join('');
        return {
          firstName: first,
          lastName: last,
          patronymic: middle,
          fullName: locale === 'ru' ? `${last} ${first} ${middle}` : `${first} ${last}`,
          email: `${firstLatin}.${lastLatin}${suffix}@${randomValue(random, data.domains)}`,
          phone:
            locale === 'ru'
              ? `+7 (9${10 + Math.floor(random() * 89)}) ${100 + Math.floor(random() * 899)}-${10 + Math.floor(random() * 89)}-${10 + Math.floor(random() * 89)}`
              : `+1 (${200 + Math.floor(random() * 700)}) ${100 + Math.floor(random() * 899)}-${1000 + Math.floor(random() * 8999)}`,
          address:
            locale === 'ru'
              ? `${street}, д. ${number}, кв. ${flat}`
              : `${number} ${street}, Apt ${flat}`,
          city,
          region: randomValue(random, data.regions),
          zip: locale === 'ru' ? String(100000 + Math.floor(random() * 899999)) : String(10000 + Math.floor(random() * 89999)),
          country: randomValue(random, data.countries),
          company: randomValue(random, data.companies),
          birthDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
          username: `${firstLatin}.${lastLatin}${suffix}`.slice(0, 24),
          password,
        };
      };

      const templateValue = (record: Record<string, string>): string =>
        template.replace(/\{(\w+)\}/g, (_match, key: string) => record[key] ?? '');

      const visibleColumns = (): Column[] => COLUMNS.filter((column) => selected.has(column.id));

      const renderColumns = (): void => {
        columnsHost.replaceChildren();
        for (const column of COLUMNS) {
          columnsHost.appendChild(
            checkbox(
              ctx.pick(column.label[0], column.label[1]),
              selected.has(column.id),
              (checked) => {
                if (checked) selected.add(column.id);
                else selected.delete(column.id);
                generate();
              },
            ),
          );
        }
      };

      const toCsv = (): string => {
        const columns = visibleColumns();
        const header = [...columns.map((column) => ctx.pick(column.label[0], column.label[1])), ...(template.trim() ? [ctx.pick('Custom', 'Свой шаблон')] : [])];
        const escapeCell = (value: string): string =>
          /["\n\r]|,|;|\t/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
        const lines = [header.map(escapeCell).join(delimiter)];
        for (const record of records) {
          const values = columns.map((column) => record[column.id] ?? '');
          if (template.trim()) values.push(templateValue(record));
          lines.push(values.map(escapeCell).join(delimiter));
        }
        return lines.join('\r\n');
      };

      const filteredRecords = (): Array<Record<string, string>> =>
        records.map((record) => {
          const output: Record<string, string> = {};
          for (const column of visibleColumns()) output[column.id] = record[column.id] ?? '';
          if (template.trim()) output.custom = templateValue(record);
          return output;
        });

      const generate = (): void => {
        const random = mulberry32(hashSeed(`${seed}:${locale}:${rows}`));
        const data = DATA[locale];
        records = Array.from({ length: Math.max(1, Math.min(1000, rows)) }, () => generateRecord(random, data));
        const columns = visibleColumns();
        previewHost.replaceChildren(
          h(
            'div',
            { class: 'dt-stack' },
            stats([
              [ctx.pick('Rows', 'Строк'), records.length],
              [ctx.pick('Columns', 'Колонок'), columns.length + (template.trim() ? 1 : 0)],
              [ctx.pick('Locale', 'Язык'), locale.toUpperCase()],
            ]),
            records.length
              ? table(
                  [...columns.map((column) => ctx.pick(column.label[0], column.label[1])), ...(template.trim() ? [ctx.pick('Custom', 'Свой шаблон')] : [])],
                  filteredRecords()
                    .slice(0, 100)
                    .map((record) => {
                      const values = columns.map((column) => record[column.id] ?? '');
                      if (template.trim()) values.push(record.custom ?? '');
                      return values;
                    }),
                )
              : note(ctx.pick('Select at least one column.', 'Выберите хотя бы одну колонку.'), 'warn'),
            records.length > 100
              ? h('div', { class: 'dt-hint' }, ctx.pick('Preview shows the first 100 rows; export includes all.', 'В предпросмотре первые 100 строк; экспорт включает все.'))
              : null,
          ),
        );
        info.textContent = new Date().toLocaleTimeString();
      };

      const optionsPane = pane(
        ctx.pick('Options', 'Параметры'),
        h(
          'div',
          { class: 'dt-stack' },
          h(
            'div',
            { class: 'dt-inline-form' },
            field(
              ctx.pick('Locale', 'Язык'),
              select(
                [
                  { value: 'ru', label: 'Русский' },
                  { value: 'en', label: 'English' },
                ],
                locale,
                (value) => {
                  locale = value === 'en' ? 'en' : 'ru';
                  generate();
                },
              ),
            ),
            field(
              ctx.pick('Rows', 'Строк'),
              textInput({
                type: 'number',
                value: rows,
                min: 1,
                max: 1000,
                oninput: (value) => {
                  const parsed = Number(value);
                  if (Number.isFinite(parsed) && parsed > 0) {
                    rows = Math.min(1000, Math.round(parsed));
                    generate();
                  }
                },
              }),
            ),
          ),
          h(
            'div',
            { class: 'dt-inline-form' },
            field(
              ctx.pick('Seed', 'Сид'),
              textInput({
                value: seed,
                oninput: (value) => {
                  seed = value;
                },
              }),
            ),
            field(
              ctx.pick('CSV delimiter', 'Разделитель CSV'),
              select(
                [
                  { value: ',', label: ', (comma)' },
                  { value: ';', label: '; (semicolon)' },
                  { value: '\t', label: '⇥ (tab)' },
                ],
                delimiter,
                (value) => {
                  delimiter = value === ';' ? ';' : value === '\t' ? '\t' : ',';
                },
              ),
            ),
          ),
          field(
            ctx.pick('Custom template', 'Свой шаблон'),
            textInput({
              value: template,
              placeholder: '{lastName} {firstName}',
              oninput: (value) => {
                template = value;
                generate();
              },
            }),
            ctx.pick('Placeholders: {firstName}, {lastName}, {city}, {company}, …', 'Плейсхолдеры: {firstName}, {lastName}, {city}, {company}, …'),
          ),
          h('div', { class: 'dt-label' }, ctx.pick('Columns', 'Колонки')),
          columnsHost,
          toolbar(
            btn(ctx.pick('Generate', 'Сгенерировать'), generate, { variant: 'primary' }),
            btn(
              ctx.pick('Random seed', 'Случайный сид'),
              () => {
                seed = Math.random().toString(36).slice(2, 10);
                generate();
              },
              { variant: 'ghost' },
            ),
          ),
          h('div', { class: 'dt-hint' }, `${ctx.pick('Generated', 'Сгенерировано')}: ${info.textContent}`),
        ),
      );

      const exportPane = pane(
        ctx.pick('Export', 'Экспорт'),
        h(
          'div',
          { class: 'dt-stack' },
          toolbar(
            btn(ctx.pick('Download CSV', 'Скачать CSV'), () => downloadBlob('fake-data.csv', new Blob([toCsv()], { type: 'text/csv;charset=utf-8' })), { variant: 'primary' }),
            btn(
              ctx.pick('Download JSON', 'Скачать JSON'),
              () => downloadBlob('fake-data.json', new Blob([JSON.stringify(filteredRecords(), null, 2)], { type: 'application/json' })),
              { variant: 'ghost' },
            ),
            btn(ctx.pick('Copy CSV', 'Копировать CSV'), () => void copyText(toCsv()), { variant: 'ghost' }),
          ),
        ),
      );

      renderColumns();
      info.textContent = new Date().toLocaleTimeString();
      generate();

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          split(
            h('div', { class: 'dt-col' }, optionsPane, exportPane),
            h('div', { class: 'dt-col' }, pane(ctx.pick('Preview', 'Предпросмотр'), previewHost)),
          ),
        ),
      );
    },
  });
}

export const fakeDataTools = [fakeDataTool()];
