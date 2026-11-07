// AUTO-GENERATED FILE — do not edit by hand.
// Source of truth: src/webview/tools/*.ts
// Refresh with: node scripts/generate-catalog.mts

export type CatalogGroup =
  | 'converters'
  | 'text'
  | 'encoders'
  | 'formatters'
  | 'generators'
  | 'graphic'
  | 'testers'
  | 'icons'
  | 'thirdparty';

export interface CatalogEntry {
  id: string;
  group: CatalogGroup;
  keywords: string;
  name: { en: string; ru: string };
  desc: { en: string; ru: string };
}

export const CATALOG: CatalogEntry[] = [
  {
    "id": "converters-cron-parser",
    "group": "converters",
    "keywords": "cron crontab schedule quartz",
    "name": {
      "en": "Cron Parser",
      "ru": "Разбор Cron"
    },
    "desc": {
      "en": "Explain a cron expression in plain words and preview the next runs.",
      "ru": "Расшифровка cron-выражения простыми словами и ближайшие запуски."
    }
  },
  {
    "id": "converters-date",
    "group": "converters",
    "keywords": "date time unix epoch iso timestamp timezone",
    "name": {
      "en": "Date & Timestamp",
      "ru": "Дата и время"
    },
    "desc": {
      "en": "Convert timestamps, ISO dates and local time in every direction.",
      "ru": "Преобразование timestamp, ISO и локального времени во все стороны."
    }
  },
  {
    "id": "converters-json-table",
    "group": "converters",
    "keywords": "json csv table tsv excel export",
    "name": {
      "en": "JSON Array to Table / CSV",
      "ru": "JSON-массив в таблицу / CSV"
    },
    "desc": {
      "en": "Turn a JSON array of objects into a readable table and CSV output.",
      "ru": "Преобразование массива JSON в таблицу и CSV."
    }
  },
  {
    "id": "converters-json-yaml",
    "group": "converters",
    "keywords": "json yaml yml convert",
    "name": {
      "en": "JSON ↔ YAML",
      "ru": "JSON ↔ YAML"
    },
    "desc": {
      "en": "Convert JSON to YAML and back with live validation.",
      "ru": "Конвертация JSON в YAML и обратно с проверкой ошибок."
    }
  },
  {
    "id": "converters-number-base",
    "group": "converters",
    "keywords": "number base binary hex octal decimal radix bigint",
    "name": {
      "en": "Number Base",
      "ru": "Системы счисления"
    },
    "desc": {
      "en": "Convert integers between binary, octal, decimal, hex and any base up to 36.",
      "ru": "Перевод целых чисел между двоичной, восьмеричной, десятичной, шестнадцатеричной и любыми системами до 36."
    }
  },
  {
    "id": "converters-json-code",
    "group": "converters",
    "keywords": "json c# f# typescript javascript php class model dto record newtonsoft system.text.json",
    "name": {
      "en": "JSON → Code",
      "ru": "JSON → Код"
    },
    "desc": {
      "en": "Generate C#, F#, TypeScript, JavaScript or PHP models from a JSON document.",
      "ru": "Генерация моделей C#, F#, TypeScript, JavaScript или PHP по JSON."
    }
  },
  {
    "id": "converters-xml-code",
    "group": "converters",
    "keywords": "xml xsd c# f# typescript javascript php class model dto xmlelement xmlattribute xmlroot xmlserializer",
    "name": {
      "en": "XML → Code",
      "ru": "XML → Код"
    },
    "desc": {
      "en": "Generate C#, F#, TypeScript, JavaScript or PHP models from XML (System.Xml.Serialization for .NET).",
      "ru": "Генерация моделей C#, F#, TypeScript, JavaScript или PHP по XML (для .NET — System.Xml.Serialization)."
    }
  },
  {
    "id": "text-escape",
    "group": "text",
    "keywords": "escape unescape string quotes entities backslash",
    "name": {
      "en": "Escape / Unescape",
      "ru": "Экранирование / Снятие"
    },
    "desc": {
      "en": "Escape or unescape strings for JSON, HTML, XML, URL, SQL, C#, shell and more.",
      "ru": "Экранирование и снятие экранирования для JSON, HTML, XML, URL, SQL, C#, shell и др."
    }
  },
  {
    "id": "text-list-comparer",
    "group": "text",
    "keywords": "list compare diff set difference intersection",
    "name": {
      "en": "List Comparer",
      "ru": "Сравнение списков"
    },
    "desc": {
      "en": "Compare two lists line by line: what was added, removed and what is common.",
      "ru": "Сравнение двух списков построчно: что добавлено, удалено и что совпадает."
    }
  },
  {
    "id": "text-markdown-preview",
    "group": "text",
    "keywords": "markdown md html preview",
    "name": {
      "en": "Markdown Preview",
      "ru": "Предпросмотр Markdown"
    },
    "desc": {
      "en": "Render Markdown as HTML, inspect the markup and export the result.",
      "ru": "Рендеринг Markdown в HTML, просмотр разметки и экспорт результата."
    }
  },
  {
    "id": "text-analyzer",
    "group": "text",
    "keywords": "text statistics count words characters entropy readability",
    "name": {
      "en": "Text Analyzer",
      "ru": "Анализ текста"
    },
    "desc": {
      "en": "Count characters, words, sentences and get readability and word statistics.",
      "ru": "Подсчёт символов, слов, предложений, читаемости и статистики слов."
    }
  },
  {
    "id": "text-comparer",
    "group": "text",
    "keywords": "diff compare text changes patch",
    "name": {
      "en": "Text Comparer",
      "ru": "Сравнение текста"
    },
    "desc": {
      "en": "See line, word or character differences between two texts.",
      "ru": "Поиск различий между текстами по строкам, словам и символам."
    }
  },
  {
    "id": "encoders-base64-text",
    "group": "encoders",
    "keywords": "base64 encode decode text utf8",
    "name": {
      "en": "Base64 Text",
      "ru": "Base64: текст"
    },
    "desc": {
      "en": "Encode UTF-8 text to Base64 and decode it back, with URL-safe variant.",
      "ru": "Кодирование UTF-8 текста в Base64 и обратное декодирование, включая URL-safe."
    }
  },
  {
    "id": "encoders-base64-image",
    "group": "encoders",
    "keywords": "base64 image dataurl png jpeg preview",
    "name": {
      "en": "Base64 Image",
      "ru": "Base64: изображение"
    },
    "desc": {
      "en": "Convert images to Base64 data URLs and preview Base64 images.",
      "ru": "Преобразование изображений в Base64 data URL и предпросмотр Base64-изображений."
    }
  },
  {
    "id": "encoders-certificate",
    "group": "encoders",
    "keywords": "x509 certificate pem ssl tls decode",
    "name": {
      "en": "Certificate Decoder",
      "ru": "Разбор сертификата"
    },
    "desc": {
      "en": "Inspect X.509 certificates: subject, issuer, validity, SAN and fingerprints.",
      "ru": "Просмотр X.509 сертификатов: владелец, издатель, срок, SAN и отпечатки."
    }
  },
  {
    "id": "encoders-gzip",
    "group": "encoders",
    "keywords": "gzip compress decompress zlib base64",
    "name": {
      "en": "GZIP",
      "ru": "GZIP"
    },
    "desc": {
      "en": "Compress and decompress GZIP data using Base64 as transport format.",
      "ru": "Сжатие и распаковка GZIP с передачей данных в Base64."
    }
  },
  {
    "id": "encoders-html",
    "group": "encoders",
    "keywords": "html entities escape encode decode",
    "name": {
      "en": "HTML Entities",
      "ru": "HTML-сущности"
    },
    "desc": {
      "en": "Encode special characters as HTML entities and decode them back.",
      "ru": "Кодирование спецсимволов в HTML-сущности и обратное декодирование."
    }
  },
  {
    "id": "encoders-jwt",
    "group": "encoders",
    "keywords": "jwt token json web token hs256 verify sign",
    "name": {
      "en": "JWT Decoder",
      "ru": "JWT-декодер"
    },
    "desc": {
      "en": "Decode JSON Web Tokens, check expiry and verify or create HS256/384/512 signatures.",
      "ru": "Разбор JWT, проверка срока действия и подпись HS256/384/512."
    }
  },
  {
    "id": "encoders-qr-code",
    "group": "encoders",
    "keywords": "qr code generator barcode svg png",
    "name": {
      "en": "QR Code",
      "ru": "QR-код"
    },
    "desc": {
      "en": "Generate QR codes with adjustable error correction and download as PNG or SVG.",
      "ru": "Генерация QR-кодов с выбором уровня коррекции и экспортом в PNG или SVG."
    }
  },
  {
    "id": "encoders-url",
    "group": "encoders",
    "keywords": "url encode decode uri percent query params",
    "name": {
      "en": "URL Encode / Decode",
      "ru": "URL: кодирование"
    },
    "desc": {
      "en": "Encode and decode URLs, inspect query parameters and components.",
      "ru": "Кодирование и декодирование URL, разбор параметров запроса и компонентов."
    }
  },
  {
    "id": "formatters-json",
    "group": "formatters",
    "keywords": "json format beautify minify validate sort",
    "name": {
      "en": "JSON Formatter",
      "ru": "JSON: форматирование"
    },
    "desc": {
      "en": "Beautify, minify, sort and validate JSON with precise error positions.",
      "ru": "Форматирование, минификация, сортировка и проверка JSON с указанием позиции ошибки."
    }
  },
  {
    "id": "formatters-sql",
    "group": "formatters",
    "keywords": "sql format prettify query database",
    "name": {
      "en": "SQL Formatter",
      "ru": "SQL: форматирование"
    },
    "desc": {
      "en": "Pretty-print SQL queries with clause-aware indentation.",
      "ru": "Форматирование SQL-запросов с учётом структуры и отступов."
    }
  },
  {
    "id": "formatters-xml",
    "group": "formatters",
    "keywords": "xml format pretty print validate",
    "name": {
      "en": "XML Formatter",
      "ru": "XML: форматирование"
    },
    "desc": {
      "en": "Validate and pretty-print XML documents with a structure summary.",
      "ru": "Проверка и форматирование XML-документов со сводкой структуры."
    }
  },
  {
    "id": "generators-hash",
    "group": "generators",
    "keywords": "hash md5 sha1 sha256 sha512 crc32 hmac checksum",
    "name": {
      "en": "Hash / Checksum",
      "ru": "Хеш / Контрольная сумма"
    },
    "desc": {
      "en": "Compute MD5, SHA-1/2 and CRC-32 digests, including HMAC signatures.",
      "ru": "Вычисление MD5, SHA-1/2 и CRC-32, включая HMAC-подписи."
    }
  },
  {
    "id": "generators-lorem",
    "group": "generators",
    "keywords": "lorem ipsum placeholder dummy text filler",
    "name": {
      "en": "Lorem Ipsum",
      "ru": "Lorem Ipsum"
    },
    "desc": {
      "en": "Generate placeholder paragraphs, sentences or words as text or HTML.",
      "ru": "Генерация текста-заполнителя: абзацы, предложения или слова, текст или HTML."
    }
  },
  {
    "id": "generators-password",
    "group": "generators",
    "keywords": "password generator random secure entropy",
    "name": {
      "en": "Password Generator",
      "ru": "Генератор паролей"
    },
    "desc": {
      "en": "Create strong random passwords with a configurable character set.",
      "ru": "Создание надёжных паролей с настраиваемым набором символов."
    }
  },
  {
    "id": "generators-uuid",
    "group": "generators",
    "keywords": "uuid guid v4 v7 random identifier",
    "name": {
      "en": "UUID Generator",
      "ru": "Генератор UUID"
    },
    "desc": {
      "en": "Generate RFC 4122 v4, time-ordered v7 and nil UUIDs in bulk.",
      "ru": "Массовая генерация UUID v4, упорядоченных v7 и nil."
    }
  },
  {
    "id": "generators-ulid",
    "group": "generators",
    "keywords": "ulid identifier sortable timestamp",
    "name": {
      "en": "ULID Generator",
      "ru": "Генератор ULID"
    },
    "desc": {
      "en": "Generate sortable, URL-safe ULIDs with a decoded timestamp.",
      "ru": "Генерация сортируемых ULID и разбор встроенной метки времени."
    }
  },
  {
    "id": "generators-rsa",
    "group": "generators",
    "keywords": "rsa key pair pem pkcs8 spki certificate cryptography",
    "name": {
      "en": "RSA Key Generator",
      "ru": "Генератор RSA-ключей"
    },
    "desc": {
      "en": "Create RSA key pairs in PEM format for testing and development.",
      "ru": "Создание пар RSA-ключей в формате PEM для разработки и тестов."
    }
  },
  {
    "id": "generators-semver",
    "group": "generators",
    "keywords": "semver version compare range bump next release",
    "name": {
      "en": "Semver Calculator",
      "ru": "Калькулятор SemVer"
    },
    "desc": {
      "en": "Compare versions, check ranges and compute the next release numbers.",
      "ru": "Сравнение версий, проверка диапазонов и следующие номера релизов."
    }
  },
  {
    "id": "graphic-color-tools",
    "group": "graphic",
    "keywords": "color hex rgb hsl cmyk contrast wcag palette",
    "name": {
      "en": "Color Tools",
      "ru": "Инструменты цвета"
    },
    "desc": {
      "en": "Convert colors, check WCAG contrast and build tints and shades.",
      "ru": "Конвертация цветов, проверка контраста WCAG и построение оттенков."
    }
  },
  {
    "id": "graphic-color-blind",
    "group": "graphic",
    "keywords": "color blind deuteranopia protanopia tritanopia accessibility",
    "name": {
      "en": "Color Blind Simulator",
      "ru": "Симулятор дальтонизма"
    },
    "desc": {
      "en": "Preview colors and images through different color-vision deficiencies.",
      "ru": "Просмотр цветов и изображений при разных типах нарушения цветовосприятия."
    }
  },
  {
    "id": "graphic-image-converter",
    "group": "graphic",
    "keywords": "image convert png jpeg webp resize compress",
    "name": {
      "en": "Image Converter",
      "ru": "Конвертер изображений"
    },
    "desc": {
      "en": "Convert images between PNG, JPEG and WebP with resizing and quality control.",
      "ru": "Конвертация изображений между PNG, JPEG и WebP с изменением размера и качеством."
    }
  },
  {
    "id": "testers-jsonpath",
    "group": "testers",
    "keywords": "jsonpath json query filter test",
    "name": {
      "en": "JSONPath Tester",
      "ru": "JSONPath"
    },
    "desc": {
      "en": "Query JSON documents with JSONPath expressions and inspect matches.",
      "ru": "Поиск по JSON с помощью выражений JSONPath и просмотр совпадений."
    }
  },
  {
    "id": "testers-regex",
    "group": "testers",
    "keywords": "regex regexp pattern match groups replace",
    "name": {
      "en": "Regular Expression Tester",
      "ru": "Тестер регулярных выражений"
    },
    "desc": {
      "en": "Test patterns live, inspect groups, and preview replacements.",
      "ru": "Проверка шаблонов в реальном времени, группы и предпросмотр замены."
    }
  },
  {
    "id": "testers-xml-xsd",
    "group": "testers",
    "keywords": "xml xsd validate schema wellformed",
    "name": {
      "en": "XML / XSD Validator",
      "ru": "Проверка XML / XSD"
    },
    "desc": {
      "en": "Check XML well-formedness and compare the structure against an XSD schema.",
      "ru": "Проверка корректности XML и структуры по XSD-схеме."
    }
  },
  {
    "id": "icons-browser",
    "group": "icons",
    "keywords": "icons tabler svg browse search copy",
    "name": {
      "en": "Icon Browser",
      "ru": "Браузер иконок"
    },
    "desc": {
      "en": "Search the built-in Tabler-style icon set and copy ready-to-use SVG.",
      "ru": "Поиск по встроенному набору иконок в стиле Tabler и копирование готового SVG."
    }
  },
  {
    "id": "thirdparty-duplicates",
    "group": "thirdparty",
    "keywords": "duplicate find repeated unique lines",
    "name": {
      "en": "Duplicate Detector",
      "ru": "Поиск дубликатов"
    },
    "desc": {
      "en": "Find repeated lines or values and see how often they occur.",
      "ru": "Поиск повторяющихся строк и значений и их количество."
    }
  },
  {
    "id": "thirdparty-file-splitter",
    "group": "thirdparty",
    "keywords": "file split chunk parts merge join",
    "name": {
      "en": "File Splitter",
      "ru": "Разделение файла"
    },
    "desc": {
      "en": "Split a file into equal parts or by size, then download each chunk.",
      "ru": "Разделение файла на равные части или по размеру с загрузкой фрагментов."
    }
  },
  {
    "id": "thirdparty-json-schema",
    "group": "thirdparty",
    "keywords": "json schema infer generate validation",
    "name": {
      "en": "JSON Schema Generator",
      "ru": "Генератор JSON Schema"
    },
    "desc": {
      "en": "Infer a JSON Schema (draft 2020-12) from a sample JSON document.",
      "ru": "Построение JSON Schema (draft 2020-12) по примеру JSON."
    }
  },
  {
    "id": "thirdparty-png-compressor",
    "group": "thirdparty",
    "keywords": "png compress optimize resize image",
    "name": {
      "en": "PNG Compressor",
      "ru": "Сжатие PNG"
    },
    "desc": {
      "en": "Reduce PNG size by downscaling and re-encoding the image.",
      "ru": "Уменьшение размера PNG за счёт масштабирования и перекодирования."
    }
  },
  {
    "id": "thirdparty-randomizer",
    "group": "thirdparty",
    "keywords": "random number dice coin shuffle pick lottery",
    "name": {
      "en": "Randomizer",
      "ru": "Рандомайзер"
    },
    "desc": {
      "en": "Random numbers, dice rolls, coin flips, shuffles and prize draws.",
      "ru": "Случайные числа, кубики, монетка, перемешивание и розыгрыши."
    }
  },
  {
    "id": "thirdparty-resx-translator",
    "group": "thirdparty",
    "keywords": "resx resource translation localization",
    "name": {
      "en": "RESX Translator",
      "ru": "Переводчик RESX"
    },
    "desc": {
      "en": "Load a .resx file, translate values in place and export a new file.",
      "ru": "Загрузка .resx, перевод значений и экспорт нового файла."
    }
  },
  {
    "id": "thirdparty-text-delimiter",
    "group": "thirdparty",
    "keywords": "delimiter csv tsv split join columns",
    "name": {
      "en": "Text Delimiter",
      "ru": "Разделители текста"
    },
    "desc": {
      "en": "Split text into columns, rearrange them and join with another delimiter.",
      "ru": "Разбор текста на колонки, перестановка и объединение другим разделителем."
    }
  },
  {
    "id": "thirdparty-xsd-generator",
    "group": "thirdparty",
    "keywords": "xsd xml schema generate",
    "name": {
      "en": "XSD Generator",
      "ru": "Генератор XSD"
    },
    "desc": {
      "en": "Create an XSD schema from an XML sample with inferred types.",
      "ru": "Создание XSD-схемы по примеру XML с определением типов."
    }
  }
];
