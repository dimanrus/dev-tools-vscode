/**
 * Model code generation.
 *
 * JSON input → System.Text.Json / Newtonsoft.Json attributes.
 * XML input  → System.Xml.Serialization attributes (XmlSerializer), which is what .NET uses for XML.
 */

export type TargetLanguage = 'csharp' | 'fsharp' | 'typescript' | 'javascript' | 'php';

export type DotNetSerializer = 'system' | 'newtonsoft';

export type SourceFormat = 'json' | 'xml';

export interface CodegenOptions {
  language: TargetLanguage;
  serializer: DotNetSerializer;
  format: SourceFormat;
  rootName: string;
  namespace: string;
  records: boolean;
  /** Original XML root element name, used for [XmlRoot]. */
  rootXmlName?: string;
}

export const LANGUAGE_LABELS: Record<TargetLanguage, string> = {
  csharp: 'C#',
  fsharp: 'F#',
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  php: 'PHP',
};

export const FILE_EXTENSIONS: Record<TargetLanguage, string> = {
  csharp: 'cs',
  fsharp: 'fs',
  typescript: 'ts',
  javascript: 'js',
  php: 'php',
};

function words(value: string): string[] {
  return value.split(/[^A-Za-z0-9]+/).filter(Boolean);
}

export function pascalCase(value: string): string {
  const joined = words(value)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  if (!joined) return 'Value';
  return /^[0-9]/.test(joined) ? `Value${joined}` : joined;
}

function singular(value: string): string {
  if (value.endsWith('ies')) return `${value.slice(0, -3)}y`;
  if (value.endsWith('ss')) return value;
  if (value.endsWith('s')) return value.slice(0, -1);
  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function entries(value: unknown): Array<[string, unknown]> {
  return isPlainObject(value) ? Object.entries(value) : [];
}

function isAttributeKey(key: string): boolean {
  return key.startsWith('@');
}

function cleanKey(key: string): string {
  return isAttributeKey(key) ? key.slice(1) : key;
}

function createNamer(): (base: string) => string {
  const used = new Set<string>();
  return (base: string): string => {
    const baseName = pascalCase(base);
    let name = baseName;
    let counter = 2;
    while (used.has(name)) name = `${baseName}${counter++}`;
    used.add(name);
    return name;
  };
}

function phpVariable(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9_]/g, '_');
  return /^[0-9]/.test(cleaned) ? `_${cleaned}` : cleaned || 'value';
}

function tsProperty(value: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value) ? value : JSON.stringify(value);
}

function jsAccessor(value: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value) ? `.${value}` : `[${JSON.stringify(value)}]`;
}

/* ------------------------------------------------------------------ */
/* C#                                                                  */
/* ------------------------------------------------------------------ */

