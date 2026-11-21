/** Key derivation and password hashing: PBKDF2, HKDF, scrypt, Argon2id, bcrypt. */
import bcrypt from 'bcryptjs';
import { argon2idAsync } from '@noble/hashes/argon2.js';
import { scryptAsync } from '@noble/hashes/scrypt.js';
import { area, badge, btn, copyBtn, errorSlot, field, note, pane, select, setError, stats, tabs, textInput, toolbar } from '../components.ts';
import { h } from '../dom.ts';
import { defineTool } from '../tool-types.ts';
import { bytesToHex, encodeData, hexToBytes, randomBytes, utf8ToBytes, type DataEncoding } from '../lib/crypto/codec.ts';
import { bufferOf, toBytes } from '../lib/crypto/webcrypto.ts';

function kdfTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'crypto-kdf',
    group: 'crypto',
    icon: '<path d="M12 3v6"/><path d="M9 6h6"/><path d="M5 21a7 7 0 0 1 14 0"/><path d="M9 13h6l1 4h-8z"/>',
    name: { en: 'Key Derivation (KDF)', ru: 'Выработка ключа (KDF)' },
    desc: {
      en: 'Derive keys with PBKDF2, HKDF, scrypt and Argon2id; hash and verify passwords with bcrypt.',
      ru: 'Выработка ключей PBKDF2, HKDF, scrypt и Argon2id; хеширование и проверка паролей bcrypt.',
    },
    keywords: 'kdf pbkdf2 hkdf scrypt argon2 argon2id bcrypt password hash salt',
    mount(root, ctx) {
      const encodingControl = (): { element: HTMLElement; get: () => DataEncoding } => {
        let encoding: DataEncoding = 'hex';
        const element = select(
          [
            { value: 'hex', label: 'Hex' },
            { value: 'base64', label: 'Base64' },
          ],
          encoding,
          (value) => {
            encoding = value as DataEncoding;
          },
        );
        return { element: field(ctx.pick('Output', 'Вывод'), element), get: () => encoding };
      };

      const resultPane = () => {
        const output = area({ rows: 5, readOnly: true });
        return { output, element: pane(ctx.pick('Derived key', 'Выработанный ключ'), output, [copyBtn(() => output.value)]) };
      };

      const numberInput = (value: string, min: number, max: number) => textInput({ type: 'number', value, min, max, class: 'dt-mono' });
      const readInt = (input: HTMLInputElement, fallback: number, min: number, max: number): number =>
        Math.max(min, Math.min(max, Number(input.value) || fallback));

      // ---------- PBKDF2 ----------
      const pbkdf2Password = textInput({ type: 'password', placeholder: ctx.pick('passphrase', 'парольная фраза') });
      const pbkdf2Salt = textInput({ class: 'dt-mono', value: bytesToHex(randomBytes(16)) });
      const pbkdf2Iterations = numberInput('210000', 1, 10_000_000);
      const pbkdf2Length = numberInput('32', 1, 256);
      const pbkdf2Hash = select(
        [
          { value: 'SHA-256', label: 'SHA-256' },
          { value: 'SHA-512', label: 'SHA-512' },
          { value: 'SHA-384', label: 'SHA-384' },
          { value: 'SHA-1', label: 'SHA-1' },
        ],
        'SHA-256',
      );
      const pbkdf2Encoding = encodingControl();
      const pbkdf2Result = resultPane();
      const pbkdf2Error = errorSlot();
      const pbkdf2Info = h('div');

      const runPbkdf2 = async () => {
        setError(pbkdf2Error, null);
        const started = performance.now();
        try {
          const length = readInt(pbkdf2Length, 32, 1, 256);
          const material = await crypto.subtle.importKey('raw', bufferOf(utf8ToBytes(pbkdf2Password.value)), 'PBKDF2', false, ['deriveBits']);
          const bits = await crypto.subtle.deriveBits(
            { name: 'PBKDF2', hash: pbkdf2Hash.value, salt: bufferOf(hexToBytes(pbkdf2Salt.value)), iterations: readInt(pbkdf2Iterations, 210000, 1, 10_000_000) },
            material,
            length * 8,
          );
          const bytes = toBytes(bits);
          pbkdf2Result.output.value = encodeData(bytes, pbkdf2Encoding.get());
          pbkdf2Info.replaceChildren(stats([[ctx.pick('Length', 'Длина'), `${bytes.length} B`], [ctx.pick('Time', 'Время'), `${Math.round(performance.now() - started)} ms`]]));
        } catch (cause) {
          setError(pbkdf2Error, cause instanceof Error ? cause.message : String(cause));
        }
      };

      const pbkdf2Tab = h(
        'div',
        { class: 'dt-stack' },
        h(
          'div',
          { class: 'dt-inline-form' },
          field(ctx.pick('Passphrase', 'Парольная фраза'), pbkdf2Password),
          field(ctx.pick('Salt (hex)', 'Соль (hex)'), pbkdf2Salt),
          btn(ctx.pick('Random salt', 'Случайная соль'), () => {
            pbkdf2Salt.value = bytesToHex(randomBytes(16));
          }),
          field(ctx.pick('Iterations', 'Итерации'), pbkdf2Iterations),
          field(ctx.pick('Length (bytes)', 'Длина (байт)'), pbkdf2Length),
          field(ctx.pick('Hash', 'Хеш'), pbkdf2Hash),
          pbkdf2Encoding.element,
        ),
        pbkdf2Error,
        pbkdf2Result.element,
        toolbar(btn(ctx.pick('Derive', 'Выработать'), () => void runPbkdf2(), { variant: 'primary' })),
        pbkdf2Info,
        note(ctx.pick('PBKDF2-HMAC via WebCrypto. 210 000 iterations is a common 2023+ baseline for SHA-256.', 'PBKDF2-HMAC через WebCrypto. 210 000 итераций — распространённый минимум для SHA-256 с 2023 года.'), 'info'),
      );

      // ---------- HKDF ----------
      const hkdfIkm = textInput({ class: 'dt-mono', placeholder: ctx.pick('input key material (hex)', 'исходный ключевой материал (hex)') });
      const hkdfSalt = textInput({ class: 'dt-mono', value: bytesToHex(randomBytes(16)) });
      const hkdfInfoInput = textInput({ class: 'dt-mono', value: 'dev-tools' });
      const hkdfLength = numberInput('32', 1, 256);
      const hkdfHash = select(
        [
          { value: 'SHA-256', label: 'SHA-256' },
          { value: 'SHA-512', label: 'SHA-512' },
          { value: 'SHA-384', label: 'SHA-384' },
        ],
        'SHA-256',
      );
      const hkdfEncoding = encodingControl();
      const hkdfResult = resultPane();
      const hkdfError = errorSlot();
      const hkdfStats = h('div');

      const runHkdf = async () => {
        setError(hkdfError, null);
        const started = performance.now();
        try {
          const ikm = await crypto.subtle.importKey('raw', bufferOf(hexToBytes(hkdfIkm.value)), 'HKDF', false, ['deriveBits']);
          const bits = await crypto.subtle.deriveBits(
            { name: 'HKDF', hash: hkdfHash.value, salt: bufferOf(hexToBytes(hkdfSalt.value)), info: bufferOf(utf8ToBytes(hkdfInfoInput.value)) },
            ikm,
            readInt(hkdfLength, 32, 1, 256) * 8,
          );
          const bytes = toBytes(bits);
          hkdfResult.output.value = encodeData(bytes, hkdfEncoding.get());
          hkdfStats.replaceChildren(stats([[ctx.pick('Length', 'Длина'), `${bytes.length} B`], [ctx.pick('Time', 'Время'), `${Math.round(performance.now() - started)} ms`]]));
        } catch (cause) {
          setError(hkdfError, cause instanceof Error ? cause.message : String(cause));
        }
      };

      const hkdfTab = h(
        'div',
        { class: 'dt-stack' },
        h(
          'div',
          { class: 'dt-inline-form' },
          field('IKM (hex)', hkdfIkm),
          field(ctx.pick('Salt (hex)', 'Соль (hex)'), hkdfSalt),
          field('Info', hkdfInfoInput),
          field(ctx.pick('Length (bytes)', 'Длина (байт)'), hkdfLength),
          field(ctx.pick('Hash', 'Хеш'), hkdfHash),
          hkdfEncoding.element,
        ),
        hkdfError,
        hkdfResult.element,
        toolbar(btn(ctx.pick('Derive', 'Выработать'), () => void runHkdf(), { variant: 'primary' })),
        hkdfStats,
        note('HKDF (RFC 5869): extract + expand через WebCrypto.', 'info'),
      );

      // ---------- scrypt ----------
      const scryptPassword = textInput({ type: 'password', placeholder: ctx.pick('passphrase', 'парольная фраза') });
      const scryptSalt = textInput({ class: 'dt-mono', value: bytesToHex(randomBytes(16)) });
      const scryptN = numberInput('16384', 2, 1_048_576);
      const scryptR = numberInput('8', 1, 32);
      const scryptP = numberInput('1', 1, 8);
      const scryptLength = numberInput('32', 1, 256);
      const scryptEncoding = encodingControl();
      const scryptResult = resultPane();
      const scryptError = errorSlot();
      const scryptStats = h('div');

      const runScrypt = async () => {
        setError(scryptError, null);
        const started = performance.now();
        try {
          const N = readInt(scryptN, 16384, 2, 1_048_576);
          if ((N & (N - 1)) !== 0) throw new Error('scrypt: N must be a power of two.');
          const bytes = await scryptAsync(utf8ToBytes(scryptPassword.value), hexToBytes(scryptSalt.value), {
            N,
            r: readInt(scryptR, 8, 1, 32),
            p: readInt(scryptP, 1, 1, 8),
            dkLen: readInt(scryptLength, 32, 1, 256),
          });
          scryptResult.output.value = encodeData(bytes, scryptEncoding.get());
          scryptStats.replaceChildren(stats([[ctx.pick('Length', 'Длина'), `${bytes.length} B`], [ctx.pick('Time', 'Время'), `${Math.round(performance.now() - started)} ms`]]));
        } catch (cause) {
          setError(scryptError, cause instanceof Error ? cause.message : String(cause));
        }
      };

      const scryptTab = h(
        'div',
        { class: 'dt-stack' },
        h(
          'div',
          { class: 'dt-inline-form' },
          field(ctx.pick('Passphrase', 'Парольная фраза'), scryptPassword),
          field(ctx.pick('Salt (hex)', 'Соль (hex)'), scryptSalt),
          btn(ctx.pick('Random salt', 'Случайная соль'), () => {
            scryptSalt.value = bytesToHex(randomBytes(16));
          }),
          field('N', scryptN),
          field('r', scryptR),
          field('p', scryptP),
          field(ctx.pick('Length (bytes)', 'Длина (байт)'), scryptLength),
          scryptEncoding.element,
        ),
        scryptError,
        scryptResult.element,
        toolbar(btn(ctx.pick('Derive', 'Выработать'), () => void runScrypt(), { variant: 'primary' })),
        scryptStats,
        note(ctx.pick('scrypt (@noble/hashes). Recommended: N=2^14..2^17, r=8, p=1.', 'scrypt (@noble/hashes). Рекомендуется: N=2^14..2^17, r=8, p=1.'), 'info'),
      );

      // ---------- Argon2id ----------
      const argonPassword = textInput({ type: 'password', placeholder: ctx.pick('passphrase', 'парольная фраза') });
      const argonSalt = textInput({ class: 'dt-mono', value: bytesToHex(randomBytes(16)) });
      const argonT = numberInput('3', 1, 16);
      const argonM = numberInput('65536', 8, 1_048_576);
      const argonP = numberInput('1', 1, 16);
      const argonLength = numberInput('32', 1, 256);
      const argonEncoding = encodingControl();
      const argonResult = resultPane();
      const argonError = errorSlot();
      const argonStats = h('div');

      const runArgon = async () => {
        setError(argonError, null);
        const started = performance.now();
        try {
          const bytes = await argon2idAsync(utf8ToBytes(argonPassword.value), hexToBytes(argonSalt.value), {
            t: readInt(argonT, 3, 1, 16),
            m: readInt(argonM, 65536, 8, 1_048_576),
            p: readInt(argonP, 1, 1, 16),
            dkLen: readInt(argonLength, 32, 1, 256),
          });
          argonResult.output.value = encodeData(bytes, argonEncoding.get());
          argonStats.replaceChildren(stats([[ctx.pick('Length', 'Длина'), `${bytes.length} B`], [ctx.pick('Time', 'Время'), `${Math.round(performance.now() - started)} ms`]]));
        } catch (cause) {
          setError(argonError, cause instanceof Error ? cause.message : String(cause));
        }
      };

      const argonTab = h(
        'div',
        { class: 'dt-stack' },
        h(
          'div',
          { class: 'dt-inline-form' },
          field(ctx.pick('Passphrase', 'Парольная фраза'), argonPassword),
          field(ctx.pick('Salt (hex)', 'Соль (hex)'), argonSalt),
          btn(ctx.pick('Random salt', 'Случайная соль'), () => {
            argonSalt.value = bytesToHex(randomBytes(16));
          }),
          field('t (passes)', argonT),
          field('m (KiB)', argonM),
          field('p (lanes)', argonP),
          field(ctx.pick('Length (bytes)', 'Длина (байт)'), argonLength),
          argonEncoding.element,
        ),
        argonError,
        argonResult.element,
        toolbar(btn(ctx.pick('Derive', 'Выработать'), () => void runArgon(), { variant: 'primary' })),
        argonStats,
        note(ctx.pick('Argon2id (@noble/hashes). OWASP baseline: m=19 MiB, t=2, p=1; m=64 MiB, t=3 is stronger.', 'Argon2id (@noble/hashes). Базовая линия OWASP: m=19 МиБ, t=2, p=1; m=64 МиБ, t=3 — надёжнее.'), 'info'),
      );

      // ---------- bcrypt ----------
      const bcryptPassword = textInput({ type: 'password', placeholder: ctx.pick('password', 'пароль') });
      const bcryptCost = numberInput('12', 4, 15);
      const bcryptHash = area({ rows: 4, readOnly: true });
      const bcryptVerifyInput = textInput({ class: 'dt-mono', placeholder: '$2b$12$…' });
      const bcryptVerifyResult = h('div');
      const bcryptError = errorSlot();

      const runBcrypt = async () => {
        setError(bcryptError, null);
        try {
          bcryptHash.value = await bcrypt.hash(bcryptPassword.value, readInt(bcryptCost, 12, 4, 15));
          bcryptVerifyResult.replaceChildren();
        } catch (cause) {
          setError(bcryptError, cause instanceof Error ? cause.message : String(cause));
        }
      };

      const verifyBcrypt = async () => {
        setError(bcryptError, null);
        try {
          const ok = await bcrypt.compare(bcryptPassword.value, bcryptVerifyInput.value.trim());
          bcryptVerifyResult.replaceChildren(badge(ok ? ctx.pick('Password matches', 'Пароль совпадает') : ctx.pick('Password does not match', 'Пароль не совпадает'), ok ? 'ok' : 'bad'));
        } catch (cause) {
          setError(bcryptError, cause instanceof Error ? cause.message : String(cause));
        }
      };

      const bcryptTab = h(
        'div',
        { class: 'dt-stack' },
        h('div', { class: 'dt-inline-form' }, field(ctx.pick('Password', 'Пароль'), bcryptPassword), field(ctx.pick('Cost', 'Стоимость'), bcryptCost)),
        bcryptError,
        toolbar(btn(ctx.pick('Hash', 'Хешировать'), () => void runBcrypt(), { variant: 'primary' })),
        pane('bcrypt', bcryptHash, [copyBtn(() => bcryptHash.value)]),
        h('div', { class: 'dt-inline-form' }, field(ctx.pick('Verify hash', 'Проверить хеш'), bcryptVerifyInput), btn(ctx.pick('Verify', 'Проверить'), () => void verifyBcrypt())),
        bcryptVerifyResult,
        note(ctx.pick('bcrypt truncates passwords at 72 bytes and is intentionally slow — increase cost for production.', 'bcrypt обрезает пароль до 72 байт и намеренно медленный — повышайте cost в продакшене.'), 'info'),
      );

      root.append(
        tabs([
          { id: 'pbkdf2', label: 'PBKDF2', render: () => pbkdf2Tab },
          { id: 'hkdf', label: 'HKDF', render: () => hkdfTab },
          { id: 'scrypt', label: 'scrypt', render: () => scryptTab },
          { id: 'argon2', label: 'Argon2id', render: () => argonTab },
          { id: 'bcrypt', label: 'bcrypt', render: () => bcryptTab },
        ]),
      );
    },
  });
}

export const kdfTools = [kdfTool()];
