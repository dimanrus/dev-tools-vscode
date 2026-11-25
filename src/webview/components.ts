/** Reusable UI building blocks shared by all tools. */
import { clamp, h, svgIcon, type Child } from './dom.ts';
import { t } from './i18n.ts';

export interface ButtonOptions {
  variant?: 'primary' | 'ghost' | 'danger' | 'subtle';
  icon?: string;
  title?: string;
  disabled?: boolean;
  class?: string;
}

export function btn(label: string, onClick: (event: MouseEvent) => void, options: ButtonOptions = {}): HTMLButtonElement {
  const element = h(
    'button',
    {
      class: ['dt-btn', options.variant ? `dt-btn-${options.variant}` : '', options.class ?? ''].filter(Boolean).join(' '),
      type: 'button',
      title: options.title ?? label,
      disabled: options.disabled ?? false,
      onclick: onClick,
    },
    options.icon ? svgIcon(options.icon, 15) : null,
    label ? h('span', { class: 'dt-btn-label' }, label) : null,
  );
  return element;
}

export function iconBtn(icon: string, title: string, onClick: (event: MouseEvent) => void, options: ButtonOptions = {}): HTMLButtonElement {
  const element = btn('', onClick, { ...options, icon, title, class: `dt-btn-icon ${options.class ?? ''}` });
  element.setAttribute('aria-label', title);
  return element;
}

export function toolbar(...children: Child[]): HTMLElement {
  return h('div', { class: 'dt-toolbar' }, ...children);
}

export function row(...children: Child[]): HTMLElement {
  return h('div', { class: 'dt-row' }, ...children);
}

export function stack(...children: Child[]): HTMLElement {
  return h('div', { class: 'dt-stack' }, ...children);
}

export function card(title: string | null, ...children: Child[]): HTMLElement {
  return h('section', { class: 'dt-card' }, title ? h('h3', { class: 'dt-card-title' }, title) : null, ...children);
}

export function field(label: string, control: Child, hint?: string): HTMLElement {
  return h('div', { class: 'dt-field' }, h('span', { class: 'dt-label' }, label), control, hint ? h('span', { class: 'dt-hint' }, hint) : null);
}

export interface AreaOptions {
  value?: string;
  placeholder?: string;
  rows?: number;
  readOnly?: boolean;
  mono?: boolean;
  spellcheck?: boolean;
  class?: string;
  wrap?: 'soft' | 'off' | 'hard';
  oninput?: (value: string, element: HTMLTextAreaElement) => void;
}

export function area(options: AreaOptions = {}): HTMLTextAreaElement {
  const element = h('textarea', {
    class: `dt-input dt-area ${options.mono === false ? '' : 'dt-mono'} ${options.class ?? ''}`,
    rows: options.rows ?? 10,
    value: options.value ?? '',
    placeholder: options.placeholder ?? '',
    readOnly: options.readOnly ?? false,
    spellcheck: options.spellcheck ?? false,
    wrap: options.wrap ?? 'off',
  });
  if (options.oninput) {
    element.addEventListener('input', () => options.oninput?.(element.value, element));
  }
  return element;
}

export interface InputOptions {
  value?: string | number;
  placeholder?: string;
  type?: string;
  min?: number;
  max?: number;
  step?: number;
  readOnly?: boolean;
  class?: string;
  oninput?: (value: string, element: HTMLInputElement) => void;
  onchange?: (value: string, element: HTMLInputElement) => void;
}

export function textInput(options: InputOptions = {}): HTMLInputElement {
  const element = h('input', {
    class: `dt-input ${options.class ?? ''}`,
    type: options.type ?? 'text',
    value: options.value ?? '',
    placeholder: options.placeholder ?? '',
    readOnly: options.readOnly ?? false,
    spellcheck: false,
    autocomplete: 'off',
  });
  if (options.min !== undefined) element.min = String(options.min);
  if (options.max !== undefined) element.max = String(options.max);
  if (options.step !== undefined) element.step = String(options.step);
  if (options.oninput) element.addEventListener('input', () => options.oninput?.(element.value, element));
  if (options.onchange) element.addEventListener('change', () => options.onchange?.(element.value, element));
  return element;
}

