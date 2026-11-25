/** Webview entry point: shell, navigation, search and tool mounting. */
import { normalizePaneCollapse } from './components.ts';
import { clear, h, svgIcon } from './dom.ts';
import { getLang, onLangChange, pick, setLang, t, type Lang } from './i18n.ts';
import { tools, groupOrder } from './tools/index.ts';
import type { GroupId, IncomingFile, ToolContext, ToolDef } from './tool-types.ts';
import { rpc } from './rpc.ts';
import { LICENSE_ENTRIES } from './licenses-data.ts';
import { vscode } from './vscode-api.ts';

interface WebviewState {
  tool?: string;
  lang?: Lang;
  theme?: 'light' | 'dark';
  navHidden?: boolean;
}

const saved = (vscode.getState<WebviewState>() ?? {}) as WebviewState;
const hostLang: Lang = document.documentElement.dataset.hostLang === 'ru' ? 'ru' : 'en';
setLang(saved.lang ?? hostLang);

function detectTheme(): 'light' | 'dark' {
  if (document.body.classList.contains('vscode-light')) return 'light';
  if (document.body.classList.contains('vscode-dark')) return 'dark';
  const color = getComputedStyle(document.body).backgroundColor || '';
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    const [r, g, b] = [Number(match[1]), Number(match[2]), Number(match[3])];
    return (r * 299 + g * 587 + b * 114) / 1000 > 140 ? 'light' : 'dark';
  }
  return 'dark';
}

let theme: 'light' | 'dark' = saved.theme ?? detectTheme();
document.documentElement.dataset.theme = theme;

const root = document.getElementById('app');
if (!root) throw new Error('#app container is missing');

const startupTool = document.documentElement.dataset.startupTool ?? '';
const iconUri = document.documentElement.dataset.iconUri ?? '';
let currentTool: ToolDef =
  tools.find((tool) => tool.id === saved.tool) ??
  tools.find((tool) => tool.id === startupTool) ??
  tools.find((tool) => tool.id === 'converters-json-yaml') ??
  tools[0];
let view: 'home' | 'tool' | 'licenses' = 'home';
let query = '';
let incomingFile: IncomingFile | null = null;

const search = h('input', {
  class: 'dt-search-input',
  type: 'search',
  placeholder: t('search.placeholder'),
  spellcheck: false,
  autocomplete: 'off',
});
search.setAttribute('aria-label', t('search.placeholder'));

const nav = h('nav', { class: 'dt-nav' });
const main = h('main', { class: 'dt-main' });
const langButton = h('button', { class: 'dt-lang', type: 'button' });
const houseIcon =
  '<path d="M5 12l-2 0l9 -9l9 9l-2 0"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7"/><path d="M10 21v-6a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v6"/>';
const sunIcon =
  '<path d="M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"/><path d="M3 12h1"/><path d="M20 12h1"/><path d="M12 3v1"/><path d="M12 20v1"/><path d="M5.6 5.6l.7 .7"/><path d="M17.7 17.7l.7 .7"/><path d="M18.4 5.6l-.7 .7"/><path d="M6.3 17.7l-.7 .7"/>';
const moonIcon = '<path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z"/>';
const menuIcon = '<path d="M4 6l16 0"/><path d="M4 12l16 0"/><path d="M4 18l16 0"/>';
const licenseIcon =
  '<path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/><path d="M12 8h.01"/><path d="M11 12h1v4h1"/>';
const repoIcon = '<path d="M9 19c-4.3 1.4 -4.3 -2.5 -6 -3m12 5v-3.5c0 -1 .1 -1.4 -.5 -2c2.8 -.3 5.5 -1.4 5.5 -6a4.6 4.6 0 0 0 -1.3 -3.2a4.2 4.2 0 0 0 -.1 -3.2s-1.1 -.3 -3.5 1.3a12.3 12.3 0 0 0 -6.2 0c-2.4 -1.6 -3.5 -1.3 -3.5 -1.3a4.2 4.2 0 0 0 -.1 3.2a4.6 4.6 0 0 0 -1.3 3.2c0 4.6 2.7 5.7 5.5 6c-.6 .6 -.6 1.2 -.5 2v3.5"/>';
const navButton = h(
  'button',
  { class: 'dt-icon-btn', type: 'button', onclick: () => toggleNav() },
  svgIcon(menuIcon, 17),
);
const homeButton = h(
  'button',
  { class: 'dt-icon-btn', type: 'button', onclick: () => showHome() },
  svgIcon(houseIcon, 17),
);
const themeButton = h(
  'button',
  { class: 'dt-icon-btn', type: 'button', onclick: () => toggleTheme() },
  svgIcon(sunIcon, 17),
);
const licensesButton = h(
  'button',
  { class: 'dt-icon-btn', type: 'button', onclick: () => openLicenses() },
  svgIcon(licenseIcon, 17),
);
const shell = h('div', { class: 'dt-shell' });

