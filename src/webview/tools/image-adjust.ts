/** Image adjustments: Lightroom-style tone, color and detail corrections. */
import {
  btn,
  checkbox,
  downloadBlob,
  errorSlot,
  field,
  fileDrop,
  pane,
  knobField as rangeField,
  readDataUrl,
  select,
  setError,
  split,
  knob,
} from '../components.ts';
import { clamp, h } from '../dom.ts';
import { defineTool } from '../tool-types.ts';

type ExportFormat = 'image/png' | 'image/jpeg' | 'image/webp';

interface Settings {
  exposure: number;
  brightness: number;
  contrast: number;
  saturation: number;
  vibrance: number;
  hue: number;
  temperature: number;
  tint: number;
  highlights: number;
  shadows: number;
  gamma: number;
  fade: number;
  vignette: number;
  grain: number;
  sharpen: number;
}

const ZERO: Settings = {
  exposure: 0,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  vibrance: 0,
  hue: 0,
  temperature: 0,
  tint: 0,
  highlights: 0,
  shadows: 0,
  gamma: 0,
  fade: 0,
  vignette: 0,
  grain: 0,
  sharpen: 0,
};

const PRESETS: Array<{ id: string; label: [string, string]; values: Partial<Settings> }> = [
  { id: 'original', label: ['Original', 'Оригинал'], values: {} },
  {
    id: 'auto',
    label: ['Auto', 'Авто'],
    values: { brightness: 5, contrast: 12, saturation: 8, vibrance: 15, highlights: -10, shadows: 12 },
  },
  {
    id: 'vivid',
    label: ['Vivid', 'Сочный'],
    values: { contrast: 10, saturation: 30, vibrance: 25 },
  },
  { id: 'warm', label: ['Warm', 'Тёплый'], values: { temperature: 35, tint: 5, saturation: 5 } },
  { id: 'cool', label: ['Cool', 'Холодный'], values: { temperature: -35, tint: -5 } },
  { id: 'bw', label: ['Black & white', 'Ч/Б'], values: { saturation: -100, contrast: 8 } },
  { id: 'sepia', label: ['Sepia', 'Сепия'], values: { saturation: -70, temperature: 35, grain: 12 } },
  {
    id: 'cinematic',
    label: ['Cinematic', 'Кино'],
    values: { contrast: 15, saturation: -10, shadows: 20, highlights: -15, vignette: 25, grain: 6 },
  },
  {
    id: 'faded',
    label: ['Faded', 'Выцветший'],
    values: { contrast: -20, brightness: 8, saturation: -15, shadows: 20, fade: 30 },
  },
];

