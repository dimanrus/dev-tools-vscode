/** Reusable UI building blocks shared by all tools. */
import { h, svgIcon, type Child } from './dom.ts';
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
      { class: 'dt-segment', type: 'button', role: 'radio', title: option.title ?? option.label, dataset: { value: option.value } },
      option.label,
    );
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
  input.addEventListener('input', () => {
    output.textContent = input.value;
    oninput(Number(input.value));
  });
  return h('div', { class: 'dt-field' }, h('span', { class: 'dt-label' }, label), h('div', { class: 'dt-range-row' }, input, output));
}

export function pane(title: string, body: Child, actions: Child[] = [], className = ''): HTMLElement {
  return h(
    'div',
    { class: `dt-pane ${className}` },
    h(
      'div',
      { class: 'dt-pane-head' },
      h('span', { class: 'dt-pane-title' }, title),
      actions.length ? h('div', { class: 'dt-pane-actions' }, ...actions) : null,
    ),
    h('div', { class: 'dt-pane-body' }, body),
  );
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