export interface SelectOption {
  value: string;
  label: string;
  /** Tooltip, also used as the accessible name when the label is abbreviated. */
  title?: string;
  /** Icon paths; when set the option renders as an icon-only segment. */
  icon?: string;
}

export function select(options: SelectOption[], value: string, onchange?: (value: string) => void, className = ''): HTMLSelectElement {
  const element = h('select', { class: `dt-input dt-select ${className}` });
  for (const option of options) {
    element.appendChild(h('option', { value: option.value, text: option.label, title: option.title }));
  }
  element.value = value;
  if (onchange) element.addEventListener('change', () => onchange(element.value));
  return element;
}

export function selectField(label: string, options: SelectOption[], value: string, onchange?: (value: string) => void): HTMLElement {
  return field(label, select(options, value, onchange));
}

/**
 * Compact radio-style switch for 2–4 short options.
 * Unlike a native <select> it never opens a floating popup, which keeps
 * toolbars stable inside short webview panels.
 */
export function segmented(options: SelectOption[], value: string, onchange: (value: string) => void, className = ''): HTMLElement {
  const wrap = h('div', { class: `dt-segmented ${className}`, role: 'radiogroup' });
  const buttons: HTMLButtonElement[] = [];
  const mark = (next: string): void => {
    for (const button of buttons) {
      const active = button.dataset.value === next;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-checked', String(active));
    }
  };
  for (const option of options) {
    const button = h(
      'button',
      {
        class: `dt-segment ${option.icon ? 'dt-segment-icon' : ''}`,
        type: 'button',
        role: 'radio',
        title: option.title ?? option.label,
        dataset: { value: option.value },
      },
      option.icon ? svgIcon(option.icon, 15) : null,
      option.label ? h('span', { class: option.icon ? 'dt-hidden' : '' }, option.label) : null,
    );
    if (option.icon) button.setAttribute('aria-label', option.label);
    button.addEventListener('click', () => {
      mark(option.value);
      onchange(option.value);
    });
    buttons.push(button);
    wrap.appendChild(button);
  }
  mark(value);
  return wrap;
}

export function checkbox(label: string, checked: boolean, onchange: (checked: boolean) => void): HTMLElement {
  const input = h('input', { type: 'checkbox', class: 'dt-check', checked });
  input.addEventListener('change', () => onchange(input.checked));
  return h('label', { class: 'dt-checkbox' }, input, h('span', {}, label));
}

export function rangeField(label: string, min: number, max: number, value: number, oninput: (value: number) => void, step = 1): HTMLElement {
  const output = h('span', { class: 'dt-range-value' }, String(value));
  const input = h('input', { type: 'range', class: 'dt-range', min, max, step, value });
  const paint = (): void => {
    const span = max - min;
    const ratio = span > 0 ? (Number(input.value) - min) / span : 0;
    input.style.setProperty('--dt-range-fill', `${Math.min(100, Math.max(0, ratio * 100))}%`);
  };
  input.addEventListener('input', () => {
    output.textContent = input.value;
    paint();
    oninput(Number(input.value));
  });
  paint();
  return h('div', { class: 'dt-field' }, h('span', { class: 'dt-label' }, label), h('div', { class: 'dt-range-row' }, input, output));
}

export interface PaneOptions {
  /** Start collapsed when true. */
  defaultCollapsed?: boolean;
  /** When false the pane cannot be collapsed and has no chevron. */
  collapsible?: boolean;
}

