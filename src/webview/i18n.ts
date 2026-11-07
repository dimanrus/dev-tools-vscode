/** Bilingual UI strings. English is the primary language. */

export type Lang = 'en' | 'ru';

type Entry = readonly [en: string, ru: string];

const dict: Record<string, Entry> = {
  'app.tagline': ['A developer toolbox in one place', 'Инструменты разработчика в одном месте'],
  'search.placeholder': ['Search tools…', 'Поиск инструментов…'],
  'search.hint': ['Ctrl+K', 'Ctrl+K'],
  'search.empty': ['No tools match your search', 'Ничего не найдено'],
  'nav.count': ['{n} tools', 'Инструментов: {n}'],

  'action.copy': ['Copy', 'Копировать'],
  'action.copied': ['Copied!', 'Скопировано!'],
  'action.paste': ['Paste', 'Вставить'],
  'action.clear': ['Clear', 'Очистить'],
  'action.download': ['Download', 'Скачать'],
  'action.upload': ['Choose file', 'Выбрать файл'],
  'action.swap': ['Swap', 'Поменять'],
  'action.sample': ['Load sample', 'Загрузить пример'],
  'action.reset': ['Reset', 'Сбросить'],
  'action.apply': ['Apply', 'Применить'],
  'action.generate': ['Generate', 'Сгенерировать'],
  'action.browse': ['Browse', 'Выбрать'],

  'label.input': ['Input', 'Входные данные'],
  'label.output': ['Output', 'Результат'],
  'label.result': ['Result', 'Результат'],
  'label.options': ['Options', 'Параметры'],
  'label.preview': ['Preview', 'Предпросмотр'],
  'label.error': ['Error', 'Ошибка'],
  'label.empty': ['Nothing to show yet', 'Пока нечего показать'],
  'label.copyFailed': ['Copy failed', 'Не удалось скопировать'],
  'label.dropHint': ['Drop a file here or click to browse', 'Перетащите файл сюда или нажмите для выбора'],
  'label.characters': ['characters', 'символов'],
  'label.lines': ['lines', 'строк'],

  'group.converters': ['Converters', 'Конвертеры'],
  'group.text': ['Text', 'Текст'],
  'group.encoders': ['Encoders / Decoders', 'Кодирование / Декодирование'],
  'group.formatters': ['Formatters', 'Форматирование'],
  'group.generators': ['Generators', 'Генераторы'],
  'group.graphic': ['Graphic & Color', 'Графика и цвет'],
  'group.testers': ['Testers', 'Тестирование'],
  'group.icons': ['Icons', 'Иконки'],
  'group.thirdparty': ['Extras', 'Дополнительно'],

  'lang.switch': ['Switch to Russian', 'Переключить на английский'],
  'notice.hostOnly': ['This tool runs inside VS Code only', 'Этот инструмент работает только внутри VS Code'],
  'notice.invalid': ['Invalid input', 'Некорректные данные'],
};

let lang: Lang = 'en';
const listeners = new Set<() => void>();

export function getLang(): Lang {
  return lang;
}

export function setLang(next: Lang): void {
  if (lang === next) return;
  lang = next;
  document.documentElement.lang = next;
  document.body.dataset.lang = next;
  for (const listener of listeners) listener();
}

export function onLangChange(listener: () => void): void {
  listeners.add(listener);
}

export function t(key: string, vars?: Record<string, string | number>): string {
  const entry = dict[key];
  let value = entry ? (lang === 'ru' ? entry[1] : entry[0]) : key;
  if (vars) {
    for (const [name, replacement] of Object.entries(vars)) {
      value = value.split(`{${name}}`).join(String(replacement));
    }
  }
  return value;
}

/** Inline bilingual text helper. */
export function pick(en: string, ru: string): string {
  return lang === 'ru' ? ru : en;
}