function generateCSharp(root: unknown, options: CodegenOptions): string {
  const declarations: string[] = [];
  const name = createNamer();
  const xml = options.format === 'xml';
  const jsonAttribute = options.serializer === 'newtonsoft' ? 'JsonProperty' : 'JsonPropertyName';

  const typeFor = (value: unknown, suggested: string): string => {
    if (value === null || value === undefined) return 'object?';
    if (Array.isArray(value)) {
      if (!value.length) return 'List<object>';
      const inner = typeFor(value[0], singular(suggested)).replace(/\?$/, '');
      return `List<${inner}>`;
    }
    if (typeof value === 'string') return 'string?';
    if (typeof value === 'number') return Number.isInteger(value) ? 'int?' : 'double?';
    if (typeof value === 'boolean') return 'bool?';
    if (isPlainObject(value)) {
      const className = name(suggested);
      emit(value, className, false);
      return className;
    }
    return 'object?';
  };

  // XmlSerializer rejects Nullable<T> for XmlAttribute members, so keep value types plain.
  const attributeType = (type: string): string =>
    /^(int|long|double|float|decimal|bool|DateTime)\?$/.test(type) ? type.slice(0, -1) : type;

  const emit = (object: Record<string, unknown>, className: string, isRoot: boolean): void => {
    const properties = entries(object).map(([key, value]) => ({
      key,
      clean: cleanKey(key),
      attribute: isAttributeKey(key),
      property: pascalCase(cleanKey(key)),
      type: typeFor(value, cleanKey(key)),
    }));

    if (options.records && !xml) {
      if (!properties.length) {
        declarations.push(`public record ${className}();`);
        return;
      }
      const parameters = properties.map((property) => {
        const prefix =
          property.property === property.clean ? '' : `[property: ${jsonAttribute}("${property.clean}")] `;
        return `${prefix}${property.type} ${property.property}`;
      });
      declarations.push(`public record ${className}(\n${parameters.map((line) => `    ${line}`).join(',\n')}\n);`);
      return;
    }

    const lines: string[] = [];
    for (const property of properties) {
      if (xml) {
        lines.push(property.attribute ? `    [XmlAttribute("${property.clean}")]` : `    [XmlElement("${property.clean}")]`);
      } else if (property.property !== property.clean) {
        lines.push(`    [${jsonAttribute}("${property.clean}")]`);
      }
      const isXmlAttribute = xml && property.attribute;
      const type = isXmlAttribute ? attributeType(property.type) : property.type;
      if (type.startsWith('List<')) {
        lines.push(`    public ${type} ${property.property} { get; set; } = new();`);
      } else if (type.endsWith('?') || isXmlAttribute) {
        lines.push(`    public ${type} ${property.property} { get; set; }`);
      } else {
        lines.push(`    public ${type} ${property.property} { get; set; } = default!;`);
      }
      lines.push('');
    }

    const rootAttribute = xml && isRoot ? `[XmlRoot("${options.rootXmlName || options.rootName}")]\n` : '';
    declarations.push(`${rootAttribute}public class ${className}\n{\n${lines.join('\n').replace(/\n$/, '')}\n}`);
  };

  const rootObject = Array.isArray(root) ? (root[0] ?? {}) : root;
  if (!isPlainObject(rootObject)) return '// The root value must be an object or an array of objects';
  emit(rootObject, name(options.rootName || 'Root'), true);

  const usings = xml
    ? ['using System.Collections.Generic;', 'using System.Xml.Serialization;']
    : options.serializer === 'newtonsoft'
      ? ['using System.Collections.Generic;', 'using Newtonsoft.Json;']
      : ['using System.Collections.Generic;', 'using System.Text.Json.Serialization;'];

  const namespace = options.namespace.trim();
  const parts = [...usings, ''];
  if (namespace) parts.push(`namespace ${namespace};`, '');
  parts.push(declarations.join('\n\n'));
  return `${parts.join('\n').trimEnd()}\n`;
}

/* ------------------------------------------------------------------ */
/* F#                                                                  */
/* ------------------------------------------------------------------ */

function generateFsharp(root: unknown, options: CodegenOptions): string {
  const declarations: string[] = [];
  const name = createNamer();
  const xml = options.format === 'xml';
  const jsonAttribute = options.serializer === 'newtonsoft' ? 'JsonProperty' : 'JsonPropertyName';

  const typeFor = (value: unknown, suggested: string): string => {
    if (value === null || value === undefined) return 'obj';
    if (Array.isArray(value)) {
      if (!value.length) return 'obj array';
      return `${typeFor(value[0], singular(suggested))} array`;
    }
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return Number.isInteger(value) ? 'int' : 'float';
    if (typeof value === 'boolean') return 'bool';
    if (isPlainObject(value)) {
      const typeName = name(suggested);
      emit(value, typeName, false);
      return typeName;
    }
    return 'obj';
  };

  const emit = (object: Record<string, unknown>, typeName: string, isRoot: boolean): void => {
    const fields = entries(object).map(([key, value]) => ({
      key,
      clean: cleanKey(key),
      attribute: isAttributeKey(key),
      field: pascalCase(cleanKey(key)),
      type: typeFor(value, cleanKey(key)),
    }));

    if (!fields.length) {
      declarations.push(`type ${typeName} = class end`);
      return;
    }

    const lines = fields.map((field) => {
      const attributeName = xml ? (field.attribute ? 'XmlAttribute' : 'XmlElement') : jsonAttribute;
      return `        [<${attributeName}("${field.clean}")>]\n        ${field.field}: ${field.type}`;
    });

    const attributes: string[] = ['CLIMutable'];
    if (xml && isRoot) attributes.unshift(`XmlRoot("${options.rootXmlName || options.rootName}")`);
    declarations.push(`[<${attributes.join('; ')}>]\ntype ${typeName} =\n    {\n${lines.join('\n\n')}\n    }`);
  };

  const rootObject = Array.isArray(root) ? (root[0] ?? {}) : root;
  if (!isPlainObject(rootObject)) return '// The root value must be an object or an array of objects';
  emit(rootObject, name(options.rootName || 'Root'), true);

  const namespace = options.namespace.trim();
  const header: string[] = [];
  if (namespace) header.push(`namespace ${namespace}`, '');
  header.push(
    xml ? 'open System.Xml.Serialization' : options.serializer === 'newtonsoft' ? 'open Newtonsoft.Json' : 'open System.Text.Json.Serialization',
    '',
  );
  return `${[...header, declarations.join('\n\n')].join('\n').trimEnd()}\n`;
}