const SLIDERS: Array<{
  key: Exclude<keyof Settings, 'sharpen'>;
  label: [string, string];
  min: number;
  max: number;
  icon: string;
}> = [
  { key: 'exposure', label: ['Exposure', 'Экспозиция'], min: -100, max: 100, icon: '<path d="M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"/><path d="M3 12h1"/><path d="M20 12h1"/><path d="M12 3v1"/><path d="M12 20v1"/><path d="M5.6 5.6l.7 .7"/><path d="M17.7 17.7l.7 .7"/><path d="M18.4 5.6l-.7 .7"/><path d="M6.3 17.7l-.7 .7"/>' },
  { key: 'brightness', label: ['Brightness', 'Яркость'], min: -100, max: 100, icon: '<path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M3 12h2"/><path d="M19 12h2"/><path d="M12 3v2"/><path d="M12 19v2"/><path d="M5.6 5.6l1.4 1.4"/><path d="M17 17l1.4 1.4"/><path d="M18.4 5.6l-1.4 1.4"/><path d="M7 17l-1.4 1.4"/>' },
  { key: 'contrast', label: ['Contrast', 'Контраст'], min: -100, max: 100, icon: '<path d="M12 3a9 9 0 1 0 0 18z"/><path d="M12 3a9 9 0 0 1 0 18"/>' },
  { key: 'highlights', label: ['Highlights', 'Светлые'], min: -100, max: 100, icon: '<path d="M12 3l1.9 5.8h6l-4.9 3.5l1.9 5.8l-4.9 -3.6l-4.9 3.6l1.9 -5.8l-4.9 -3.5h6z"/>' },
  { key: 'shadows', label: ['Shadows', 'Тени'], min: -100, max: 100, icon: '<path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z"/>' },
  { key: 'gamma', label: ['Gamma', 'Гамма'], min: -100, max: 100, icon: '<path d="M4 20c4 0 4 -16 8 -16s4 16 8 16"/>' },
  { key: 'saturation', label: ['Saturation', 'Насыщенность'], min: -100, max: 100, icon: '<path d="M12 3l5 6a5 5 0 1 1 -10 0z"/>' },
  { key: 'vibrance', label: ['Vibrance', 'Сочность'], min: -100, max: 100, icon: '<path d="M12 3l1.5 4.5l4.5 1.5l-4.5 1.5l-1.5 4.5l-1.5 -4.5l-4.5 -1.5l4.5 -1.5z"/>' },
  { key: 'hue', label: ['Hue', 'Оттенок цвета'], min: -100, max: 100, icon: '<path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/><path d="M12 3v18"/><path d="M12 12h9"/>' },
  { key: 'temperature', label: ['Temperature', 'Температура'], min: -100, max: 100, icon: '<path d="M10 13v-7a2 2 0 1 1 4 0v7a4 4 0 1 1 -4 0z"/>' },
  { key: 'tint', label: ['Tint', 'Тон'], min: -100, max: 100, icon: '<path d="M8 8m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"/><path d="M16 16m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"/>' },
  { key: 'fade', label: ['Fade', 'Выцветание'], min: 0, max: 100, icon: '<path d="M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0 -18z"/><path d="M8 12h8"/>' },
  { key: 'vignette', label: ['Vignette', 'Виньетка'], min: 0, max: 100, icon: '<path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/><path d="M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"/>' },
  { key: 'grain', label: ['Grain', 'Зерно'], min: 0, max: 100, icon: '<path d="M5 5h.01"/><path d="M9 9h.01"/><path d="M5 13h.01"/><path d="M13 5h.01"/><path d="M17 9h.01"/><path d="M9 17h.01"/><path d="M13 13h.01"/><path d="M17 17h.01"/>' },
];

