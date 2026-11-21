/** Classic (educational) ciphers used by the CTF / puzzle tool. */
export const LATIN = 'abcdefghijklmnopqrstuvwxyz';
export const RUSSIAN = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя';

export type Alphabet = 'latin' | 'russian';

export function alphabetOf(kind: Alphabet): string {
  return kind === 'russian' ? RUSSIAN : LATIN;
}

const mapLetter = (char: string, map: (lower: string) => string): string => {
  const lower = char.toLowerCase();
  if (!/[a-zа-яё]/.test(lower)) return char;
  const mapped = map(lower);
  return char === lower ? mapped : mapped.toUpperCase();
};

export function caesar(text: string, shift: number, alphabet: string): string {
  const size = alphabet.length;
  const offset = ((shift % size) + size) % size;
  return [...text].map((char) => mapLetter(char, (lower) => {
    const index = alphabet.indexOf(lower);
    return index < 0 ? lower : alphabet[(index + offset) % size];
  })).join('');
}

export function rot47(text: string): string {
  return [...text].map((char) => {
    const code = char.charCodeAt(0);
    return code >= 33 && code <= 126 ? String.fromCharCode(33 + ((code - 33 + 47) % 94)) : char;
  }).join('');
}

export function atbash(text: string, alphabet: string): string {
  return [...text].map((char) => mapLetter(char, (lower) => {
    const index = alphabet.indexOf(lower);
    return index < 0 ? lower : alphabet[alphabet.length - 1 - index];
  })).join('');
}

export function vigenere(text: string, key: string, alphabet: string, decrypt: boolean): string {
  const cleanKey = [...key.toLowerCase()].filter((char) => alphabet.includes(char));
  if (!cleanKey.length) throw new Error('Vigenère key must contain letters of the chosen alphabet.');
  const size = alphabet.length;
  let keyIndex = 0;
  return [...text].map((char) => mapLetter(char, (lower) => {
    const index = alphabet.indexOf(lower);
    if (index < 0) return lower;
    const shift = alphabet.indexOf(cleanKey[keyIndex % cleanKey.length]);
    keyIndex++;
    return alphabet[(index + (decrypt ? -shift : shift) + size) % size];
  })).join('');
}

export function xorBytes(data: Uint8Array, key: Uint8Array): Uint8Array {
  if (!key.length) throw new Error('XOR key must not be empty.');
  const output = new Uint8Array(data.length);
  for (let index = 0; index < data.length; index++) output[index] = data[index] ^ key[index % key.length];
  return output;
}

export function oneTimePad(data: Uint8Array, key: Uint8Array, decrypt: boolean): Uint8Array {
  if (!decrypt && key.length < data.length) throw new Error(`One-time pad key must be at least ${data.length} bytes (got ${key.length}).`);
  return xorBytes(data, key);
}

export function railFence(text: string, rails: number, decrypt: boolean): string {
  if (rails < 2) return text;
  const chars = [...text];
  const pattern: number[] = [];
  let rail = 0;
  let direction = 1;
  for (let index = 0; index < chars.length; index++) {
    pattern.push(rail);
    if (rail === 0) direction = 1;
    else if (rail === rails - 1) direction = -1;
    rail += direction;
  }
  if (!decrypt) {
    const rows: string[][] = Array.from({ length: rails }, () => []);
    chars.forEach((char, index) => rows[pattern[index]].push(char));
    return rows.flat().join('');
  }
  const lengths = new Array<number>(rails).fill(0);
  for (const level of pattern) lengths[level]++;
  const rows: string[][] = [];
  let cursor = 0;
  for (let level = 0; level < rails; level++) {
    rows.push(chars.slice(cursor, cursor + lengths[level]));
    cursor += lengths[level];
  }
  const counters = new Array<number>(rails).fill(0);
  return pattern.map((level) => rows[level][counters[level]++]).join('');
}

function playfairSquare(key: string): string[] {
  const merged = `${key}${LATIN}`.toLowerCase().replace(/j/g, 'i');
  const square: string[] = [];
  for (const char of merged) {
    if (/[a-z]/.test(char) && !square.includes(char)) square.push(char);
  }
  return square.slice(0, 25);
}

function playfairPairs(text: string): string[] {
  const letters = [...text.toLowerCase().replace(/j/g, 'i')].filter((char) => /[a-z]/.test(char));
  const pairs: string[] = [];
  for (let index = 0; index < letters.length; index += 2) {
    const first = letters[index];
    let second = letters[index + 1];
    if (!second) {
      second = 'x';
      pairs.push(first + second);
      break;
    }
    if (first === second) {
      pairs.push(`${first}x`);
      index--;
    } else {
      pairs.push(first + second);
    }
  }
  return pairs;
}

export function playfair(text: string, key: string, decrypt: boolean): string {
  const square = playfairSquare(key);
  const position = (char: string): [number, number] => {
    const index = square.indexOf(char);
    return [Math.floor(index / 5), index % 5];
  };
  const result = playfairPairs(text).map((pair) => {
    const [r1, c1] = position(pair[0]);
    const [r2, c2] = position(pair[1]);
    if (r1 === r2) {
      const shift = decrypt ? 4 : 1;
      return square[r1 * 5 + ((c1 + shift) % 5)] + square[r2 * 5 + ((c2 + shift) % 5)];
    }
    if (c1 === c2) {
      const shift = decrypt ? 4 : 1;
      return square[((r1 + shift) % 5) * 5 + c1] + square[((r2 + shift) % 5) * 5 + c2];
    }
    return square[r1 * 5 + c2] + square[r2 * 5 + c1];
  }).join('');
  return decrypt ? result.replace(/x$/, '') : result;
}
