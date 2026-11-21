/** Classic ciphers for puzzles and CTFs: Caesar, ROT47, Atbash, Vigenère, rail fence, Playfair, XOR, OTP. */
import { area, btn, copyBtn, errorSlot, field, note, pane, select, setError, split, segmented, textInput, toolbar } from '../components.ts';
import { h } from '../dom.ts';
import { defineTool } from '../tool-types.ts';
import { base64ToBytes, bytesToBase64 } from '../lib/bytes.ts';
import { alphabetOf, atbash, caesar, oneTimePad, playfair, railFence, rot47, vigenere, xorBytes, type Alphabet } from '../lib/crypto/classic.ts';
import { bytesToHex, hexToBytes, utf8ToBytes } from '../lib/crypto/codec.ts';

type ClassicMode = 'caesar' | 'rot13' | 'rot47' | 'atbash' | 'vigenere' | 'railfence' | 'playfair' | 'xor' | 'otp';

function classicTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'crypto-classic',
    group: 'crypto',
    icon: '<path d="M7 6v12"/><path d="M17 6v12"/><path d="M7 9h10"/><path d="M7 15h10"/>',
    name: { en: 'Classic Ciphers', ru: 'Классические шифры' },
    desc: {
      en: 'Caesar, ROT13/47, Atbash, Vigenère, rail fence, Playfair, XOR and one-time pad for puzzles and CTFs.',
      ru: 'Цезарь, ROT13/47, Атбаш, Виженер, изгородь, Плейфейр, XOR и одноразовый блокнот для задач и CTF.',
    },
    keywords: 'caesar цезарь rot13 rot47 atbash атбаш vigenere виженер rail fence playfair xor otp вернам',
    mount(root, ctx) {
      let mode: ClassicMode = 'caesar';
      let decrypt = false;
      let alphabet: Alphabet = 'latin';
      let xorEncoding: 'hex' | 'base64' = 'hex';

      const modeSelect = select(
        [
          { value: 'caesar', label: ctx.pick('Caesar', 'Цезарь') },
          { value: 'rot13', label: 'ROT13' },
          { value: 'rot47', label: 'ROT47' },
          { value: 'atbash', label: ctx.pick('Atbash', 'Атбаш') },
          { value: 'vigenere', label: ctx.pick('Vigenère', 'Виженер') },
          { value: 'railfence', label: ctx.pick('Rail fence', 'Изгородь') },
          { value: 'playfair', label: 'Playfair' },
          { value: 'xor', label: 'XOR' },
          { value: 'otp', label: ctx.pick('One-time pad', 'Одноразовый блокнот') },
        ],
        mode,
        (value) => {
          mode = value as ClassicMode;
          refresh();
        },
      );

      const direction = segmented(
        [
          { value: 'encrypt', label: ctx.pick('Encrypt', 'Зашифровать') },
          { value: 'decrypt', label: ctx.pick('Decrypt', 'Расшифровать') },
        ],
        'encrypt',
        (value) => {
          decrypt = value === 'decrypt';
          apply();
        },
      );

      const alphabetSelect = select(
        [
          { value: 'latin', label: ctx.pick('Latin', 'Латиница') },
          { value: 'russian', label: ctx.pick('Russian', 'Кириллица') },
        ],
        alphabet,
        (value) => {
          alphabet = value as Alphabet;
          apply();
        },
      );
      const alphabetField = field(ctx.pick('Alphabet', 'Алфавит'), alphabetSelect);

      const shiftInput = textInput({ type: 'number', value: '3', min: -1000, max: 1000, class: 'dt-mono' });
      shiftInput.addEventListener('input', apply);
      const shiftField = field(ctx.pick('Shift', 'Сдвиг'), shiftInput);

      const keyInput = textInput({ class: 'dt-mono', placeholder: ctx.pick('keyword', 'ключевое слово') });
      keyInput.addEventListener('input', apply);
      const keyField = field(ctx.pick('Keyword', 'Ключевое слово'), keyInput);

      const railsInput = textInput({ type: 'number', value: '3', min: 2, max: 32, class: 'dt-mono' });
      railsInput.addEventListener('input', apply);
      const railsField = field(ctx.pick('Rails', 'Полос'), railsInput);

      const hexKeyInput = textInput({ class: 'dt-mono', placeholder: ctx.pick('hex key', 'hex-ключ') });
      hexKeyInput.addEventListener('input', apply);
      const hexKeyField = field(ctx.pick('Key (hex)', 'Ключ (hex)'), hexKeyInput);

      const xorEncodingSelect = select(
        [
          { value: 'hex', label: 'Hex' },
          { value: 'base64', label: 'Base64' },
        ],
        xorEncoding,
        (value) => {
          xorEncoding = value as typeof xorEncoding;
          apply();
        },
      );
      const xorEncodingField = field(ctx.pick('Output', 'Вывод'), xorEncodingSelect);

      const inputArea = area({ rows: 8, value: 'Hello, World!' });
      const outputArea = area({ rows: 8, readOnly: true });
      const error = errorSlot();
      const info = h('div');

      const refresh = () => {
        const involution = mode === 'rot13' || mode === 'rot47' || mode === 'atbash';
        direction.hidden = involution;
        alphabetField.hidden = !['caesar', 'atbash', 'vigenere'].includes(mode);
        shiftField.hidden = !['caesar', 'rot13'].includes(mode);
        keyField.hidden = !['vigenere', 'playfair'].includes(mode);
        railsField.hidden = mode !== 'railfence';
        hexKeyField.hidden = !['xor', 'otp'].includes(mode);
        xorEncodingField.hidden = !['xor', 'otp'].includes(mode);
        apply();
      };

      function apply(): void {
        setError(error, null);
        try {
          const text = inputArea.value;
          let output: string;
          switch (mode) {
            case 'caesar':
              output = caesar(text, Number(shiftInput.value) || 0, alphabetOf(alphabet));
              break;
            case 'rot13':
              output = caesar(text, 13, alphabetOf('latin'));
              break;
            case 'rot47':
              output = rot47(text);
              break;
            case 'atbash':
              output = atbash(text, alphabetOf(alphabet));
              break;
            case 'vigenere':
              output = vigenere(text, keyInput.value, alphabetOf(alphabet), decrypt);
              break;
            case 'railfence':
              output = railFence(text, Math.max(2, Number(railsInput.value) || 3), decrypt);
              break;
            case 'playfair':
              output = playfair(text, keyInput.value, decrypt);
              break;
            case 'xor': {
              const data = decrypt && xorEncoding === 'base64' ? base64ToBytes(text) : decrypt ? hexToBytes(text) : utf8ToBytes(text);
              const result = xorBytes(data, hexToBytes(hexKeyInput.value));
              output = xorEncoding === 'base64' ? bytesToBase64(result) : bytesToHex(result);
              break;
            }
            case 'otp': {
              const data = decrypt && xorEncoding === 'base64' ? base64ToBytes(text) : decrypt ? hexToBytes(text) : utf8ToBytes(text);
              const result = oneTimePad(data, hexToBytes(hexKeyInput.value), decrypt);
              output = xorEncoding === 'base64' ? bytesToBase64(result) : bytesToHex(result);
              break;
            }
            default:
              output = text;
          }
          outputArea.value = output;
          info.replaceChildren();
        } catch (cause) {
          outputArea.value = '';
          setError(error, cause instanceof Error ? cause.message : String(cause));
        }
      }

      inputArea.addEventListener('input', apply);
      refresh();

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          toolbar(direction, field(ctx.pick('Cipher', 'Шифр'), modeSelect)),
          h('div', { class: 'dt-inline-form' }, alphabetField, shiftField, keyField, railsField, hexKeyField, xorEncodingField),
          error,
          split(
            pane(ctx.pick('Input', 'Вход'), inputArea, [copyBtn(() => inputArea.value)]),
            pane(ctx.pick('Output', 'Результат'), outputArea, [copyBtn(() => outputArea.value)]),
          ),
          toolbar(btn(ctx.pick('Use output as input', 'Результат во вход'), () => {
            inputArea.value = outputArea.value;
            apply();
          }, { variant: 'subtle' })),
          info,
          note(ctx.pick('Educational ciphers only — they provide no real security.', 'Только учебные шифры — они не обеспечивают реальную защиту.'), 'warn'),
        ),
      );
    },
  });
}

export const classicTools = [classicTool()];