export function pane(
  title: string,
  body: Child,
  actions: Child[] = [],
  className = '',
  options: PaneOptions = {},
): HTMLElement {
  const collapsible = options.collapsible ?? true;
  let collapsed = collapsible && (options.defaultCollapsed ?? false);
  const chevron = h('span', { class: 'dt-pane-chevron' }, svgIcon('<path d="M6 9l6 6l6 -6"/>', 14));
  const titleNode = collapsible
    ? h(
        'button',
        { class: 'dt-pane-title-btn', type: 'button' },
        chevron,
        h('span', { class: 'dt-pane-title' }, title),
      )
    : h('div', { class: 'dt-pane-title-static' }, h('span', { class: 'dt-pane-title' }, title));
  const element = h(
    'div',
    { class: `dt-pane ${className} ${collapsed ? 'is-collapsed' : ''}` },
    h(
      'div',
      { class: 'dt-pane-head' },
      titleNode,
      actions.length ? h('div', { class: 'dt-pane-actions' }, ...actions) : null,
    ),
    // The padding lives on an inner wrapper so a collapsed pane shrinks to a true 0 height.
    h('div', { class: 'dt-pane-collapse' }, h('div', { class: 'dt-pane-body' }, h('div', { class: 'dt-pane-content' }, body))),
  );
  if (!collapsible) return element;
  titleNode.setAttribute('aria-expanded', String(!collapsed));
  titleNode.addEventListener('click', () => {
    collapsed = !collapsed;
    element.classList.toggle('is-collapsed', collapsed);
    titleNode.setAttribute('aria-expanded', String(!collapsed));
    titleNode.title = collapsed ? t('action.expand') : t('action.collapse');
  });
  titleNode.title = collapsed ? t('action.expand') : t('action.collapse');
  return element;
}

function makePaneStatic(pane: HTMLElement): void {
  const head = pane.querySelector<HTMLElement>(':scope > .dt-pane-head');
  const button = head?.querySelector<HTMLElement>(':scope > .dt-pane-title-btn');
  if (!head || !button) return;
  const title = button.querySelector('.dt-pane-title')?.textContent ?? '';
  pane.classList.remove('is-collapsed');
  head.replaceChild(h('div', { class: 'dt-pane-title-static' }, h('span', { class: 'dt-pane-title' }, title)), button);
}

/**
 * A page (or a tab) that shows one or two blocks gains nothing from collapsing them —
 * the content should always be visible — so their headers become plain static titles.
 * Call it after a tool/tab has rendered its DOM.
 */
export function normalizePaneCollapse(root: ParentNode): void {
  const scopes: ParentNode[] = [root, ...root.querySelectorAll<HTMLElement>('.dt-tab-content')];
  for (const scope of scopes) {
    const panes = [...scope.querySelectorAll<HTMLElement>('.dt-pane')];
    if (panes.length === 0 || panes.length > 2) continue;
    for (const pane of panes) makePaneStatic(pane);
  }
}

export interface KnobOptions {
  label: string;
  /** Inner SVG markup for the icon shown inside the knob. */
  icon: string;
  min: number;
  max: number;
  value: number;
  step?: number;
  defaultValue?: number;
  format?: (value: number) => string;
  oninput: (value: number) => void;
}