const context: ToolContext = {
  t,
  pick,
  rpc,
  lang: getLang,
  takeIncoming: () => {
    const file = incomingFile;
    incomingFile = null;
    return file;
  },
};

function persist(): void {
  vscode.setState({ tool: currentTool.id, lang: getLang(), theme, navHidden });
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

function renderNav(preserveScroll = true): void {
  const previousTop = nav.scrollTop;
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
              dataset: { tool: tool.id },
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
  nav.scrollTop = preserveScroll ? previousTop : 0;
}

let navHidden = saved.navHidden ?? true;

function updateNavVisibility(): void {
  shell.classList.toggle('is-nav-hidden', navHidden);
  navButton.title = navHidden
    ? pick('Show the tool list', 'Показать список инструментов')
    : pick('Hide the tool list', 'Скрыть список инструментов');
  navButton.setAttribute('aria-expanded', String(!navHidden));
}

function toggleNav(): void {
  navHidden = !navHidden;
  updateNavVisibility();
  persist();
}

function updateThemeButton(): void {
  document.documentElement.dataset.theme = theme;
  themeButton.replaceChildren(svgIcon(theme === 'light' ? moonIcon : sunIcon, 17));
  themeButton.title =
    theme === 'light' ? pick('Switch to the dark theme', 'Тёмная тема') : pick('Switch to the light theme', 'Светлая тема');
  themeButton.setAttribute('aria-pressed', String(theme === 'light'));
}

function toggleTheme(): void {
  theme = theme === 'light' ? 'dark' : 'light';
  updateThemeButton();
  persist();
}

function showHome(): void {
  view = 'home';
  renderMain();
  if (window.location.hash) history.replaceState(null, '', window.location.pathname + window.location.search);
}

function renderHome(): void {
  clear(main);
  const visible = tools.filter(matches);
  main.append(
    h(
      'header',
      { class: 'dt-home-head' },
      h('h2', { class: 'dt-home-title' }, pick('All tools', 'Все инструменты')),
      h(
        'p',
        { class: 'dt-home-sub' },
        pick(
          'Pick a tool below. Press Ctrl+K to search by name, description or keyword.',
          'Выберите инструмент. Ctrl+K — поиск по названию, описанию или ключевым словам.',
        ),
      ),
      h('span', { class: 'dt-home-count' }, t('nav.count', { n: visible.length })),
    ),
  );
  for (const group of groupOrder) {
    const groupTools = visible.filter((tool) => tool.group === group.id);
    if (!groupTools.length) continue;
    main.append(
      h(
        'section',
        { class: 'dt-home-group' },
        h(
          'h3',
          { class: 'dt-home-group-title' },
          group.label(),
          h('span', { class: 'dt-home-count' }, String(groupTools.length)),
        ),
        h(
          'div',
          { class: 'dt-home-grid' },
          ...groupTools.map((tool) =>
            h(
              'button',
              {
                class: 'dt-home-card',
                type: 'button',
                title: pick(tool.desc.en, tool.desc.ru),
                onclick: () => selectTool(tool),
              },
              h('span', { class: 'dt-home-icon' }, svgIcon(tool.icon, 22)),
              h('span', { class: 'dt-home-name' }, pick(tool.name.en, tool.name.ru)),
              h('span', { class: 'dt-home-desc' }, pick(tool.desc.en, tool.desc.ru)),
            ),
          ),
        ),
      ),
    );
  }
  if (!visible.length) main.append(h('div', { class: 'dt-note' }, t('search.empty')));
  main.append(
    h(
      'footer',
      { class: 'dt-home-foot' },
      h(
        'button',
        {
          class: 'dt-home-license',
          type: 'button',
          onclick: () => openLicenses(),
        },
        svgIcon(licenseIcon, 15),
        h('span', {}, pick('Third-party licenses', 'Лицензии сторонних библиотек')),
        h('span', { class: 'dt-home-license-tag' }, 'MIT · LGPL-3.0'),
      ),
    ),
  );
  main.scrollTop = 0;
}

function repoLabel(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/#.*$/, '').replace(/\/$/, '');
}

async function openExternalUrl(url: string): Promise<void> {
  try {
    await rpc('openExternal', { url });
  } catch {
    window.open(url, '_blank', 'noopener');
  }
}

function renderLicenses(): void {
  clear(main);
  const filter = h('input', {
    class: 'dt-input dt-license-filter',
    type: 'search',
    placeholder: pick('Filter by library or license', 'Фильтр по библиотеке или лицензии'),
    spellcheck: false,
  });
  filter.setAttribute('aria-label', filter.placeholder);
  const count = h('span', { class: 'dt-license-count' });
  const list = h('div', { class: 'dt-license-list' });

  const draw = (): void => {
    const needle = filter.value.trim().toLowerCase();
    const items = LICENSE_ENTRIES.filter((entry) =>
      !needle || [entry.name, entry.license, entry.purpose.en, entry.purpose.ru].join(' ').toLowerCase().includes(needle),
    );
    count.textContent = String(items.length);
    list.replaceChildren(
      ...items.map((entry) =>
        h(
          'article',
          { class: 'dt-license-card' },
          h(
            'div',
            { class: 'dt-license-head' },
            h(
              'div',
              { class: 'dt-license-title' },
              h('span', { class: 'dt-license-name' }, entry.name),
              h('span', { class: 'dt-license-version' }, `v${entry.version}`),
              h('span', { class: 'dt-license-kind' }, entry.license),
            ),
            h(
              'button',
              {
                class: 'dt-license-link',
                type: 'button',
                title: `${pick('Open the repository', 'Открыть репозиторий')}: ${entry.repo}`,
                onclick: () => void openExternalUrl(entry.repo),
              },
              svgIcon(repoIcon, 14),
              h('span', {}, repoLabel(entry.repo)),
            ),
          ),
          h('p', { class: 'dt-license-purpose' }, pick(entry.purpose.en, entry.purpose.ru)),
          h(
            'details',
            { class: 'dt-license-details' },
            h('summary', {}, pick('License text', 'Текст лицензии')),
            h('pre', { class: 'dt-license-text' }, entry.text),
          ),
        ),
      ),
    );
  };
  filter.addEventListener('input', draw);
  draw();

  main.append(
    h(
      'header',
      { class: 'dt-lic-head' },
      h('h2', { class: 'dt-home-title' }, pick('Third-party licenses', 'Лицензии сторонних библиотек')),
      h(
        'p',
        { class: 'dt-home-sub' },
        pick(
          'Dev Tools is built on the work of many open-source authors. Thank you to everyone who designs, maintains and documents these libraries — your effort makes tools like this possible.',
          'Dev Tools построен на труде авторов открытого ПО. Спасибо всем, кто проектирует, поддерживает и документирует эти библиотеки — ваша работа делает такие инструменты возможными.',
        ),
      ),
      h(
        'div',
        { class: 'dt-license-toolbar' },
        filter,
        h('span', { class: 'dt-license-total' }, pick('Libraries', 'Библиотек'), count),
      ),
    ),
    list,
    h(
      'p',
      { class: 'dt-license-foot' },
      pick(
        'Dev Tools itself is distributed under the MIT license. The same notices ship as THIRD_PARTY_NOTICES.md.',
        'Сам Dev Tools распространяется по лицензии MIT. Те же уведомления поставляются в файле THIRD_PARTY_NOTICES.md.',
      ),
    ),
  );
  main.scrollTop = 0;
}

function openLicenses(): void {
  view = 'licenses';
  renderMain();
  if (window.location.hash !== '#licenses') history.replaceState(null, '', '#licenses');
}

function renderMain(): void {
  syncNavActive();
  main.classList.remove('dt-main-fill');
  if (view === 'home') {
    renderHome();
    return;
  }
  if (view === 'licenses') {
    renderLicenses();
    return;
  }
  renderTool();
  revealActiveNavItem();
}

/** Highlights the active tool without rebuilding the list (keeps the sidebar scroll position). */
function syncNavActive(): void {
  for (const item of Array.from(nav.querySelectorAll<HTMLElement>('.dt-nav-item'))) {
    const active = view === 'tool' && item.dataset.tool === currentTool.id;
    item.classList.toggle('is-active', active);
    if (active) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  }
}

/** Scrolls the sidebar just enough to show the active tool. */
function revealActiveNavItem(): void {
  const active = nav.querySelector<HTMLElement>('.dt-nav-item.is-active');
  if (!active) return;
  const navRect = nav.getBoundingClientRect();
  const itemRect = active.getBoundingClientRect();
  if (itemRect.top < navRect.top) nav.scrollTop -= navRect.top - itemRect.top + 8;
  else if (itemRect.bottom > navRect.bottom) nav.scrollTop += itemRect.bottom - navRect.bottom + 8;
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
  // File pickers are hoisted into the tool header: they save a whole block of vertical space.
  const drops = [...body.querySelectorAll<HTMLElement>('.dt-drop')];
  if (drops.length) {
    const headerActions = h('div', { class: 'dt-tool-actions' });
    for (const drop of drops) headerActions.appendChild(drop);
    header.appendChild(headerActions);
  }
  normalizePaneCollapse(body);
  main.classList.toggle('dt-main-fill', shouldFillHeight(currentTool, body));
  main.scrollTop = 0;
}

/**
 * Two side-by-side editors and nothing else are the same layout everywhere,
 * so those tools stretch to the panel height without opting in per tool.
 */
function shouldFillHeight(tool: ToolDef, body: HTMLElement): boolean {
  if (tool.fill !== undefined) return tool.fill;
  const panes = [...body.querySelectorAll<HTMLElement>('.dt-pane')];
  if (panes.length !== 2 || !body.querySelector('.dt-area')) return false;
  // Resizable / custom editor splits manage their own sizing.
  if (body.querySelector('.dt-split-resizable')) return false;
  const container = (pane: HTMLElement): Element | null => pane.closest('.dt-split, .dt-md-panes');
  const shared = container(panes[0]);
  return Boolean(shared) && shared === container(panes[1]);
}

function renderAll(): void {
  langButton.textContent = getLang() === 'ru' ? 'EN' : 'RU';
  langButton.title = t('lang.switch');
  search.placeholder = t('search.placeholder');
  homeButton.title = pick('Home: all tools', 'Главная: все инструменты');
  licensesButton.title = pick('Third-party licenses', 'Лицензии сторонних библиотек');
  licensesButton.setAttribute('aria-label', licensesButton.title);
  themeButton.setAttribute('aria-label', themeButton.title);
  updateNavVisibility();
  updateThemeButton();
  renderNav();
  renderMain();
}

function selectTool(tool: ToolDef): void {
  if (tool.id === currentTool.id && view === 'tool') return;
  currentTool = tool;
  view = 'tool';
  persist();
  renderMain();
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
  renderNav(false);
  if (view === 'home') renderHome();
});

