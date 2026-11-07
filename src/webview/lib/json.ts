/** Locates the first syntax error in a JSON document (line/column), for better messages. */

class JsonSyntaxError extends Error {
  readonly position: number;

  constructor(message: string, position: number) {
    super(message);
    this.position = position;
  }
}

export interface JsonErrorLocation {
  line: number;
  column: number;
  message: string;
}

export function locateJsonError(text: string): JsonErrorLocation | null {
  let index = 0;
  const length = text.length;

  const fail = (message: string, at = index): never => {
    throw new JsonSyntaxError(message, at);
  };

  const skipWhitespace = (): void => {
    while (index < length) {
      const char = text[index];
      if (char === ' ' || char === '\t' || char === '\n' || char === '\r') index++;
      else break;
    }
  };

  const isDigit = (char: string | undefined): boolean => char !== undefined && char >= '0' && char <= '9';

  function parseString(): void {
    index++;
    while (index < length) {
      const char = text[index];
      if (char === '"') {
        index++;
        return;
      }
      if (char === '\\') {
        index++;
        const escape = text[index];
        if (escape === undefined) fail('Unterminated string');
        if (escape === 'u') {
          const hex = text.slice(index + 1, index + 5);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail('Invalid unicode escape');
          index += 5;
        } else if ('"\\/bfnrt'.includes(escape)) {
          index++;
        } else {
          fail(`Invalid escape sequence \\${escape}`);
        }
        continue;
      }
      if (char === '\n' || char === '\r') fail('Unescaped line break inside a string');
      index++;
    }
    fail('Unterminated string', length);
  }

  function parseNumber(): void {
    if (text[index] === '-') index++;
    if (text[index] === '0') {
      index++;
    } else if (isDigit(text[index])) {
      while (isDigit(text[index])) index++;
    } else {
      fail('Invalid number');
    }
    if (text[index] === '.') {
      index++;
      if (!isDigit(text[index])) fail('Invalid number');
      while (isDigit(text[index])) index++;
    }
    if (text[index] === 'e' || text[index] === 'E') {
      index++;
      if (text[index] === '+' || text[index] === '-') index++;
      if (!isDigit(text[index])) fail('Invalid number');
      while (isDigit(text[index])) index++;
    }
  }

  function parseObject(): void {
    index++;
    skipWhitespace();
    if (text[index] === '}') {
      index++;
      return;
    }
    while (true) {
      skipWhitespace();
      if (text[index] !== '"') fail('Expected a property name in double quotes');
      parseString();
      skipWhitespace();
      if (text[index] !== ':') fail('Expected ":" after the property name');
      index++;
      skipWhitespace();
      parseValue();
      skipWhitespace();
      if (text[index] === ',') {
        index++;
        skipWhitespace();
        if (text[index] === '}') fail('Trailing comma before "}"');
        continue;
      }
      if (text[index] === '}') {
        index++;
        return;
      }
      fail('Expected "," or "}"');
    }
  }

  function parseArray(): void {
    index++;
    skipWhitespace();
    if (text[index] === ']') {
      index++;
      return;
    }
    while (true) {
      skipWhitespace();
      parseValue();
      skipWhitespace();
      if (text[index] === ',') {
        index++;
        skipWhitespace();
        if (text[index] === ']') fail('Trailing comma before "]"');
        continue;
      }
      if (text[index] === ']') {
        index++;
        return;
      }
      fail('Expected "," or "]"');
    }
  }

  function parseLiteral(value: string): void {
    if (!text.startsWith(value, index)) {
      fail(`Unexpected token ${JSON.stringify(text[index] ?? 'end of input')}`);
    }
    index += value.length;
  }

  function parseValue(): void {
    skipWhitespace();
    const char = text[index];
    if (char === undefined) fail('Unexpected end of input');
    if (char === '{') return parseObject();
    if (char === '[') return parseArray();
    if (char === '"') return parseString();
    if (char === 't') return parseLiteral('true');
    if (char === 'f') return parseLiteral('false');
    if (char === 'n') return parseLiteral('null');
    if (char === '-' || isDigit(char)) return parseNumber();
    return fail(`Unexpected token ${JSON.stringify(char)}`);
  }

  try {
    skipWhitespace();
    parseValue();
    skipWhitespace();
    if (index < length) fail('Unexpected trailing content');
    return null;
  } catch (error) {
    if (!(error instanceof JsonSyntaxError)) return null;
    const before = text.slice(0, error.position);
    const line = before.split('\n').length;
    const column = error.position - before.lastIndexOf('\n');
    return { line, column, message: error.message };
  }
}
