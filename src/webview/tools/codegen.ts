/** Code generators: JSON → code (JSON serializers) and XML → code (System.Xml.Serialization). */
import {
  area,
  checkbox,
  copyBtn,
  downloadBtn,
  errorSlot,
  field,
  pane,
  segmented,
  select,
  setError,
  split,
  textInput,
  toolbar,
} from '../components.ts';
import { h } from '../dom.ts';
import { defineTool, type ToolContext, type ToolDef } from '../tool-types.ts';
import {
  FILE_EXTENSIONS,
  LANGUAGE_LABELS,
  generateCode,
  generateUsageSnippet,
  pascalCase,
  type DotNetSerializer,
  type TargetLanguage,
} from '../lib/codegen.ts';

const JSON_SAMPLE = '{\n  "id": 1,\n  "name": "Ada",\n  "roles": ["admin"],\n  "profile": { "city": "London", "score": 9.5 }\n}';

const XML_SAMPLE =
  '<user id="1">\n  <name>Ada</name>\n  <roles>\n    <role>admin</role>\n  </roles>\n  <profile>\n    <city>London</city>\n    <score>9.5</score>\n  </profile>\n</user>';

function inferScalar(text: string): string | number | boolean | null {
  if (!text) return null;
  if (/^-?\d+$/.test(text)) return Number.parseInt(text, 10);
  if (/^-?\d*\.\d+$/.test(text)) return Number.parseFloat(text);
  if (/^(true|false)$/i.test(text)) return text.toLowerCase() === 'true';
  return text;
}

/** XML attributes are prefixed with "@" so the generators can emit [XmlAttribute]. */
function xmlToValue(element: Element): unknown {
  const result: Record<string, unknown> = {};

  for (const attribute of Array.from(element.attributes)) {
    if (attribute.name === 'xmlns' || attribute.name.startsWith('xmlns:')) continue;
    result[`@${attribute.localName}`] = inferScalar(attribute.value);
  }

  const children = Array.from(element.children);
  if (!children.length) {
    const text = (element.textContent ?? '').trim();
    if (!Object.keys(result).length) return inferScalar(text);
    if (text) result.text = inferScalar(text);
    return result;
  }

  const grouped = new Map<string, Element[]>();
  for (const child of children) {
    const list = grouped.get(child.localName) ?? [];
    list.push(child);
    grouped.set(child.localName, list);
  }
  for (const [name, nodes] of grouped) {
    const values = nodes.map(xmlToValue);
    result[name] = values.length === 1 ? values[0] : values;
  }
  return result;
}