search.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    search.value = '';
    query = '';
    renderNav(false);
    if (view === 'home') renderHome();
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

root.replaceChildren(shell);
shell.append(
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
    navButton,
    h('div', { class: 'dt-search' }, svgIcon('<path d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" />', 16), search),
    h('div', { class: 'dt-topbar-actions' }, homeButton, themeButton, langButton, licensesButton),
  ),
  h('div', { class: 'dt-body' }, h('aside', { class: 'dt-sidebar' }, nav), main),
);

renderAll();

// Deep links and context-menu navigation open the tool, everything else starts on the home page.
const hashTool = window.location.hash.replace('#', '');
const wantedTool = hashTool || startupTool;
if (wantedTool === 'licenses') {
  openLicenses();
} else if (wantedTool) {
  const found = tools.find((tool) => tool.id === wantedTool);
  if (found) selectTool(found);
  else showHome();
} else {
  showHome();
}

window.addEventListener('message', (event: MessageEvent) => {
  const message = event.data as {
    type?: string;
    tool?: string;
    lang?: Lang;
    file?: IncomingFile;
  };
  if (message?.type === 'open-tool' && message.tool) {
    if (message.tool === 'licenses') {
      openLicenses();
      return;
    }
    const found = tools.find((tool) => tool.id === message.tool);
    if (found) selectTool(found);
  }
  if (message?.type === 'open-file' && message.tool && message.file) {
    incomingFile = message.file;
    const found = tools.find((tool) => tool.id === message.tool);
    if (found) {
      if (found.id === currentTool.id) {
        persist();
        renderTool();
      } else {
        selectTool(found);
      }
    }
  }
  if (message?.type === 'host-lang' && (message.lang === 'en' || message.lang === 'ru')) {
    setLang(message.lang);
    persist();
  }
});

vscode.postMessage({ type: 'ready' });

export type { GroupId };