function applySettings(source: ImageData, settings: Settings): ImageData {
  const { width, height, data } = source;
  const pixels = new Uint8ClampedArray(data);
  const exposure = Math.pow(2, (settings.exposure / 100) * 2);
  const brightness = (settings.brightness / 100) * 60;
  const contrastValue = settings.contrast * 2.55;
  const contrast = (259 * (contrastValue + 255)) / (255 * (259 - contrastValue));
  const saturation = 1 + settings.saturation / 100;
  const vibrance = settings.vibrance / 100;
  const temperature = (settings.temperature / 100) * 42;
  const tint = (settings.tint / 100) * 32;
  const highlights = settings.highlights / 100;
  const shadows = settings.shadows / 100;
  const gammaExponent = Math.pow(2, -settings.gamma / 100);
  const fade = settings.fade / 100;
  const hueAngle = (settings.hue / 100) * Math.PI;
  const hueCos = Math.cos(hueAngle);
  const hueSin = Math.sin(hueAngle);
  const h00 = 0.213 + hueCos * 0.787 - hueSin * 0.213;
  const h01 = 0.715 - hueCos * 0.715 - hueSin * 0.715;
  const h02 = 0.072 - hueCos * 0.072 + hueSin * 0.928;
  const h10 = 0.213 - hueCos * 0.213 + hueSin * 0.143;
  const h11 = 0.715 + hueCos * 0.285 + hueSin * 0.14;
  const h12 = 0.072 - hueCos * 0.072 - hueSin * 0.283;
  const h20 = 0.213 - hueCos * 0.213 - hueSin * 0.787;
  const h21 = 0.715 - hueCos * 0.715 + hueSin * 0.715;
  const h22 = 0.072 + hueCos * 0.928 + hueSin * 0.072;
  const vignette = settings.vignette / 100;
  const grain = (settings.grain / 100) * 42;
  const centerX = width / 2;
  const centerY = height / 2;
  const maxDistance = Math.hypot(centerX, centerY) || 1;

  for (let index = 0; index < pixels.length; index += 4) {
    let r = pixels[index] * exposure + brightness + temperature + tint * 0.15;
    let g = pixels[index + 1] * exposure + brightness - tint;
    let b = pixels[index + 2] * exposure + brightness - temperature + tint * 0.15;

    r = contrast * (r - 128) + 128;
    g = contrast * (g - 128) + 128;
    b = contrast * (b - 128) + 128;

    if (fade > 0) {
      r = r * (1 - fade * 0.4) + fade * 78;
      g = g * (1 - fade * 0.4) + fade * 78;
      b = b * (1 - fade * 0.4) + fade * 78;
    }

    if (gammaExponent !== 1) {
      r = 255 * Math.pow(clamp(r, 0, 255) / 255, gammaExponent);
      g = 255 * Math.pow(clamp(g, 0, 255) / 255, gammaExponent);
      b = 255 * Math.pow(clamp(b, 0, 255) / 255, gammaExponent);
    }

    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (highlights !== 0 && luma > 110) {
      const weight = (luma - 110) / 145;
      const shift = highlights * 90 * weight;
      r += shift;
      g += shift;
      b += shift;
    }
    if (shadows !== 0 && luma < 145) {
      const weight = (145 - luma) / 145;
      const shift = shadows * 80 * weight;
      r += shift;
      g += shift;
      b += shift;
    }

    const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = gray + (r - gray) * saturation;
    g = gray + (g - gray) * saturation;
    b = gray + (b - gray) * saturation;

    if (vibrance !== 0) {
      const currentMax = Math.max(r, g, b);
      const currentMin = Math.min(r, g, b);
      const amount = ((currentMax - currentMin) / 255) * vibrance;
      r += (currentMax - r) * amount * 0.7;
      g += (currentMax - g) * amount * 0.7;
      b += (currentMax - b) * amount * 0.7;
    }

    if (settings.hue !== 0) {
      const sourceR = r;
      const sourceG = g;
      const sourceB = b;
      r = sourceR * h00 + sourceG * h01 + sourceB * h02;
      g = sourceR * h10 + sourceG * h11 + sourceB * h12;
      b = sourceR * h20 + sourceG * h21 + sourceB * h22;
    }

    if (vignette > 0) {
      const pixel = index / 4;
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      const distance = Math.hypot(x - centerX, y - centerY) / maxDistance;
      const factor = 1 - vignette * distance * distance * 0.95;
      r *= factor;
      g *= factor;
      b *= factor;
    }

    if (grain > 0) {
      const noise = (((index * 2654435761) >>> 0) % 1000) / 1000 - 0.5;
      const shift = noise * grain;
      r += shift;
      g += shift;
      b += shift;
    }

    pixels[index] = r;
    pixels[index + 1] = g;
    pixels[index + 2] = b;
  }

  if (settings.sharpen > 0) {
    const amount = (settings.sharpen / 100) * 1.4;
    const copy = new Uint8ClampedArray(pixels);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const index = (y * width + x) * 4;
        for (let channel = 0; channel < 3; channel++) {
          const up = copy[index - width * 4 + channel];
          const down = copy[index + width * 4 + channel];
          const left = copy[index - 4 + channel];
          const right = copy[index + 4 + channel];
          const value = copy[index + channel];
          pixels[index + channel] = value + amount * (value * 5 - up - down - left - right);
        }
      }
    }
  }

  return new ImageData(pixels, width, height);
}

function imageAdjustTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'graphic-image-adjust',
    group: 'graphic',
    icon: '<path d="M12 3v2"/><path d="M12 19v2"/><path d="M5 12h-2"/><path d="M21 12h-2"/><path d="M7 7l-1.5 -1.5"/><path d="M18.5 18.5l-1.5 -1.5"/><path d="M7 17l-1.5 1.5"/><path d="M18.5 5.5l-1.5 1.5"/><path d="M12 16a4 4 0 1 0 0 -8a4 4 0 0 0 0 8z"/>',
    name: { en: 'Image Adjustments', ru: 'Коррекция изображений' },
    desc: {
      en: 'Lightroom-style tone and color corrections: exposure, contrast, highlights, colors, vignette and grain.',
      ru: 'Коррекция как в Lightroom: экспозиция, контраст, света и тени, цвет, виньетка и зерно.',
    },
    keywords: 'photo image adjust lightroom brightness contrast saturation exposure temperature vignette grain sharpen presets',
    mount(root, ctx) {
      let image: HTMLImageElement | null = null;
      let fileName = 'image';
      let settings: Settings = { ...ZERO };
      let preset = 'original';
      let showOriginal = false;
      let exportFormat: ExportFormat = 'image/png';
      let exportQuality = 0.92;
      let renderFrame = 0;
      let presetSelect: HTMLSelectElement | null = null;

      const error = errorSlot();
      const previewCanvas = h('canvas', { class: 'dt-ie-canvas' });
      const previewWrap = h('div', { class: 'dt-ie-stage' }, previewCanvas);
      const histogram = h('canvas', { class: 'dt-adjust-histogram', width: 256, height: 72 });
      const curveCanvas = h('canvas', { class: 'dt-adjust-curve', width: 256, height: 120 });
      const stats = h('div', { class: 'dt-stats' });
      const controls = h('div', { class: 'dt-stack' });
      const hint = h('div', { class: 'dt-hint' });
      let sourceData: ImageData | null = null;
      let workWidth = 0;
      let workHeight = 0;

      const isBlank = (): boolean => Object.values(settings).every((value) => value === 0);

      const drawHistogram = (data: ImageData): void => {
        const context = histogram.getContext('2d');
        if (!context) return;
        const buckets = new Array<number>(256).fill(0);
        const pixels = data.data;
        for (let index = 0; index < pixels.length; index += 16) {
          const luma = Math.round(0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2]);
          buckets[clamp(luma, 0, 255)]++;
        }
        const max = Math.max(1, ...buckets);
        context.clearRect(0, 0, histogram.width, histogram.height);
        context.fillStyle = 'rgba(59,130,246,0.55)';
        for (let index = 0; index < buckets.length; index++) {
          const barHeight = (buckets[index] / max) * histogram.height;
          context.fillRect(index, histogram.height - barHeight, 1, barHeight);
        }
      };

      const process = (data: ImageData): ImageData => (isBlank() ? data : applySettings(data, settings));

      const drawCurve = (): void => {
        const context = curveCanvas.getContext('2d');
        if (!context) return;
        const width = curveCanvas.width;
        const height = curveCanvas.height;
        context.clearRect(0, 0, width, height);
        context.strokeStyle = 'rgba(148,163,184,0.18)';
        context.lineWidth = 1;
        for (let step = 1; step < 4; step++) {
          context.beginPath();
          context.moveTo((width / 4) * step, 0);
          context.lineTo((width / 4) * step, height);
          context.stroke();
          context.beginPath();
          context.moveTo(0, (height / 4) * step);
          context.lineTo(width, (height / 4) * step);
          context.stroke();
        }
        context.strokeStyle = 'rgba(148,163,184,0.35)';
        context.setLineDash([4, 4]);
        context.beginPath();
        context.moveTo(0, height);
        context.lineTo(width, 0);
        context.stroke();
        context.setLineDash([]);

        const exposure = Math.pow(2, (settings.exposure / 100) * 2);
        const brightness = (settings.brightness / 100) * 60;
        const contrastValue = settings.contrast * 2.55;
        const contrast = (259 * (contrastValue + 255)) / (255 * (259 - contrastValue));
        const gammaExponent = Math.pow(2, -settings.gamma / 100);
        const fade = settings.fade / 100;
        context.beginPath();
        for (let x = 0; x <= width; x++) {
          let value = (x / width) * 255 * exposure + brightness;
          value = contrast * (value - 128) + 128;
          if (fade > 0) value = value * (1 - fade * 0.4) + fade * 78;
          if (gammaExponent !== 1) value = 255 * Math.pow(clamp(value, 0, 255) / 255, gammaExponent);
          const y = height - (clamp(value, 0, 255) / 255) * height;
          if (x === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        context.strokeStyle = '#3b82f6';
        context.lineWidth = 2;
        context.shadowColor = 'rgba(59,130,246,0.55)';
        context.shadowBlur = 6;
        context.stroke();
        context.shadowBlur = 0;
      };

      const render = (): void => {
        drawCurve();
        if (!sourceData) return;
        const context = previewCanvas.getContext('2d');
        if (!context) return;
        if (workWidth !== previewCanvas.width || workHeight !== previewCanvas.height) {
          previewCanvas.width = workWidth;
          previewCanvas.height = workHeight;
        }
        if (showOriginal || isBlank()) {
          context.putImageData(sourceData, 0, 0);
          drawHistogram(sourceData);
          return;
        }
        const processed = process(sourceData);
        context.putImageData(processed, 0, 0);
        drawHistogram(processed);
      };

      const scheduleRender = (): void => {
        if (renderFrame) return;
        renderFrame = requestAnimationFrame(() => {
          renderFrame = 0;
          render();
        });
      };

      const buildControls = (): void => {
        controls.replaceChildren();
        const presetControl = select(
          PRESETS.map((item) => ({ value: item.id, label: ctx.pick(item.label[0], item.label[1]) })),
          preset,
          (value) => {
            preset = value;
            const chosen = PRESETS.find((item) => item.id === value);
            settings = { ...ZERO, ...(chosen?.values ?? {}) };
            buildControls();
            scheduleRender();
          },
        );
        presetSelect = presetControl;
        controls.appendChild(field(ctx.pick('Preset', 'Пресет'), presetControl));
        controls.appendChild(
          checkbox(ctx.pick('Show original', 'Показать оригинал'), showOriginal, (value) => {
            showOriginal = value;
            scheduleRender();
          }),
        );
        const knobGrid = h('div', { class: 'dt-knob-grid' });
        for (const slider of SLIDERS) {
          knobGrid.appendChild(
            knob({
              label: ctx.pick(slider.label[0], slider.label[1]),
              icon: slider.icon,
              min: slider.min,
              max: slider.max,
              value: settings[slider.key],
              oninput: (value) => {
                settings[slider.key] = value;
                preset = 'original';
                if (presetSelect) presetSelect.value = 'original';
                scheduleRender();
              },
            }),
          );
        }
        knobGrid.appendChild(
          knob({
            label: ctx.pick('Sharpening', 'Резкость'),
            icon: '<path d="M12 3l1.8 5.2l5.2 1.8l-5.2 1.8l-1.8 5.2l-1.8 -5.2l-5.2 -1.8l5.2 -1.8z"/>',
            min: 0,
            max: 100,
            value: settings.sharpen,
            oninput: (value) => {
              settings.sharpen = value;
              preset = 'original';
              if (presetSelect) presetSelect.value = 'original';
              scheduleRender();
            },
          }),
        );
        controls.appendChild(knobGrid);
        controls.appendChild(
          h(
            'div',
            { class: 'dt-toolbar' },
            btn(
              ctx.pick('Reset all', 'Сбросить всё'),
              () => {
                settings = { ...ZERO };
                preset = 'original';
                buildControls();
                scheduleRender();
              },
              { variant: 'ghost' },
            ),
          ),
        );
      };

      const loadFromDataUrl = (name: string, dataUrl: string): void => {
        setError(error, null);
        void new Promise<HTMLImageElement>((resolve, reject) => {
          const element = new Image();
          element.onload = () => resolve(element);
          element.onerror = () => reject(new Error('image'));
          element.src = dataUrl;
        })
          .then((element) => {
            image = element;
            fileName = name.replace(/\.[^.]+$/, '') || 'image';
            const maxSide = Math.max(element.naturalWidth, element.naturalHeight);
            const scale = maxSide > 1400 ? 1400 / maxSide : 1;
            workWidth = Math.max(1, Math.round(element.naturalWidth * scale));
            workHeight = Math.max(1, Math.round(element.naturalHeight * scale));
            previewCanvas.width = workWidth;
            previewCanvas.height = workHeight;
            const context = previewCanvas.getContext('2d', { willReadFrequently: true });
            if (!context) return;
            context.drawImage(element, 0, 0, workWidth, workHeight);
            sourceData = context.getImageData(0, 0, workWidth, workHeight);
            stats.replaceChildren(
              h('div', { class: 'dt-stat' }, h('div', { class: 'dt-stat-value' }, `${element.naturalWidth} × ${element.naturalHeight}`), h('div', { class: 'dt-stat-label' }, ctx.pick('Source', 'Исходник'))),
              h('div', { class: 'dt-stat' }, h('div', { class: 'dt-stat-value' }, name.split('.').pop()?.toUpperCase() || '—'), h('div', { class: 'dt-stat-label' }, ctx.pick('Format', 'Формат'))),
            );
            settings = { ...ZERO };
            preset = 'original';
            buildControls();
            render();
          })
          .catch(() => setError(error, ctx.pick('Cannot read this image.', 'Не удалось прочитать изображение.')));
      };

      const loadImage = (file: File): void => {
        void readDataUrl(file).then((dataUrl) => loadFromDataUrl(file.name, dataUrl));
      };

      const upload = fileDrop({
        accept: 'image/*',
        hint: ctx.pick('Drop a photo to adjust', 'Перетащите фото для коррекции'),
        onFiles: (files) => {
          if (files[0]) loadImage(files[0]);
        },
      });

      const exportImage = async (): Promise<void> => {
        if (!image) return;
        const maxSide = Math.max(image.naturalWidth, image.naturalHeight);
        const scale = maxSide > 4096 ? 4096 / maxSide : 1;
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) return;
        context.drawImage(image, 0, 0, width, height);
        const data = context.getImageData(0, 0, width, height);
        context.putImageData(applySettings(data, settings), 0, 0);
        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((value) => resolve(value), exportFormat, exportQuality);
        });
        if (!blob) {
          setError(error, ctx.pick('Export failed.', 'Не удалось экспортировать изображение.'));
          return;
        }
        downloadBlob(`${fileName}-adjusted.${exportFormat.split('/')[1]}`, blob);
      };

      const exportPane = pane(
        ctx.pick('Export', 'Экспорт'),
        h(
          'div',
          { class: 'dt-stack' },
          field(
            ctx.pick('Format', 'Формат'),
            select(
              [
                { value: 'image/png', label: 'PNG' },
                { value: 'image/jpeg', label: 'JPEG' },
                { value: 'image/webp', label: 'WebP' },
              ],
              exportFormat,
              (value) => {
                exportFormat = value as ExportFormat;
              },
            ),
          ),
          rangeField(ctx.pick('Quality', 'Качество'), 10, 100, Math.round(exportQuality * 100), (value) => {
            exportQuality = value / 100;
          }),
          btn(ctx.pick('Download image', 'Скачать изображение'), () => void exportImage(), { variant: 'primary' }),
        ),
      );

      buildControls();
      hint.textContent = ctx.pick(
        'Drag knobs vertically, scroll to fine-tune, double-click to reset. The preview is scaled down for speed; export keeps the original resolution.',
        'Крутите ручки вертикально, колесо — точная настройка, двойной клик — сброс. Предпросмотр уменьшен для скорости, экспорт сохраняет исходное разрешение.',
      );

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          error,
          upload,
          split(
            h(
              'div',
              { class: 'dt-col' },
              pane(ctx.pick('Preview', 'Предпросмотр'), h('div', { class: 'dt-stack' }, previewWrap, curveCanvas, histogram, stats), [], '', { collapsible: false }),
              hint,
            ),
            h('div', { class: 'dt-col' }, pane(ctx.pick('Adjustments', 'Коррекции'), controls), exportPane),
          ),
        ),
      );

      const incoming = ctx.takeIncoming();
      if (incoming && incoming.mime.startsWith('image/')) loadFromDataUrl(incoming.name, incoming.dataUrl);
    },
  });
}

export const imageAdjustTools = [imageAdjustTool()];