function buildCodegenTool(format: 'json' | 'xml'): ToolDef {
  const isJson = format === 'json';

  return defineTool({
    id: isJson ? 'converters-json-code' : 'converters-xml-code',
    group: 'converters',
    icon: isJson
      ? '<path d="M8 4l-4 4l4 4"/><path d="M16 4l4 4l-4 4"/><path d="M14 3l-4 18"/>'
      : '<path d="M8 7l-5 5l5 5"/><path d="M16 7l5 5l-5 5"/><path d="M13 5l-2 14"/>',
    name: isJson ? { en: 'JSON → Code', ru: 'JSON → Код' } : { en: 'XML → Code', ru: 'XML → Код' },
    desc: isJson
      ? {
          en: 'Generate C#, F#, TypeScript, JavaScript or PHP models from a JSON document.',
          ru: 'Генерация моделей C#, F#, TypeScript, JavaScript или PHP по JSON.',
        }
      : {
          en: 'Generate C#, F#, TypeScript, JavaScript or PHP models from XML (System.Xml.Serialization for .NET).',
          ru: 'Генерация моделей C#, F#, TypeScript, JavaScript или PHP по XML (для .NET — System.Xml.Serialization).',
        },
    keywords: isJson
      ? 'json c# f# typescript javascript php class model dto record newtonsoft system.text.json'
      : 'xml xsd c# f# typescript javascript php class model dto xmlelement xmlattribute xmlroot xmlserializer',
    mount(root: HTMLElement, ctx: ToolContext) {
      let language: TargetLanguage = 'csharp';
      let serializer: DotNetSerializer = 'system';
      let records = false;
      let rootName = 'Root';
      let rootXmlName = '';
      let namespace = 'DevTools.Models';

      const input = area({ rows: 16, value: isJson ? JSON_SAMPLE : XML_SAMPLE });
      const output = area({ readOnly: true, rows: 16 });
      const usage = area({ readOnly: true, rows: 9 });
      const error = errorSlot();

      const inputPane = pane(isJson ? 'JSON' : 'XML', input);
      const outputPane = pane(LANGUAGE_LABELS[language], output);
      const outputTitle = outputPane.querySelector('.dt-pane-title');

      const rootInput = textInput({
        value: rootName,
        oninput: (value) => {
          rootName = value;
          generate();
        },
      });

      const namespaceInput = textInput({
        value: namespace,
        oninput: (value) => {
          namespace = value;
          generate();
        },
      });
      const namespaceWrap = field(ctx.pick('Namespace', 'Пространство имён'), namespaceInput);

      const serializerWrap = isJson
        ? h(
            'div',
            { class: 'dt-field' },
            h('span', { class: 'dt-label' }, ctx.pick('Serializer', 'Сериализатор')),
            segmented(
              [
                { value: 'system', label: 'System.Text.Json' },
                { value: 'newtonsoft', label: 'Newtonsoft' },
              ],
              serializer,
              (value) => {
                serializer = value as DotNetSerializer;
                generate();
              },
            ),
          )
        : null;

      const recordsWrap = isJson
        ? checkbox(ctx.pick('Use record', 'Использовать record'), false, (value) => {
            records = value;
            generate();
          })
        : null;

      const languageSelect = select(
        [
          { value: 'csharp', label: 'C#' },
          { value: 'fsharp', label: 'F#' },
          { value: 'typescript', label: 'TypeScript' },
          { value: 'javascript', label: 'JavaScript' },
          { value: 'php', label: 'PHP' },
        ],
        language,
        (value) => {
          language = value as TargetLanguage;
          if (outputTitle) outputTitle.textContent = LANGUAGE_LABELS[language];
          syncVisibility();
          generate();
        },
      );

      const formatHint = h(
        'span',
        { class: 'dt-hint' },
        isJson
          ? ctx.pick('JSON uses System.Text.Json or Newtonsoft.Json attributes.', 'Для JSON — атрибуты System.Text.Json или Newtonsoft.Json.')
          : ctx.pick(
              'XML uses System.Xml.Serialization (XmlSerializer): [XmlRoot], [XmlAttribute], [XmlElement].',
              'Для XML — System.Xml.Serialization (XmlSerializer): [XmlRoot], [XmlAttribute], [XmlElement].',
            ),
      );

      const phpHint = h(
        'span',
        { class: 'dt-hint' },
        ctx.pick(
          'PHP has no built-in typed XML/JSON mapping — the classes describe the shape; map values manually.',
          'В PHP нет встроенного типизированного маппинга XML/JSON — классы описывают структуру, значения заполняются вручную.',
        ),
      );

      const syncVisibility = (): void => {
        const dotnet = language === 'csharp' || language === 'fsharp';
        if (serializerWrap) serializerWrap.hidden = !dotnet;
        if (recordsWrap) recordsWrap.hidden = language !== 'csharp';
        namespaceWrap.hidden = !dotnet;
        phpHint.hidden = language !== 'php';
      };

      function generate(): void {
        try {
          let value: unknown;
          if (isJson) {
            value = JSON.parse(input.value);
          } else {
            const document = new DOMParser().parseFromString(input.value, 'application/xml');
            const parserError = document.querySelector('parsererror');
            if (parserError) throw new Error(parserError.textContent?.trim() || 'Invalid XML');
            rootXmlName = document.documentElement.localName;
            value = xmlToValue(document.documentElement);
            const suggested = pascalCase(rootXmlName);
            if (!rootName.trim() || rootName === 'Root') {
              rootName = suggested;
              rootInput.value = suggested;
            }
          }
          const options = { language, serializer, format, rootName, namespace, records, rootXmlName };
          output.value = generateCode(value, options);
          usage.value = generateUsageSnippet(options);
          setError(error, null);
        } catch (cause) {
          setError(error, cause instanceof Error ? cause.message : String(cause));
          output.value = '';
          usage.value = '';
        }
      }

      input.addEventListener('input', generate);
      syncVisibility();
      generate();

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          toolbar(languageSelect, serializerWrap, recordsWrap),
          h(
            'div',
            { class: 'dt-inline-form' },
            field(ctx.pick('Root class name', 'Имя корневого класса'), rootInput),
            namespaceWrap,
          ),
          error,
          split(
            inputPane,
            h(
              'div',
              { class: 'dt-stack' },
              outputPane,
              toolbar(copyBtn(() => output.value), downloadBtn(() => output.value, () => `Models.${FILE_EXTENSIONS[language]}`)),
            ),
          ),
          pane(ctx.pick('Usage', 'Использование'), usage, [copyBtn(() => usage.value)]),
          formatHint,
          phpHint,
        ),
      );
    },
  });
}

export const jsonCodegenTool = buildCodegenTool('json');
export const xmlCodegenTool = buildCodegenTool('xml');