/** Circular slider with an icon, value readout and animated arc. */
export function knob(options: KnobOptions): HTMLElement {
  const { min, max } = options;
  const step = options.step ?? 1;
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75;
  let value = Math.min(max, Math.max(min, options.value));

  const wrap = h('div', { class: 'dt-knob', tabindex: 0, role: 'slider' });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 64 64');
  svg.setAttribute('class', 'dt-knob-svg');
  const track = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  track.setAttribute('class', 'dt-knob-track');
  track.setAttribute('cx', '32');
  track.setAttribute('cy', '32');
  track.setAttribute('r', String(radius));
  track.setAttribute('transform', 'rotate(135 32 32)');
  track.style.strokeDasharray = `${arcLength} ${circumference}`;
  const progress = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  progress.setAttribute('class', 'dt-knob-arc');
  progress.setAttribute('cx', '32');
  progress.setAttribute('cy', '32');
  progress.setAttribute('r', String(radius));
  progress.setAttribute('transform', 'rotate(135 32 32)');
  progress.style.strokeDasharray = `${arcLength} ${circumference}`;
  svg.append(track, progress);

  const iconWrap = h('span', { class: 'dt-knob-icon' }, svgIcon(options.icon, 16));
  const valueLabel = h('span', { class: 'dt-knob-value' });
  const label = h('span', { class: 'dt-knob-label' }, options.label);
  wrap.append(svg, iconWrap, valueLabel, label);

  const render = (): void => {
    const fraction = (value - min) / Math.max(1, max - min);
    progress.style.strokeDashoffset = String(arcLength * (1 - fraction));
    valueLabel.textContent = options.format ? options.format(value) : String(Math.round(value));
    wrap.setAttribute('aria-valuemin', String(min));
    wrap.setAttribute('aria-valuemax', String(max));
    wrap.setAttribute('aria-valuenow', String(Math.round(value)));
    wrap.classList.toggle('is-touched', Math.abs(value) > 0.0001);
  };

  const setValue = (next: number): void => {
    const stepped = Math.round(next / step) * step;
    const clamped = Math.min(max, Math.max(min, stepped));
    if (clamped === value) return;
    value = clamped;
    render();
    options.oninput(value);
  };

  let dragging = false;
  let startY = 0;
  let startValue = value;
  wrap.addEventListener('pointerdown', (event) => {
    dragging = true;
    startY = event.clientY;
    startValue = value;
    wrap.classList.add('is-active');
    wrap.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  wrap.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    setValue(startValue - (event.clientY - startY) * ((max - min) / 180));
  });
  const stop = (event: PointerEvent): void => {
    dragging = false;
    wrap.classList.remove('is-active');
    if (wrap.hasPointerCapture(event.pointerId)) wrap.releasePointerCapture(event.pointerId);
  };
  wrap.addEventListener('pointerup', stop);
  wrap.addEventListener('pointercancel', stop);
  wrap.addEventListener('dblclick', () => {
    const reset = options.defaultValue ?? (min <= 0 && max >= 0 ? 0 : min);
    setValue(reset);
  });
  wrap.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      setValue(value - Math.sign(event.deltaY) * step * 2);
    },
    { passive: false },
  );
  wrap.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
      event.preventDefault();
      setValue(value + step);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
      event.preventDefault();
      setValue(value - step);
    }
  });

  render();
  return wrap;
}

const knobIconMap: Array<[RegExp, string]> = [
  [/(opacity|прозрач|alpha)/i, '<path d="M12 3a9 9 0 1 0 0 18z"/><path d="M12 3a9 9 0 0 1 0 18"/>'],
  [/(rotation|поворот|rotate|angle|угол)/i, '<path d="M4 12a8 8 0 1 1 2.3 5.7"/><path d="M4 18v-6h6"/>'],
  [/(scale|масштаб|размер|size|font|шрифт)/i, '<path d="M4 20l6 -6"/><path d="M4 14v6h6"/><path d="M14 4h6v6"/><path d="M20 4l-6 6"/>'],
  [/(position x|позиция x|^x[ ,]|\bx\b)/i, '<path d="M3 12h18"/><path d="M7 8l-4 4l4 4"/><path d="M17 8l4 4l-4 4"/>'],
  [/(position y|позиция y|^y[ ,]|\by\b)/i, '<path d="M12 3v18"/><path d="M8 7l4 -4l4 4"/><path d="M8 17l4 4l4 -4"/>'],
  [/(depth|глубина|^z[ ,]|\bz\b)/i, '<path d="M4 8l8 -4l8 4v8l-8 4l-8 -4z"/><path d="M4 8l8 4l8 -4"/>'],
  [/(light|свет|exposure|экспозиц|bright|ярк)/i, '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>'],
  [/(metal|металл)/i, '<path d="M12 3l7 9l-7 9l-7 -9z"/><path d="M12 3v18"/>'],
  [/(rough|шерох|noise|зерн)/i, '<path d="M3 8c3 -3 6 3 9 0s6 3 9 0"/><path d="M3 16c3 -3 6 3 9 0s6 3 9 0"/>'],
  [/(width|толщин|stroke|линия|line)/i, '<path d="M4 20l16 -16"/><path d="M4 15v5h5"/>'],
  [/(quality|качество|corner|скругл|radius|радиус)/i, '<path d="M12 3l2 6l6 2l-6 2l-2 6l-2 -6l-6 -2l6 -2z"/>'],
  [/(gain|volume|громкост|усилен)/i, '<path d="M4 10v4h4l5 4v-12l-5 4z"/><path d="M16 9a4 4 0 0 1 0 6"/>'],
  [/(fade|затухан|плавн)/i, '<path d="M3 17c4 0 6 -10 9 -10s5 10 9 10"/>'],
  [/(cutoff|срез|resonance|резонанс|filter|фильтр)/i, '<path d="M4 5h16l-6 7v6l-4 2v-8z"/>'],
  [/(paragraph|абзац|sentence|предлож|word|слов|length|длина|count|количеств)/i, '<path d="M5 6h14M5 12h10M5 18h7"/>'],
];

