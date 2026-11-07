/** Tiny hyperscript-like DOM builder used by every tool. */

export type Child = Node | string | number | null | undefined | false;

const propAliases: Record<string, string> = {
  for: 'htmlFor',
  readonly: 'readOnly',
  maxlength: 'maxLength',
  tabindex: 'tabIndex',
  colspan: 'colSpan',
  rowspan: 'rowSpan',
};

export function append(parent: Node, children: Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (child instanceof Node) parent.appendChild(child);
    else parent.appendChild(document.createTextNode(String(child)));
  }
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Record<string, unknown> | null, ...children: Child[]): HTMLElementTagNameMap[K];
export function h(tag: string, attrs?: Record<string, unknown> | null, ...children: Child[]): HTMLElement;
export function h(tag: string, attrs: Record<string, unknown> | null = null, ...children: Child[]): HTMLElement {
  const el = document.createElement(tag);
  if (attrs) {
    for (const key of Object.keys(attrs)) {
      const value = attrs[key];
      if (value === null || value === undefined || value === false) continue;
      if (key === 'class') el.className = String(value);
      else if (key === 'text') el.textContent = String(value);
      else if (key === 'html') el.innerHTML = String(value);
      else if (key === 'style') {
        if (typeof value === 'string') el.setAttribute('style', value);
        else Object.assign(el.style, value as Partial<CSSStyleDeclaration>);
      } else if (key === 'dataset') Object.assign(el.dataset, value as Record<string, string>);
      else if (key.startsWith('on') && typeof value === 'function') {
        el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
      } else {
        const prop = propAliases[key] ?? key;
        if (prop in el) (el as unknown as Record<string, unknown>)[prop] = value;
        else el.setAttribute(key, value === true ? '' : String(value));
      }
    }
  }
  append(el, children);
  return el;
}

/** Renders an inline 24x24 stroke icon (Tabler-style path markup). */
export function svgIcon(inner: string, size = 18): HTMLElement {
  const wrap = document.createElement('span');
  wrap.className = 'dt-icon';
  wrap.innerHTML =
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" ` +
    `stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  return wrap;
}

export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function debounce<T extends (...args: never[]) => void>(fn: T, ms = 120): T {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return ((...args: never[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

export function formatBytes(bytes: number, digits = 1): string {
  if (!Number.isFinite(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(digits)} ${units[unit]}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
