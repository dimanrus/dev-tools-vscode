/** Graphic tools: color helpers, color-blind simulator, image converter. */
import {
  area,
  badge,
  btn,
  checkbox,
  copyBtn,
  downloadBtn,
  errorSlot,
  field,
  fileDrop,
  note,
  pane,
  rangeField,
  readDataUrl,
  select,
  setError,
  split,
  stats,
  table,
  textInput,
  toolbar,
} from '../components.ts';
import { clamp, h } from '../dom.ts';
import { defineTool } from '../tool-types.ts';
import { COLOR_VISION, applyMatrix, cmyk, cmykToRgb, contrast, hslCss, hslToRgb, parseColor, rgbCss, rgbToHex, rgbToHsl, shade, tint, type Rgb } from '../lib/colors.ts';

function copyCode(value: string): Node {
  const button = h('button', { class: 'dt-copy-chip', type: 'button', title: 'Copy' }, h('code', {}, value));
  button.addEventListener('click', () => {
    void navigator.clipboard.writeText(value);
    button.classList.add('is-ok');
    window.setTimeout(() => button.classList.remove('is-ok'), 900);
  });
  return button;
}

function colorToolsTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'graphic-color-tools',
    group: 'graphic',
    icon: '<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2 -1 2 -2c0 -1 -1 -2 -1 -3c0 -1 1 -2 2 -2h2a4 4 0 0 0 4 -4c0 -4 -4 -7 -9 -7z"/><path d="M7 10h.01"/><path d="M10 7h.01"/><path d="M15 8h.01"/>',
    name: { en: 'Color Tools', ru: 'Инструменты цвета' },
    desc: {
      en: 'Convert colors, check WCAG contrast and build tints and shades.',
      ru: 'Конвертация цветов, проверка контраста WCAG и построение оттенков.',
    },
    keywords: 'color hex rgb hsl cmyk contrast wcag palette',
    mount(root, ctx) {
      const picker = h('input', { type: 'color', class: 'dt-color-input', value: '#3b82f6' });
      const swatch = h('div', { class: 'dt-swatch' });
      const conversions = h('div');
      const contrastHost = h('div');
      const paletteHost = h('div');
      const error = errorSlot();
      let current: Rgb = { r: 59, g: 130, b: 246 };

      const num = (input: HTMLInputElement): number => {
        const value = Number(input.value);
        return Number.isFinite(value) ? value : 0;
      };

      const makeNumberField = (
        label: string,
        max: number,
        onInput: (input: HTMLInputElement) => void,
      ): { el: HTMLElement; input: HTMLInputElement } => {
        const input = textInput({ type: 'number', value: 0, min: 0, max, class: 'dt-color-num' });
        input.addEventListener('input', () => onInput(input));
        input.addEventListener('change', () => {
          input.value = String(clamp(num(input), 0, max));
          onInput(input);
        });
        return { el: h('label', { class: 'dt-color-field' }, h('span', {}, label), input), input };
      };

      const hexInput = textInput({ value: rgbToHex(current), class: 'dt-mono dt-color-hex' });

      const rgbFields = [
        makeNumberField('R', 255, (input) => applyRgb(input)),
        makeNumberField('G', 255, (input) => applyRgb(input)),
        makeNumberField('B', 255, (input) => applyRgb(input)),
      ];
      const hslFields = [
        makeNumberField('H', 360, (input) => applyHsl(input)),
        makeNumberField('S', 100, (input) => applyHsl(input)),
        makeNumberField('L', 100, (input) => applyHsl(input)),
      ];
      const cmykFields = [
        makeNumberField('C', 100, (input) => applyCmyk(input)),
        makeNumberField('M', 100, (input) => applyCmyk(input)),
        makeNumberField('Y', 100, (input) => applyCmyk(input)),
        makeNumberField('K', 100, (input) => applyCmyk(input)),
      ];

      const syncFields = (skip?: HTMLInputElement): void => {
        const hsl = rgbToHsl(current);
        const cmykValue = cmyk(current);
        const put = (field: { input: HTMLInputElement }, value: number): void => {
          if (field.input !== skip) field.input.value = String(value);
        };
        if (hexInput !== skip) hexInput.value = rgbToHex(current).toUpperCase();
        put(rgbFields[0], current.r);
        put(rgbFields[1], current.g);
        put(rgbFields[2], current.b);
        put(hslFields[0], hsl.h);
        put(hslFields[1], hsl.s);
        put(hslFields[2], hsl.l);
        put(cmykFields[0], cmykValue.c);
        put(cmykFields[1], cmykValue.m);
        put(cmykFields[2], cmykValue.y);
        put(cmykFields[3], cmykValue.k);
      };

      const setColor = (rgb: Rgb, skip?: HTMLInputElement): void => {
        current = rgb;
        const hex = rgbToHex(rgb);
        picker.value = hex;
        swatch.style.background = hex;
        syncFields(skip);
        render();
      };

      function applyRgb(skip: HTMLInputElement): void {
        setError(error, null);
        setColor(
          {
            r: clamp(num(rgbFields[0].input), 0, 255),
            g: clamp(num(rgbFields[1].input), 0, 255),
            b: clamp(num(rgbFields[2].input), 0, 255),
          },
          skip,
        );
      }

      function applyHsl(skip: HTMLInputElement): void {
        setError(error, null);
        setColor(
          hslToRgb({
            h: clamp(num(hslFields[0].input), 0, 360),
            s: clamp(num(hslFields[1].input), 0, 100),
            l: clamp(num(hslFields[2].input), 0, 100),
          }),
          skip,
        );
      }

      function applyCmyk(skip: HTMLInputElement): void {
        setError(error, null);
        setColor(
          cmykToRgb({
            c: clamp(num(cmykFields[0].input), 0, 100),
            m: clamp(num(cmykFields[1].input), 0, 100),
            y: clamp(num(cmykFields[2].input), 0, 100),
            k: clamp(num(cmykFields[3].input), 0, 100),
          }),
          skip,
        );
      }

      const render = () => {
        const hex = rgbToHex(current);
        const hsl = rgbToHsl(current);
        const cmykValue = cmyk(current);
        conversions.replaceChildren(
          table(
            [ctx.pick('Format', 'Формат'), ctx.pick('Value', 'Значение')],
            [
              ['HEX', copyCode(hex.toUpperCase())],
              ['RGB', copyCode(rgbCss(current))],
              ['HSL', copyCode(hslCss(hsl))],
              ['CMYK', copyCode(`cmyk(${cmykValue.c}%, ${cmykValue.m}%, ${cmykValue.y}%, ${cmykValue.k}%)`)],
              ['CSS variable', copyCode(`--color: ${hex};`)],
              ['Tailwind', copyCode(`bg-[${hex}]`)],
            ],
          ),
        );

        const white = contrast(current, { r: 255, g: 255, b: 255 });
        const black = contrast(current, { r: 0, g: 0, b: 0 });
        const rate = (value: number) => `${value.toFixed(2)}:1`;
        contrastHost.replaceChildren(
          table(
            [ctx.pick('Background', 'Фон'), ctx.pick('Ratio', 'Контраст'), 'AA', 'AAA', ctx.pick('Sample', 'Пример')],
            [
              [
                ctx.pick('White', 'Белый'),
                rate(white),
                badge(white >= 4.5 ? '✓ 4.5' : '✗ 4.5', white >= 4.5 ? 'ok' : 'bad'),
                badge(white >= 7 ? '✓ 7' : '✗ 7', white >= 7 ? 'ok' : 'bad'),
                h('span', { class: 'dt-contrast-sample', style: { background: '#ffffff', color: hex } }, 'Aa text'),
              ],
              [
                ctx.pick('Black', 'Чёрный'),
                rate(black),
                badge(black >= 4.5 ? '✓ 4.5' : '✗ 4.5', black >= 4.5 ? 'ok' : 'bad'),
                badge(black >= 7 ? '✓ 7' : '✗ 7', black >= 7 ? 'ok' : 'bad'),
                h('span', { class: 'dt-contrast-sample', style: { background: '#000000', color: hex } }, 'Aa text'),
              ],
            ],
          ),
        );

        const scale = Array.from({ length: 10 }, (_, index) => index / 9);
        paletteHost.replaceChildren(
          h(
            'div',
            { class: 'dt-palette' },
            ...scale.map((amount) => {
              const value = rgbToHex(shade(current, amount));
              return h('button', {
                class: 'dt-palette-cell',
                type: 'button',
                style: { background: value },
                title: value,
                onclick: () => void navigator.clipboard.writeText(value),
              }, h('span', {}, value));
            }),
          ),
          h(
            'div',
            { class: 'dt-palette' },
            ...scale.map((amount) => {
              const value = rgbToHex(tint(current, amount));
              return h('button', {
                class: 'dt-palette-cell',
                type: 'button',
                style: { background: value },
                title: value,
                onclick: () => void navigator.clipboard.writeText(value),
              }, h('span', {}, value));
            }),
          ),
          h('div', { class: 'dt-hint' }, ctx.pick('Click a swatch to copy its HEX value.', 'Нажмите на оттенок, чтобы скопировать HEX.')),
        );
      };

      picker.addEventListener('input', () => setColor(parseColor(picker.value) ?? current));

      hexInput.addEventListener('input', () => {
        const value = hexInput.value.trim();
        if (!value) return;
        const parsed = parseColor(value);
        if (parsed) {
          setError(error, null);
          setColor(parsed, hexInput);
        } else {
          setError(error, ctx.pick('Enter a HEX, rgb() or hsl() color.', 'Введите цвет в формате HEX, rgb() или hsl().'));
        }
      });

      setColor(current);

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          h(
            'div',
            { class: 'dt-color-head' },
            picker,
            swatch,
            btn(ctx.pick('Random', 'Случайный'), () => {
              const hue = Math.floor(Math.random() * 360);
              setColor(hslToRgb({ h: hue, s: 60 + Math.floor(Math.random() * 30), l: 45 + Math.floor(Math.random() * 15) }));
            }, { variant: 'ghost', icon: '<path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"/>' }),
          ),
          h(
            'div',
            { class: 'dt-color-grid' },
            h('div', { class: 'dt-color-group dt-color-group-hex' }, h('div', { class: 'dt-color-group-title' }, 'HEX'), hexInput),
            h(
              'div',
              { class: 'dt-color-group' },
              h('div', { class: 'dt-color-group-title' }, 'RGB'),
              h('div', { class: 'dt-color-fields' }, ...rgbFields.map((item) => item.el)),
            ),
            h(
              'div',
              { class: 'dt-color-group' },
              h('div', { class: 'dt-color-group-title' }, 'HSL'),
              h('div', { class: 'dt-color-fields' }, ...hslFields.map((item) => item.el)),
            ),
            h(
              'div',
              { class: 'dt-color-group' },
              h('div', { class: 'dt-color-group-title' }, 'CMYK'),
              h('div', { class: 'dt-color-fields' }, ...cmykFields.map((item) => item.el)),
            ),
          ),
          error,
          split(
            h('div', { class: 'dt-stack' }, pane(ctx.pick('Conversions', 'Представления'), conversions)),
            h('div', { class: 'dt-stack' }, pane(ctx.pick('Contrast (WCAG)', 'Контраст (WCAG)'), contrastHost)),
          ),
          pane(ctx.pick('Shades and tints', 'Оттенки'), paletteHost),
          h(
            'div',
            { class: 'dt-inline-actions' },
            copyBtn(() => rgbToHex(current)),
            copyBtn(() => `--color: ${rgbToHex(current)};`, ctx.pick('Copy CSS variable', 'Копировать CSS-переменную')),
          ),
        ),
      );
    },
  });
}

function colorBlindTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'graphic-color-blind',
    group: 'graphic',
    icon: '<path d="M2 12s3.5 -6 10 -6s10 6 10 6s-3.5 6 -10 6s-10 -6 -10 -6z"/><path d="M12 15a3 3 0 1 0 0 -6a3 3 0 0 0 0 6z"/>',
    name: { en: 'Color Blind Simulator', ru: 'Симулятор дальтонизма' },
    desc: {
      en: 'Preview colors and images through different color-vision deficiencies.',
      ru: 'Просмотр цветов и изображений при разных типах нарушения цветовосприятия.',
    },
    keywords: 'color blind deuteranopia protanopia tritanopia accessibility',
    mount(root, ctx) {
      const images = new Map<string, HTMLCanvasElement>();
      const grid = h('div', { class: 'dt-vision-grid' });
      const picker = h('input', { type: 'color', class: 'dt-color-input', value: '#e11d48' });
      const sourceCanvas = h('canvas', { class: 'dt-hidden' });
      let source: HTMLImageElement | null = null;
      let colorOnly = true;

      const build = (image: HTMLImageElement | null, color: string) => {
        grid.replaceChildren();
        images.clear();
        for (const deficiency of [{ id: 'normal', label: { en: 'Normal vision', ru: 'Обычное зрение' }, matrix: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] }, ...COLOR_VISION]) {
          const canvas = h('canvas', { class: 'dt-vision-canvas' });
          const width = image ? Math.min(360, image.naturalWidth) : 200;
          const height = image ? Math.round((image.naturalHeight / image.naturalWidth) * width) : 120;
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext('2d', { willReadFrequently: true });
          if (!context) continue;
          if (image) {
            context.drawImage(image, 0, 0, width, height);
          } else {
            const rgb = parseColor(color) ?? { r: 225, g: 29, b: 72 };
            const direction = context.createLinearGradient(0, 0, width, height);
            direction.addColorStop(0, rgbToHex(rgb));
            direction.addColorStop(1, rgbToHex(tint(rgb, 0.55)));
            context.fillStyle = direction;
            context.fillRect(0, 0, width, height);
            context.fillStyle = 'rgba(255,255,255,0.85)';
            context.font = '600 18px system-ui, sans-serif';
            context.fillText('Aa 123', 16, height / 2 + 6);
          }
          const data = context.getImageData(0, 0, width, height);
          for (let index = 0; index < data.data.length; index += 4) {
            const converted = applyMatrix({ r: data.data[index], g: data.data[index + 1], b: data.data[index + 2] }, deficiency.matrix);
            data.data[index] = converted.r;
            data.data[index + 1] = converted.g;
            data.data[index + 2] = converted.b;
          }
          context.putImageData(data, 0, 0);
          images.set(deficiency.id, canvas);
          grid.appendChild(
            h(
              'div',
              { class: 'dt-vision-item' },
              canvas,
              h('div', { class: 'dt-vision-label' }, ctx.pick(deficiency.label.en, deficiency.label.ru)),
            ),
          );
        }
      };

      picker.addEventListener('input', () => {
        colorOnly = true;
        source = null;
        build(null, picker.value);
      });

      const upload = fileDrop({
        accept: 'image/*',
        onFiles: async (files) => {
          const dataUrl = await readDataUrl(files[0]);
          const image = new Image();
          image.onload = () => {
            source = image;
            colorOnly = false;
            build(image, picker.value);
          };
          image.src = dataUrl;
        },
      });

      build(null, picker.value);

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          h(
            'div',
            { class: 'dt-inline-form' },
            field(ctx.pick('Test color', 'Проверяемый цвет'), h('div', { class: 'dt-inline-actions' }, picker)),
            btn(ctx.pick('Back to color swatch', 'Вернуться к цвету'), () => {
              colorOnly = true;
              source = null;
              build(null, picker.value);
            }, { variant: 'ghost' }),
          ),
          upload,
          note(ctx.pick('Upload an image or pick a color to compare normal vision with simulated deficiencies.', 'Загрузите изображение или выберите цвет, чтобы сравнить обычное зрение с симуляцией.'), 'info'),
          pane(ctx.pick('Simulation', 'Симуляция'), grid),
          colorOnly ? null : h('div', { class: 'dt-hint' }, ctx.pick('Simulations approximate real perception and are for design checks only.', 'Симуляция приблизительна и предназначена только для проверки дизайна.')),
        ),
      );
      void sourceCanvas;
    },
  });
}

function imageConverterTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'graphic-image-converter',
    group: 'graphic',
    icon: '<path d="M4 5m0 1a1 1 0 0 1 1 -1h14a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1h-14a1 1 0 0 1 -1 -1z"/><path d="M4 15l4 -4l4 4l3 -3l5 5"/><path d="M14 8l0 .01"/>',
    name: { en: 'Image Converter', ru: 'Конвертер изображений' },
    desc: {
      en: 'Convert images between PNG, JPEG and WebP with resizing and quality control.',
      ru: 'Конвертация изображений между PNG, JPEG и WebP с изменением размера и качеством.',
    },
    keywords: 'image convert png jpeg webp resize compress',
    mount(root, ctx) {
      let image: HTMLImageElement | null = null;
      let format: 'image/png' | 'image/jpeg' | 'image/webp' = 'image/webp';
      let quality = 0.85;
      let maxWidth = 0;
      let resultBlob: Blob | null = null;
      const canvas = h('canvas', { class: 'dt-hidden' });
      const preview = h('img', { class: 'dt-preview-img', alt: 'preview' });
      const info = h('div');
      const error = errorSlot();

      const convert = () => {
        if (!image) return;
        const scale = maxWidth > 0 && image.naturalWidth > maxWidth ? maxWidth / image.naturalWidth : 1;
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) return;
        if (format === 'image/jpeg') {
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, canvas.width, canvas.height);
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (!blob) return;
            resultBlob = blob;
            preview.src = URL.createObjectURL(blob);
            info.replaceChildren(
              stats([
                [ctx.pick('Source', 'Исходный размер'), `${image?.naturalWidth} × ${image?.naturalHeight}`],
                [ctx.pick('Output', 'Результат'), `${canvas.width} × ${canvas.height}`],
                [ctx.pick('Format', 'Формат'), blob.type.replace('image/', '').toUpperCase()],
                [ctx.pick('Size', 'Размер файла'), `${(blob.size / 1024).toFixed(1)} KB`],
              ]),
            );
            setError(error, null);
          },
          format,
          format === 'image/png' ? undefined : quality,
        );
      };

      const upload = fileDrop({
        accept: 'image/*',
        onFiles: async (files) => {
          const dataUrl = await readDataUrl(files[0]);
          const loaded = new Image();
          loaded.onload = () => {
            image = loaded;
            convert();
          };
          loaded.onerror = () => setError(error, ctx.pick('Cannot read image.', 'Не удалось прочитать изображение.'));
          loaded.src = dataUrl;
        },
      });

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          upload,
          error,
          h(
            'div',
            { class: 'dt-inline-form' },
            field(
              ctx.pick('Format', 'Формат'),
              select(
                [
                  { value: 'image/webp', label: 'WebP' },
                  { value: 'image/png', label: 'PNG' },
                  { value: 'image/jpeg', label: 'JPEG' },
                ],
                format,
                (value) => {
                  format = value as typeof format;
                  convert();
                },
              ),
            ),
            rangeField(ctx.pick('Max width (0 = original)', 'Макс. ширина (0 = исходная)'), 0, 2000, 0, (value) => {
              maxWidth = value;
              convert();
            }, 50),
          ),
          (format as string) === 'image/png'
            ? null
            : rangeField(ctx.pick('Quality', 'Качество'), 10, 100, 85, (value) => {
                quality = value / 100;
                convert();
              }),
          pane(ctx.pick('Result', 'Результат'), h('div', { class: 'dt-stack' }, preview, info, toolbar(downloadBtn(() => resultBlob ?? new Blob(), () => `image.${format.split('/')[1]}`)))),
        ),
      );
    },
  });
}

export const graphicTools = [colorToolsTool(), colorBlindTool(), imageConverterTool()];
