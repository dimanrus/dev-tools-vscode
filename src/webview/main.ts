/** Webview entry point: shell, navigation, search and tool mounting. */
import { clear, h, svgIcon } from './dom.ts';
import { getLang, onLangChange, pick, setLang, t, type Lang } from './i18n.ts';
import { tools, groupOrder } from './tools/index.ts';
import type { GroupId, ToolContext, ToolDef } from './tool-types.ts';
import { rpc } from './rpc.ts';
import { vscode } from './vscode-api.ts';

interface WebviewState {
  tool?: string;
  lang?: Lang;
}

const saved = (vscode.getState<WebviewState>() ?? {}) as WebviewState;
const hostLang: Lang = document.documentElement.dataset.hostLang === 'ru' ? 'ru' : 'en';
setLang(saved.lang ?? hostLang);

const root = document.getElementById('app');
if (!root) throw new Error('#app container is missing');

const startupTool = document.documentElement.dataset.startupTool ?? '';
const iconUri = document.documentElement.dataset.iconUri ?? '';
let currentTool: ToolDef =
  tools.find((tool) => tool.id === saved.tool) ??
  tools.find((tool) => tool.id === startupTool) ??
  tools.find((tool) => tool.id === 'converters-json-yaml') ??
  tools[0];
let query = '';

const search = h('input', {
  class: 'dt-search-input',
  type: 'search',
  placeholder: t('search.placeholder'),
  spellcheck: false,
  autocomplete: 'off',
});
search.setAttribute('aria-label', t('search.placeholder'));

const countLabel = h('span', { class: 'dt-count' });
const nav = h('nav', { class: 'dt-nav' });
const main = h('main', { class: 'dt-main' });
const langButton = h('button', { class: 'dt-lang', type: 'button' });

const context: ToolContext = {
  t,
  pick,
  rpc,
  lang: getLang,
};

function persist(): void {
  vscode.setState({ tool: currentTool.id, lang: getLang() });
}

function matches(tool: ToolDef): boolean {
  if (!query) return true;
  const haystack = [
    tool.name.en,
    tool.name.ru,
    tool.desc.en,
    tool.desc.ru,
    tool.id,
    tool.keywords ?? '',
    tool.group,
  ]
    .join(' ')
    .toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

function renderNav(): void {
  clear(nav);
  const visible = tools.filter(matches);
  let rendered = 0;
  for (const group of groupOrder) {
    const groupTools = visible.filter((tool) => tool.group === group.id);
    if (!groupTools.length) continue;
    nav.appendChild(
      h(
        'div',
        { class: 'dt-nav-group' },
        h('div', { class: 'dt-nav-title' }, group.label(), h('span', { class: 'dt-nav-count' }, String(groupTools.length))),
        ...groupTools.map((tool) => {
          const item = h(
            'button',
            {
              class: `dt-nav-item ${tool.id === currentTool.id ? 'is-active' : ''}`,
              type: 'button',
              title: pick(tool.desc.en, tool.desc.ru),
              onclick: () => selectTool(tool),
            },
            svgIcon(tool.icon, 17),
            h('span', { class: 'dt-nav-label' }, pick(tool.name.en, tool.name.ru)),
          );
          return item;
        }),
      ),
    );
    rendered += groupTools.length;
  }
  if (!rendered) nav.appendChild(h('div', { class: 'dt-nav-empty' }, t('search.empty')));
  countLabel.textContent = t('nav.count', { n: query ? rendered : tools.length });
}

function renderTool(): void {
  clear(main);
  const header = h(
    'header',
    { class: 'dt-tool-head' },
    h('div', { class: 'dt-tool-badge' }, svgIcon(currentTool.icon, 26)),
    h(
      'div',
      { class: 'dt-tool-meta' },
      h('h2', { class: 'dt-tool-title' }, pick(currentTool.name.en, currentTool.name.ru)),
      h('p', { class: 'dt-tool-desc' }, pick(currentTool.desc.en, currentTool.desc.ru)),
    ),
  );
  const body = h('div', { class: 'dt-tool-body' });
  main.append(header, body);
  try {
    currentTool.mount(body, context);
  } catch (error) {
    body.appendChild(
      h(
        'div',
        { class: 'dt-note dt-note-error' },
        `${t('label.error')}: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
  }
  main.scrollTop = 0;
}

function renderAll(): void {
  langButton.textContent = getLang() === 'ru' ? 'EN' : 'RU';
  langButton.title = t('lang.switch');
  search.placeholder = t('search.placeholder');
  renderNav();
  renderTool();
}

function selectTool(tool: ToolDef): void {
  if (tool.id === currentTool.id) return;
  currentTool = tool;
  persist();
  renderNav();
  renderTool();
  if (window.location.hash !== `#${tool.id}`) {
    history.replaceState(null, '', `#${tool.id}`);
  }
}

langButton.addEventListener('click', () => {
  setLang(getLang() === 'ru' ? 'en' : 'ru');
  persist();
});

search.addEventListener('input', () => {
  query = search.value;
  renderNav();
});

search.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    search.value = '';
    query = '';
    renderNav();
    search.blur();
  }
  if (event.key === 'Enter') {
    const first = tools.filter(matches)[0];
    if (first) selectTool(first);
  }
});

document.addEventListener('keydown', (event) => {
  const isSearchShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
  if (isSearchShortcut) {
    event.preventDefault();
    search.focus();
    search.select();
  }
});

onLangChange(renderAll);

root.replaceChildren(
  h(
    'div',
    { class: 'dt-shell' },
    h(
      'header',
      { class: 'dt-topbar' },
      h(
        'div',
        { class: 'dt-brand' },
        h(
          'div',
          { class: 'dt-logo' },
          iconUri
            ? h('img', { class: 'dt-logo-img', src: iconUri, alt: '' })
            : svgIcon('<path d="M4 5h4l2 3h4l2 -3h4" /><path d="M4 5v14h16v-14" /><path d="M9 13h6" /><path d="M9 16h4" />', 20),
        ),
        h(
          'div',
          { class: 'dt-brand-text' },
          h('div', { class: 'dt-brand-title' }, 'Dev Tools'),
          h('div', { class: 'dt-brand-sub' }, t('app.tagline')),
        ),
      ),
      h('div', { class: 'dt-search' }, svgIcon('<path d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" />', 16), search),
      langButton,
    ),
    h(
      'div',
      { class: 'dt-body' },
      h('aside', { class: 'dt-sidebar' }, nav, h('div', { class: 'dt-sidebar-foot' }, countLabel)),
      main,
    ),
  ),
);

renderAll();

const hashTool = window.location.hash.replace('#', '');
if (hashTool) {
  const found = tools.find((tool) => tool.id === hashTool);
  if (found && found.id !== currentTool.id) selectTool(found);
}

window.addEventListener('message', (event: MessageEvent) => {
  const message = event.data as { type?: string; tool?: string; lang?: Lang };
  if (message?.type === 'open-tool' && message.tool) {
    const found = tools.find((tool) => tool.id === message.tool);
    if (found) selectTool(found);
  }
  if (message?.type === 'host-lang' && (message.lang === 'en' || message.lang === 'ru')) {
    setLang(message.lang);
    persist();
  }
});

export type { GroupId };