function iconForLabel(label: string): string {
  for (const [pattern, icon] of knobIconMap) if (pattern.test(label)) return icon;
  return '<path d="M4 12h9"/><circle cx="17" cy="12" r="3"/>';
}

export interface KnobFieldOptions {
  icon?: string;
  step?: number;
  defaultValue?: number;
  format?: (value: number) => string;
}

/** A circular knob with an auto-picked icon, suitable for inspector grids. */
export function knobField(
  label: string,
  min: number,
  max: number,
  value: number,
  oninput: (value: number) => void,
  stepOrOptions: number | KnobFieldOptions = 1,
  maybeOptions: KnobFieldOptions = {},
): HTMLElement {
  const options = typeof stepOrOptions === 'number' ? maybeOptions : stepOrOptions;
  const step = typeof stepOrOptions === 'number' ? stepOrOptions : (options.step ?? 1);
  return knob({
    label,
    icon: options.icon ?? iconForLabel(label),
    min,
    max,
    value,
    step,
    defaultValue: options.defaultValue,
    format: options.format,
    oninput,
  });
}

export function knobGrid(...items: HTMLElement[]): HTMLElement {
  return h('div', { class: 'dt-knob-grid' }, ...items);
}

export interface ResizableSplitOptions {
  /** Left column share of the width (0..1). */
  ratio?: number;
  /** Smallest share the left column may take. */
  minRatio?: number;
  /** Largest share the left column may take. */
  maxRatio?: number;
  /** Width reserved for the right column in pixels. */
  minSide?: number;
  className?: string;
  title?: string;
  /** Called after every layout change (use it to resize canvases/renderers). */
  onResize?: () => void;
}

/**
 * Two columns with a drag handle between them. The divider is invisible until
 * hovered; the left column keeps a percentage share stored in `--dt-split-ratio`.
 */
