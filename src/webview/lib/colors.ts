/** Color conversions, contrast and color-vision simulation. */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function parseColor(input: string): Rgb | null {
  const value = input.trim().toLowerCase();
  if (!value) return null;

  const hex = value.replace(/^#/, '');
  if (/^[0-9a-f]{3,4}$/.test(hex)) {
    return {
      r: parseInt(hex[0] + hex[0], 16),
      g: parseInt(hex[1] + hex[1], 16),
      b: parseInt(hex[2] + hex[2], 16),
    };
  }
  if (/^[0-9a-f]{6}$/.test(hex) || /^[0-9a-f]{8}$/.test(hex)) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }

  const rgbMatch = value.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  if (rgbMatch) {
    return { r: clampChannel(Number(rgbMatch[1])), g: clampChannel(Number(rgbMatch[2])), b: clampChannel(Number(rgbMatch[3])) };
  }

  const hslMatch = value.match(/^hsla?\(\s*([\d.]+)[,\s]+([\d.]+)%?[,\s]+([\d.]+)%?/);
  if (hslMatch) {
    return hslToRgb({ h: Number(hslMatch[1]), s: Number(hslMatch[2]), l: Number(hslMatch[3]) });
  }

  return null;
}

export function rgbToHex(rgb: Rgb): string {
  return `#${[rgb.r, rgb.g, rgb.b].map((channel) => clampChannel(channel).toString(16).padStart(2, '0')).join('')}`;
}

export function rgbToHsl(rgb: Rgb): Hsl {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const l = (max + min) / 2;

  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToRgb(hsl: Hsl): Rgb {
  const h = ((hsl.h % 360) + 360) % 360;
  const s = Math.max(0, Math.min(100, hsl.s)) / 100;
  const l = Math.max(0, Math.min(100, hsl.l)) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: clampChannel((r + m) * 255), g: clampChannel((g + m) * 255), b: clampChannel((b + m) * 255) };
}

export function luminance(rgb: Rgb): number {
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

export function contrast(first: Rgb, second: Rgb): number {
  const a = luminance(first);
  const b = luminance(second);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

export function mix(first: Rgb, second: Rgb, weight: number): Rgb {
  const w = Math.max(0, Math.min(1, weight));
  return {
    r: clampChannel(first.r * (1 - w) + second.r * w),
    g: clampChannel(first.g * (1 - w) + second.g * w),
    b: clampChannel(first.b * (1 - w) + second.b * w),
  };
}

export function shade(rgb: Rgb, amount: number): Rgb {
  return mix(rgb, { r: 0, g: 0, b: 0 }, amount);
}

export function tint(rgb: Rgb, amount: number): Rgb {
  return mix(rgb, { r: 255, g: 255, b: 255 }, amount);
}

export function cmykToRgb(value: { c: number; m: number; y: number; k: number }): Rgb {
  const c = Math.max(0, Math.min(100, value.c)) / 100;
  const m = Math.max(0, Math.min(100, value.m)) / 100;
  const y = Math.max(0, Math.min(100, value.y)) / 100;
  const k = Math.max(0, Math.min(100, value.k)) / 100;
  return {
    r: clampChannel(255 * (1 - c) * (1 - k)),
    g: clampChannel(255 * (1 - m) * (1 - k)),
    b: clampChannel(255 * (1 - y) * (1 - k)),
  };
}

export function cmyk(rgb: Rgb): { c: number; m: number; y: number; k: number } {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const k = 1 - Math.max(r, g, b);
  if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
  return {
    c: Math.round(((1 - r - k) / (1 - k)) * 100),
    m: Math.round(((1 - g - k) / (1 - k)) * 100),
    y: Math.round(((1 - b - k) / (1 - k)) * 100),
    k: Math.round(k * 100),
  };
}

export function rgbCss(rgb: Rgb): string {
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

export function hslCss(hsl: Hsl): string {
  return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
}

export interface ColorVisionDef {
  id: string;
  label: { en: string; ru: string };
  matrix: number[][];
}

export const COLOR_VISION: ColorVisionDef[] = [
  {
    id: 'protanopia',
    label: { en: 'Protanopia', ru: 'Протанопия' },
    matrix: [
      [0.567, 0.433, 0],
      [0.558, 0.442, 0],
      [0, 0.242, 0.758],
    ],
  },
  {
    id: 'protanomaly',
    label: { en: 'Protanomaly', ru: 'Протаномалия' },
    matrix: [
      [0.817, 0.183, 0],
      [0.333, 0.667, 0],
      [0, 0.125, 0.875],
    ],
  },
  {
    id: 'deuteranopia',
    label: { en: 'Deuteranopia', ru: 'Дейтеранопия' },
    matrix: [
      [0.625, 0.375, 0],
      [0.7, 0.3, 0],
      [0, 0.3, 0.7],
    ],
  },
  {
    id: 'deuteranomaly',
    label: { en: 'Deuteranomaly', ru: 'Дейтераномалия' },
    matrix: [
      [0.8, 0.2, 0],
      [0.258, 0.742, 0],
      [0, 0.142, 0.858],
    ],
  },
  {
    id: 'tritanopia',
    label: { en: 'Tritanopia', ru: 'Тританопия' },
    matrix: [
      [0.95, 0.05, 0],
      [0, 0.433, 0.567],
      [0, 0.475, 0.525],
    ],
  },
  {
    id: 'tritanomaly',
    label: { en: 'Tritanomaly', ru: 'Тританомалия' },
    matrix: [
      [0.967, 0.033, 0],
      [0, 0.733, 0.267],
      [0, 0.183, 0.817],
    ],
  },
  {
    id: 'achromatopsia',
    label: { en: 'Achromatopsia', ru: 'Ахроматопсия' },
    matrix: [
      [0.299, 0.587, 0.114],
      [0.299, 0.587, 0.114],
      [0.299, 0.587, 0.114],
    ],
  },
];

export function applyMatrix(rgb: Rgb, matrix: number[][]): Rgb {
  const r = rgb.r * matrix[0][0] + rgb.g * matrix[0][1] + rgb.b * matrix[0][2];
  const g = rgb.r * matrix[1][0] + rgb.g * matrix[1][1] + rgb.b * matrix[1][2];
  const b = rgb.r * matrix[2][0] + rgb.g * matrix[2][1] + rgb.b * matrix[2][2];
  return { r: clampChannel(r), g: clampChannel(g), b: clampChannel(b) };
}