/* ------------------------------------------------------------------ */
/* TypeScript                                                          */
/* ------------------------------------------------------------------ */

function generateTypeScript(root: unknown, options: CodegenOptions): string {
  const declarations: string[] = [];
  const name = createNamer();

  const typeFor = (value: unknown, suggested: string): string => {
    if (value === null || value === undefined) return 'unknown';
    if (Array.isArray(value)) {
      if (!value.length) return 'unknown[]';
      return `${typeFor(value[0], singular(suggested))}[]`;
    }
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (isPlainObject(value)) {
      const typeName = name(suggested);
      emit(value, typeName);
      return typeName;
    }
    return 'unknown';
  };

  const emit = (object: Record<string, unknown>, typeName: string): void => {
    const lines = entries(object).map(([key, value]) => `  ${tsProperty(cleanKey(key))}?: ${typeFor(value, cleanKey(key))};`);
    declarations.push(`export interface ${typeName} {\n${lines.join('\n')}\n}`);
  };

  const rootObject = Array.isArray(root) ? (root[0] ?? {}) : root;
  if (!isPlainObject(rootObject)) return '// The root value must be an object or an array of objects';
  emit(rootObject, name(options.rootName || 'Root'));
  return `${declarations.join('\n\n')}\n`;
}

/* ------------------------------------------------------------------ */
/* JavaScript                                                          */
/* ------------------------------------------------------------------ */

function generateJavaScript(root: unknown, options: CodegenOptions): string {
  const declarations: string[] = [];
  const name = createNamer();

  const valueFor = (value: unknown, suggested: string, accessor: string): string => {
    if (Array.isArray(value)) {
      if (value.length && isPlainObject(value[0])) {
        const child = name(singular(suggested));
        emit(value[0], child);
        return `(${accessor} ?? []).map((item) => new ${child}(item))`;
      }
      return `${accessor} ?? []`;
    }
    if (isPlainObject(value)) {
      const child = name(suggested);
      emit(value, child);
      return `${accessor} ? new ${child}(${accessor}) : null`;
    }
    return `${accessor} ?? null`;
  };

  const emit = (object: Record<string, unknown>, className: string): void => {
    const lines = entries(object).map(([key, value]) => {
      const accessor = `data${jsAccessor(key)}`;
      return `    this${jsAccessor(cleanKey(key))} = ${valueFor(value, cleanKey(key), accessor)};`;
    });
    declarations.push(`export class ${className} {\n  constructor(data = {}) {\n${lines.join('\n')}\n  }\n}`);
  };

  const rootObject = Array.isArray(root) ? (root[0] ?? {}) : root;
  if (!isPlainObject(rootObject)) return '// The root value must be an object or an array of objects';
  emit(rootObject, name(options.rootName || 'Root'));
  return `${declarations.join('\n\n')}\n`;
}

/* ------------------------------------------------------------------ */
/* PHP                                                                 */
/* ------------------------------------------------------------------ */