export function resizableSplit(left: Child, right: Child, options: ResizableSplitOptions = {}): HTMLElement {
  const minRatio = options.minRatio ?? 0.3;
  const maxRatio = options.maxRatio ?? 0.85;
  const minSide = options.minSide ?? 300;
  let ratio = clamp(options.ratio ?? 0.72, minRatio, maxRatio);
  const handle = h('div', { class: 'dt-split-handle', role: 'separator', title: options.title ?? '' });
  const element = h(
    'div',
    { class: `dt-split dt-split-resizable ${options.className ?? ''}` },
    h('div', { class: 'dt-col' }, left),
    handle,
    h('div', { class: 'dt-col' }, right),
  );
  const apply = (next: number): void => {
    const width = element.clientWidth;
    // Before the first layout the width is 0, so keep the requested ratio.
    const limit = width > 40 ? Math.max(minRatio, Math.min(maxRatio, 1 - (minSide + 10) / width)) : maxRatio;
    ratio = clamp(next, minRatio, limit);
    element.style.setProperty('--dt-split-ratio', `${(ratio * 100).toFixed(2)}%`);
    element.style.setProperty('--dt-split-min-side', `${minSide}px`);
    options.onResize?.();
  };
  apply(ratio);
  handle.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    const bounds = element.getBoundingClientRect();
    handle.setPointerCapture(event.pointerId);
    handle.classList.add('is-active');
    const move = (moveEvent: PointerEvent): void => {
      if (!bounds.width) return;
      apply((moveEvent.clientX - bounds.left) / bounds.width);
    };
    const stop = (): void => {
      handle.classList.remove('is-active');
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', stop);
      handle.removeEventListener('pointercancel', stop);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', stop);
    handle.addEventListener('pointercancel', stop);
  });
  window.addEventListener('resize', () => {
    if (!element.isConnected) return;
    apply(ratio);
  });
  return element;
}

export function split(left: Child, right: Child, className = ''): HTMLElement {
  return h('div', { class: `dt-split ${className}` }, h('div', { class: 'dt-col' }, left), h('div', { class: 'dt-col' }, right));
}

export function note(text: string, kind: 'info' | 'warn' | 'error' | 'ok' = 'info'): HTMLElement {
  return h('div', { class: `dt-note dt-note-${kind}` }, text);
}

export function badge(text: string, tone: 'neutral' | 'ok' | 'warn' | 'bad' = 'neutral'): HTMLElement {
  return h('span', { class: `dt-badge dt-badge-${tone}` }, text);
}

export function stats(items: Array<[string, string | number]>): HTMLElement {
  return h(
    'div',
    { class: 'dt-stats' },
    ...items.map(([label, value]) =>
      h('div', { class: 'dt-stat' }, h('div', { class: 'dt-stat-value' }, String(value)), h('div', { class: 'dt-stat-label' }, label)),
    ),
  );
}

export function table(headers: string[], rows: Array<Array<string | Node>>, className = ''): HTMLElement {
  return h(
    'div',
    { class: `dt-table-wrap ${className}` },
    h(
      'table',
      { class: 'dt-table' },
      h('thead', {}, h('tr', {}, ...headers.map((header) => h('th', {}, header)))),
      h(
        'tbody',
        {},
        ...rows.map((cells) => h('tr', {}, ...cells.map((cell) => h('td', {}, cell)))),
      ),
    ),
  );
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const helper = document.createElement('textarea');
      helper.value = text;
      helper.style.position = 'fixed';
      helper.style.opacity = '0';
      document.body.appendChild(helper);
      helper.select();
      const ok = document.execCommand('copy');
      helper.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function copyBtn(getText: () => string | Promise<string>, label?: string): HTMLButtonElement {
  const button = btn(label ?? t('action.copy'), async () => {
    const success = await copyText(await getText());
    const labelElement = button.querySelector('.dt-btn-label');
    const original = labelElement?.textContent ?? '';
    if (labelElement) labelElement.textContent = success ? t('action.copied') : t('action.copyFailed');
    button.classList.toggle('is-ok', success);
    window.setTimeout(() => {
      if (labelElement) labelElement.textContent = original;
      button.classList.remove('is-ok');
    }, 1400);
  }, { variant: 'ghost', icon: '<path d="M8 8m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z"/><path d="M16 8v-2a2 2 0 0 0 -2 -2h-8a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h2"/>' });
  return button;
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadBtn(getData: () => Blob | string | Promise<Blob | string>, filename: string | (() => string), label?: string): HTMLButtonElement {
  return btn(label ?? t('action.download'), async () => {
    const data = await getData();
    const name = typeof filename === 'function' ? filename() : filename;
    downloadBlob(name, typeof data === 'string' ? new Blob([data], { type: 'text/plain;charset=utf-8' }) : data);
  }, { variant: 'ghost', icon: '<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2"/><path d="M7 11l5 5l5 -5"/><path d="M12 4l0 12"/>' });
}

export interface DropOptions {
  accept?: string;
  multiple?: boolean;
  hint?: string;
  onFiles: (files: File[]) => void;
}

export function fileDrop(options: DropOptions): HTMLElement {
  const input = h('input', { type: 'file', accept: options.accept ?? '', multiple: options.multiple ?? false, class: 'dt-hidden' });
  input.addEventListener('change', () => {
    const files = Array.from(input.files ?? []);
    if (files.length) options.onFiles(files);
    input.value = '';
  });
  const zone = h(
    'div',
    { class: 'dt-drop', tabindex: 0, role: 'button' },
    svgIcon('<path d="M12 15v-9"/><path d="M9 11l3 3l3 -3"/><path d="M4 17v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-1"/>', 22),
    h('span', { class: 'dt-drop-text' }, options.hint ?? t('label.dropHint')),
    input,
  );
  zone.addEventListener('click', () => input.click());
  zone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      input.click();
    }
  });
  zone.addEventListener('dragover', (event) => {
    event.preventDefault();
    zone.classList.add('is-drag');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('is-drag'));
  zone.addEventListener('drop', (event) => {
    event.preventDefault();
    zone.classList.remove('is-drag');
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length) options.onFiles(options.multiple ? files : files.slice(0, 1));
  });
  return zone;
}

export function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('read error'));
    reader.readAsText(file);
  });
}

export function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('read error'));
    reader.readAsDataURL(file);
  });
}

export function readArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error('read error'));
    reader.readAsArrayBuffer(file);
  });
}

export interface TabItem {
  id: string;
  label: string;
  render: () => Child;
}

export function tabs(items: TabItem[]): HTMLElement {
  const content = h('div', { class: 'dt-tab-content' });
  const buttons: HTMLButtonElement[] = [];
  const activate = (id: string) => {
    const item = items.find((candidate) => candidate.id === id) ?? items[0];
    for (const button of buttons) button.classList.toggle('is-active', button.dataset.tab === item.id);
    content.replaceChildren();
    const rendered = item.render();
    if (rendered instanceof Node) content.appendChild(rendered);
    else if (rendered !== null && rendered !== undefined && rendered !== false) content.appendChild(document.createTextNode(String(rendered)));
    normalizePaneCollapse(content);
  };
  const header = h(
    'div',
    { class: 'dt-tabs', role: 'tablist' },
    ...items.map((item) => {
      const button = h('button', { class: 'dt-tab', type: 'button', dataset: { tab: item.id }, role: 'tab' }, item.label);
      button.addEventListener('click', () => activate(item.id));
      buttons.push(button);
      return button;
    }),
  );
  activate(items[0]?.id ?? '');
  return h('div', { class: 'dt-tabs-wrap' }, header, content);
}

export interface ResultPaneOptions {
  rows?: number;
  filename?: string;
  extraActions?: Child[];
  className?: string;
}

export function resultPane(title: string, getValue: () => string, options: ResultPaneOptions = {}): { element: HTMLElement; area: HTMLTextAreaElement } {
  const output = area({ readOnly: true, rows: options.rows ?? 12 });
  const actions: Child[] = [copyBtn(() => getValue())];
  if (options.filename) actions.push(downloadBtn(() => getValue(), options.filename));
  if (options.extraActions) actions.push(...options.extraActions);
  const element = pane(title, output, actions, options.className);
  return { element, area: output };
}

export function errorSlot(): HTMLElement {
  return h('div', { class: 'dt-error-slot' });
}

export function setError(slot: HTMLElement, message: string | null): void {
  slot.replaceChildren();
  if (message) slot.appendChild(note(message, 'error'));
}