function generatePhp(root: unknown, options: CodegenOptions): string {
  const declarations: string[] = [];
  const name = createNamer();

  const scalarType = (value: unknown): string | null => {
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return Number.isInteger(value) ? 'int' : 'float';
    if (typeof value === 'boolean') return 'bool';
    return null;
  };

  const emit = (object: Record<string, unknown>, className: string): void => {
    const lines: string[] = [];
    for (const [key, value] of entries(object)) {
      const clean = cleanKey(key);
      const variable = phpVariable(clean);
      if (isPlainObject(value)) {
        const child = name(clean);
        emit(value, child);
        lines.push(`    public ?${child} $${variable} = null;`);
      } else if (Array.isArray(value)) {
        if (value.length && isPlainObject(value[0])) {
          const child = name(singular(clean));
          emit(value[0], child);
          lines.push(`    /** @var ${child}[] */`);
          lines.push(`    public array $${variable} = [];`);
        } else if (value.length) {
          const type = scalarType(value[0]) ?? 'mixed';
          lines.push(`    /** @var ${type}[] */`);
          lines.push(`    public array $${variable} = [];`);
        } else {
          lines.push(`    public array $${variable} = [];`);
        }
      } else {
        const type = scalarType(value);
        lines.push(type ? `    public ?${type} $${variable} = null;` : `    public mixed $${variable} = null;`);
      }
    }
    declarations.push(`class ${className}\n{\n${lines.join('\n')}\n}`);
  };

  const rootObject = Array.isArray(root) ? (root[0] ?? {}) : root;
  if (!isPlainObject(rootObject)) return '<?php\n\n// The root value must be an object or an array of objects\n';
  emit(rootObject, name(options.rootName || 'Root'));
  return `<?php\n\ndeclare(strict_types=1);\n\n${declarations.join('\n\n')}\n`;
}

/* ------------------------------------------------------------------ */

export function generateCode(root: unknown, options: CodegenOptions): string {
  switch (options.language) {
    case 'csharp':
      return generateCSharp(root, options);
    case 'fsharp':
      return generateFsharp(root, options);
    case 'typescript':
      return generateTypeScript(root, options);
    case 'javascript':
      return generateJavaScript(root, options);
    case 'php':
      return generatePhp(root, options);
    default:
      return '';
  }
}

/* ------------------------------------------------------------------ */
/* Usage snippets                                                      */
/* ------------------------------------------------------------------ */

export function generateUsageSnippet(options: CodegenOptions): string {
  const root = pascalCase(options.rootName || 'Root');
  const json = options.format === 'json';

  if (options.language === 'csharp') {
    if (json) {
      return options.serializer === 'newtonsoft'
        ? `using Newtonsoft.Json;\n\nvar json = File.ReadAllText("data.json");\nvar root = JsonConvert.DeserializeObject<${root}>(json)!;`
        : `using System.Text.Json;\n\nvar json = File.ReadAllText("data.json");\nvar root = JsonSerializer.Deserialize<${root}>(json)\n    ?? throw new InvalidOperationException("Empty payload");`;
    }
    return `using System.Xml.Serialization;\n\nvar xml = File.ReadAllText("data.xml");\nvar serializer = new XmlSerializer(typeof(${root}));\nusing var reader = new StringReader(xml);\nvar root = (${root}?)serializer.Deserialize(reader);`;
  }

  if (options.language === 'fsharp') {
    if (json) {
      return options.serializer === 'newtonsoft'
        ? `open System.IO\nopen Newtonsoft.Json\n\nlet json = File.ReadAllText "data.json"\nlet root = JsonConvert.DeserializeObject<${root}> json`
        : `open System.IO\nopen System.Text.Json\n\nlet json = File.ReadAllText "data.json"\nlet root = JsonSerializer.Deserialize<${root}> json`;
    }
    return `open System.IO\nopen System.Xml.Serialization\n\nlet xml = File.ReadAllText "data.xml"\nlet serializer = XmlSerializer typeof<${root}>\nuse reader = new StringReader(xml)\nlet root = serializer.Deserialize reader :?> ${root}`;
  }

  if (options.language === 'typescript') {
    if (json) {
      return `const response = await fetch("/api/data.json");\nconst root = (await response.json()) as ${root};`;
    }
    return `const xml = await (await fetch("/api/data.xml")).text();\nconst document = new DOMParser().parseFromString(xml, "application/xml");\n\n// Attributes are prefixed with "@" when mapping the DOM to ${root}.\nconst root = mapUser(document.documentElement); // your mapper`;
  }

  if (options.language === 'javascript') {
    if (json) {
      return `const response = await fetch("/api/data.json");\nconst root = await response.json();`;
    }
    return `const xml = await (await fetch("/api/data.xml")).text();\nconst document = new DOMParser().parseFromString(xml, "application/xml");\n\nconst root = mapUser(document.documentElement); // your mapper`;
  }

  if (json) {
    return `$json = file_get_contents('data.json');\n$data = json_decode($json, true);\n\n// Map $data to the generated class.\n$root = new ${root}();`;
  }
  return `$xml = simplexml_load_file('data.xml');\n\n// Map $xml to the generated class.\n$root = new ${root}();`;
}
