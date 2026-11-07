/** Built-in icon browser (Tabler Icons, MIT License — https://tabler.io/icons). */
import { copyText, field, note, pane, select, textInput } from '../components.ts';
import { h } from '../dom.ts';
import { defineTool } from '../tool-types.ts';

interface IconDef {
  n: string;
  t: string;
  b: string;
}

const ICONS: IconDef[] = [
  { n: 'home', t: 'house building page', b: '<path d="M5 12l-2 0l9 -9l9 9l-2 0"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7"/><path d="M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6"/>' },
  { n: 'user', t: 'person account avatar', b: '<path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0"/><path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2"/>' },
  { n: 'users', t: 'group people team', b: '<path d="M9 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0"/><path d="M3 21v-2a4 4 0 0 1 4 -4h8a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' },
  { n: 'settings', t: 'gear cog preferences', b: '<path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z"/><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/>' },
  { n: 'bell', t: 'notification alert', b: '<path d="M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6"/><path d="M9 17v1a3 3 0 0 0 6 0v-1"/>' },
  { n: 'calendar', t: 'date schedule event', b: '<path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M4 11h16"/><path d="M8 15h2v2h-2z"/>' },
  { n: 'clock', t: 'time watch', b: '<path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/><path d="M12 7v5l3 3"/>' },
  { n: 'download', t: 'save import arrow', b: '<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2"/><path d="M7 11l5 5l5 -5"/><path d="M12 4l0 12"/>' },
  { n: 'upload', t: 'export arrow share', b: '<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2"/><path d="M7 9l5 -5l5 5"/><path d="M12 4l0 12"/>' },
  { n: 'cloud', t: 'weather storage', b: '<path d="M6.657 18c-2.572 0 -4.657 -2.007 -4.657 -4.483c0 -2.475 2.085 -4.482 4.657 -4.482c.393 -1.762 1.794 -3.2 3.675 -3.773c1.88 -.572 3.956 -.193 5.444 1c1.488 1.19 2.162 3.007 1.77 4.769h.99c1.913 0 3.464 1.56 3.464 3.486c0 1.927 -1.551 3.487 -3.465 3.487h-11.878"/>' },
  { n: 'database', t: 'sql storage data', b: '<path d="M12 3c4.97 0 9 1.34 9 3s-4.03 3 -9 3s-9 -1.34 -9 -3s4.03 -3 9 -3z"/><path d="M3 6v6c0 1.66 4.03 3 9 3s9 -1.34 9 -3v-6"/><path d="M3 12v6c0 1.66 4.03 3 9 3s9 -1.34 9 -3v-6"/>' },
  { n: 'server', t: 'host rack hardware', b: '<path d="M3 5a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1z"/><path d="M3 15a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1z"/><path d="M7 9h.01"/><path d="M7 17h.01"/>' },
  { n: 'cpu', t: 'chip processor hardware', b: '<path d="M5 5h14v14h-14z"/><path d="M9 9h6v6h-6z"/><path d="M9 1v4"/><path d="M15 1v4"/><path d="M9 19v4"/><path d="M15 19v4"/><path d="M1 9h4"/><path d="M1 15h4"/><path d="M19 9h4"/><path d="M19 15h4"/>' },
  { n: 'code', t: 'source programming develop', b: '<path d="M7 8l-4 4l4 4"/><path d="M17 8l4 4l-4 4"/><path d="M14 4l-4 16"/>' },
  { n: 'terminal', t: 'command shell console', b: '<path d="M5 7l5 5l-5 5"/><path d="M12 19l7 0"/>' },
  { n: 'git-branch', t: 'version control branch git', b: '<path d="M7 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M7 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M17 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M7 8l0 8"/><path d="M15 6h-6a2 2 0 0 0 -2 2v0"/><path d="M17 8v2a2 2 0 0 1 -2 2h-6"/>' },
  { n: 'bug', t: 'error issue insect', b: '<path d="M9 9v-1a3 3 0 0 1 6 0v1"/><path d="M8 9h8a6 6 0 0 1 1 3v3a5 5 0 0 1 -10 0v-3a6 6 0 0 1 1 -3"/><path d="M3 13h4"/><path d="M17 13h4"/><path d="M12 20l0 -6"/><path d="M4 19l3.35 -2"/><path d="M20 19l-3.35 -2"/><path d="M4 7l3.35 2"/><path d="M20 7l-3.35 2"/>' },
  { n: 'key', t: 'password access secure', b: '<path d="M16.555 3.843l3.602 3.602a2.877 2.877 0 0 1 0 4.069l-2.643 2.643a2.877 2.877 0 0 1 -4.069 0l-.301 -.301l-6.558 6.558a2 2 0 0 1 -1.239 .578l-.175 .008h-1.172a1 1 0 0 1 -.993 -.883l-.007 -.117v-1.172a2 2 0 0 1 .467 -1.284l.119 -.13l.414 -.414h2v-2h2v-2l2.144 -2.144l-.301 -.301a2.877 2.877 0 0 1 0 -4.069l2.643 -2.643a2.877 2.877 0 0 1 4.069 0z"/><path d="M15 9h.01"/>' },
  { n: 'lock', t: 'secure protected password', b: '<path d="M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2z"/><path d="M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0"/><path d="M8 11v-4a4 4 0 1 1 8 0v4"/>' },
  { n: 'unlock', t: 'open access', b: '<path d="M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2z"/><path d="M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0"/><path d="M8 11v-3a4 4 0 0 1 8 0"/>' },
  { n: 'shield', t: 'security protection safe', b: '<path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3"/>' },
  { n: 'fingerprint', t: 'biometric identity security', b: '<path d="M18.9 7a8 8 0 0 1 1.1 5v1a6 6 0 0 0 .8 3"/><path d="M8 11a4 4 0 0 1 8 0v1a10 10 0 0 0 2 6"/><path d="M12 11v2a14 14 0 0 0 2.5 8"/><path d="M8 15a18 18 0 0 0 1.8 6"/><path d="M4.9 19a22 22 0 0 1 -.9 -7v-1a8 8 0 0 1 12 -6.95"/>' },
  { n: 'mail', t: 'email message inbox', b: '<path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z"/><path d="M3 7l9 6l9 -6"/>' },
  { n: 'message', t: 'chat comment bubble', b: '<path d="M8 9h8"/><path d="M8 13h6"/><path d="M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12z"/>' },
  { n: 'phone', t: 'call contact mobile', b: '<path d="M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2"/>' },
  { n: 'camera', t: 'photo picture capture', b: '<path d="M5 7h1a2 2 0 0 0 2 -2a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2"/><path d="M12 13m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/>' },
  { n: 'photo', t: 'image picture gallery', b: '<path d="M15 8h.01"/><path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3z"/><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5"/><path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3"/>' },
  { n: 'file', t: 'document page', b: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z"/>' },
  { n: 'file-text', t: 'document text report', b: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z"/><path d="M9 9h1"/><path d="M9 13h6"/><path d="M9 17h6"/>' },
  { n: 'folder', t: 'directory group', b: '<path d="M5 4h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2"/>' },
  { n: 'archive', t: 'zip box storage', b: '<path d="M3 4m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z"/><path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-10"/><path d="M10 12l4 0"/>' },
  { n: 'trash', t: 'delete remove bin', b: '<path d="M4 7l16 0"/><path d="M10 11l0 6"/><path d="M14 11l0 6"/><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"/><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3"/>' },
  { n: 'edit', t: 'pencil write modify', b: '<path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1"/><path d="M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3l8.385 -8.415z"/>' },
  { n: 'copy', t: 'duplicate clone', b: '<path d="M8 8m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z"/><path d="M16 8v-2a2 2 0 0 0 -2 -2h-8a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h2"/>' },
  { n: 'clipboard', t: 'paste board copy', b: '<path d="M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2"/><path d="M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z"/>' },
  { n: 'search', t: 'find magnifier zoom', b: '<path d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0"/><path d="M21 21l-6 -6"/>' },
  { n: 'filter', t: 'funnel sort refine', b: '<path d="M4 4h16v2.172a2 2 0 0 1 -.586 1.414l-4.414 4.414v7l-6 2v-8.5l-4.48 -4.928a2 2 0 0 1 -.52 -1.345v-2.227z"/>' },
  { n: 'plus', t: 'add create new', b: '<path d="M12 5l0 14"/><path d="M5 12l14 0"/>' },
  { n: 'minus', t: 'remove subtract', b: '<path d="M5 12l14 0"/>' },
  { n: 'x', t: 'close cancel remove', b: '<path d="M18 6l-12 12"/><path d="M6 6l12 12"/>' },
  { n: 'check', t: 'done ok success', b: '<path d="M5 12l5 5l10 -10"/>' },
  { n: 'arrow-up', t: 'top direction', b: '<path d="M12 5l0 14"/><path d="M16 9l-4 -4l-4 4"/>' },
  { n: 'arrow-down', t: 'bottom direction', b: '<path d="M12 5l0 14"/><path d="M16 15l-4 4l-4 -4"/>' },
  { n: 'arrow-left', t: 'back direction', b: '<path d="M5 12l14 0"/><path d="M5 12l6 6"/><path d="M5 12l6 -6"/>' },
  { n: 'arrow-right', t: 'next direction', b: '<path d="M5 12l14 0"/><path d="M13 18l6 -6"/><path d="M13 6l6 6"/>' },
  { n: 'refresh', t: 'reload sync update', b: '<path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"/>' },
  { n: 'link', t: 'url chain hyperlink', b: '<path d="M10 14a3.5 3.5 0 0 0 5 0l3 -3a3.5 3.5 0 0 0 -5 -5l-1 1"/><path d="M14 10a3.5 3.5 0 0 0 -5 0l-3 3a3.5 3.5 0 0 0 5 5l1 -1"/>' },
  { n: 'external-link', t: 'open new window', b: '<path d="M12 6h-6a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-6"/><path d="M11 13l9 -9"/><path d="M15 4h5v5"/>' },
  { n: 'eye', t: 'view visible show', b: '<path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"/><path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6"/>' },
  { n: 'eye-off', t: 'hidden hide invisible', b: '<path d="M3 3l18 18"/><path d="M10.584 10.587a2 2 0 0 0 2.828 2.83"/><path d="M9.363 5.365a9.466 9.466 0 0 1 2.637 -.365c3.6 0 6.6 2 9 6c-.778 1.297 -1.635 2.407 -2.567 3.322m-2.795 1.55c-1.115 .477 -2.328 .728 -3.638 .728c-3.6 0 -6.6 -2 -9 -6c.86 -1.433 1.821 -2.632 2.879 -3.578"/><path d="M3 3l18 18"/>' },
  { n: 'heart', t: 'like favorite love', b: '<path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.566z"/>' },
  { n: 'star', t: 'favorite bookmark rate', b: '<path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z"/>' },
  { n: 'thumb-up', t: 'like approve', b: '<path d="M7 11v8a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1v-7a1 1 0 0 1 1 -1h3a4 4 0 0 0 4 -4v-1a2 2 0 0 1 4 0v5h3a2 2 0 0 1 2 2l-1 5a2 3 0 0 1 -2 2h-7a3 3 0 0 1 -3 -3"/>' },
  { n: 'flag', t: 'mark report milestone', b: '<path d="M5 5a5 5 0 0 1 7 0a5 5 0 0 0 7 0v9a5 5 0 0 1 -7 0a5 5 0 0 0 -7 0v-9z"/><path d="M5 21v-7"/>' },
  { n: 'bookmark', t: 'save favorite tag', b: '<path d="M18 7v14l-6 -4l-6 4v-14a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4z"/>' },
  { n: 'tag', t: 'label price meta', b: '<path d="M7.5 7.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M3 6v5.172a2 2 0 0 0 .586 1.414l7.71 7.71a2.41 2.41 0 0 0 3.408 0l5.592 -5.592a2.41 2.41 0 0 0 0 -3.408l-7.71 -7.71a2 2 0 0 0 -1.414 -.586h-5.172a3 3 0 0 0 -3 3z"/>' },
  { n: 'map-pin', t: 'location place marker', b: '<path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/><path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0z"/>' },
  { n: 'globe', t: 'world language internet', b: '<path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/><path d="M3.6 9h16.8"/><path d="M3.6 15h16.8"/><path d="M11.5 3a17 17 0 0 0 0 18"/><path d="M12.5 3a17 17 0 0 1 0 18"/>' },
  { n: 'sun', t: 'light theme day', b: '<path d="M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"/><path d="M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7"/>' },
  { n: 'moon', t: 'dark theme night', b: '<path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z"/>' },
  { n: 'palette', t: 'color design paint', b: '<path d="M12 21a9 9 0 0 1 0 -18c4.97 0 9 3.582 9 8c0 1.06 -.474 2.078 -1.318 2.828c-.844 .75 -1.989 1.172 -3.182 1.172h-2.5a2 2 0 0 0 -1 3.75a1.3 1.3 0 0 1 -1 2.25"/><path d="M7.5 10.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M11.5 7.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M15.5 10.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/>' },
  { n: 'brush', t: 'design paint draw', b: '<path d="M3 21v-4a4 4 0 1 1 4 4h-4"/><path d="M21 3a16 16 0 0 0 -12.8 10.2"/><path d="M21 3a16 16 0 0 1 -10.2 12.8"/><path d="M10.6 9a9 9 0 0 1 4.4 4.4"/>' },
  { n: 'device-desktop', t: 'monitor computer screen', b: '<path d="M3 5a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1z"/><path d="M7 20h10"/><path d="M9 16v4"/><path d="M15 16v4"/>' },
  { n: 'device-mobile', t: 'phone smartphone device', b: '<path d="M6 5a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z"/><path d="M11 4h2"/><path d="M12 17v.01"/>' },
  { n: 'wifi', t: 'network signal internet', b: '<path d="M12 18l.01 0"/><path d="M9.172 15.172a4 4 0 0 1 5.656 0"/><path d="M6.343 12.343a8 8 0 0 1 11.314 0"/><path d="M3.515 9.515c4.686 -4.687 12.284 -4.687 17 0"/>' },
  { n: 'bluetooth', t: 'wireless device', b: '<path d="M7 7l10 10l-5 5v-20l5 5l-10 10"/>' },
  { n: 'battery', t: 'power energy charge', b: '<path d="M6 7h11a2 2 0 0 1 2 2v.5a.5 .5 0 0 0 .5 .5a.5 .5 0 0 1 .5 .5v3a.5 .5 0 0 1 -.5 .5a.5 .5 0 0 0 -.5 .5v.5a2 2 0 0 1 -2 2h-11a2 2 0 0 1 -2 -2v-6a2 2 0 0 1 2 -2"/><path d="M9 10l0 4"/><path d="M13 10l0 4"/>' },
  { n: 'rocket', t: 'launch startup fast', b: '<path d="M4 13a8 8 0 0 1 7 7a6 6 0 0 0 3 -5a9 9 0 0 0 6 -8a3 3 0 0 0 -3 -3a9 9 0 0 0 -8 6a6 6 0 0 0 -5 3"/><path d="M7 14a6 6 0 0 0 -3 6a6 6 0 0 0 6 -3"/><path d="M14 9m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/>' },
  { n: 'sparkles', t: 'magic ai shine', b: '<path d="M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2z"/><path d="M16 6a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2z"/><path d="M9 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2z"/><path d="M9 6a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2z"/><path d="M3 12a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2z"/>' },
  { n: 'wand', t: 'magic auto fix', b: '<path d="M6 21l15 -15l-3 -3l-15 15l3 3"/><path d="M15 6l3 3"/><path d="M9 3a2 2 0 0 0 2 2a2 2 0 0 0 -2 2a2 2 0 0 0 -2 -2a2 2 0 0 0 2 -2"/><path d="M19 13a2 2 0 0 0 2 2a2 2 0 0 0 -2 2a2 2 0 0 0 -2 -2a2 2 0 0 0 2 -2"/>' },
  { n: 'package', t: 'box product shipping', b: '<path d="M12 3l8 4.5l0 9l-8 4.5l-8 -4.5l0 -9l8 -4.5"/><path d="M12 12l8 -4.5"/><path d="M12 12l0 9"/><path d="M12 12l-8 -4.5"/>' },
  { n: 'shopping-cart', t: 'buy store commerce', b: '<path d="M6 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M17 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M17 17h-11v-14h-2"/><path d="M6 5l14 1l-1 7h-13"/>' },
  { n: 'credit-card', t: 'payment money bank', b: '<path d="M3 5m0 3a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3z"/><path d="M3 10l18 0"/><path d="M7 15l.01 0"/><path d="M11 15l2 0"/>' },
  { n: 'coin', t: 'money currency finance', b: '<path d="M8 12a8 8 0 1 0 16 0a8 8 0 1 0 -16 0"/><path d="M13 8v8"/><path d="M16 11h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4h-4"/>' },
  { n: 'chart-bar', t: 'analytics statistics graph', b: '<path d="M3 20h18"/><path d="M7 16v-5"/><path d="M12 16v-9"/><path d="M17 16v-7"/>' },
  { n: 'chart-line', t: 'analytics graph trend', b: '<path d="M4 19l16 0"/><path d="M4 15l4 -6l4 2l4 -5l4 4"/>' },
  { n: 'chart-pie', t: 'analytics report diagram', b: '<path d="M10 3.2a9 9 0 1 0 10.8 10.8a1 1 0 0 0 -1 -1h-6a2 2 0 0 1 -2 -2v-6a.9 .9 0 0 0 -1 -1"/><path d="M15 3a9 9 0 0 1 6 6h-6a1 1 0 0 1 -1 -1v-5"/>' },
  { n: 'table', t: 'grid data spreadsheet', b: '<path d="M3 5a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1z"/><path d="M3 10h18"/><path d="M10 3v18"/>' },
  { n: 'list', t: 'items rows menu', b: '<path d="M9 6l11 0"/><path d="M9 12l11 0"/><path d="M9 18l11 0"/><path d="M5 6l0 .01"/><path d="M5 12l0 .01"/><path d="M5 18l0 .01"/>' },
  { n: 'layout-grid', t: 'apps dashboard tiles', b: '<path d="M4 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"/><path d="M14 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"/><path d="M4 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"/><path d="M14 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"/>' },
  { n: 'layout-sidebar', t: 'panel side navigation', b: '<path d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z"/><path d="M9 4v16"/>' },
  { n: 'menu', t: 'hamburger navigation', b: '<path d="M4 6l16 0"/><path d="M4 12l16 0"/><path d="M4 18l16 0"/>' },
  { n: 'dots-vertical', t: 'more options kebab', b: '<path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M12 19m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M12 5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/>' },
  { n: 'alert-triangle', t: 'warning danger error', b: '<path d="M12 9v4"/><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z"/><path d="M12 16h.01"/>' },
  { n: 'alert-circle', t: 'warning info error', b: '<path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/><path d="M12 8v4"/><path d="M12 16h.01"/>' },
  { n: 'info-circle', t: 'information help about', b: '<path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/><path d="M12 9h.01"/><path d="M11 12h1v4h1"/>' },
  { n: 'circle-check', t: 'success done ok', b: '<path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/><path d="M9 12l2 2l4 -4"/>' },
  { n: 'loader', t: 'spinner loading wait', b: '<path d="M12 6l0 -3"/><path d="M16.25 7.75l2.15 -2.15"/><path d="M18 12l3 0"/><path d="M16.25 16.25l2.15 2.15"/><path d="M12 18l0 3"/><path d="M7.75 16.25l-2.15 2.15"/><path d="M6 12l-3 0"/><path d="M7.75 7.75l-2.15 -2.15"/>' },
  { n: 'player-play', t: 'media video start', b: '<path d="M7 4v16l13 -8z"/>' },
  { n: 'volume', t: 'sound audio speaker', b: '<path d="M15 8a5 5 0 0 1 0 8"/><path d="M17.7 5a9 9 0 0 1 0 14"/><path d="M6 15h-2a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h2l3.5 -4.5a.8 .8 0 0 1 1.5 .5v14a.8 .8 0 0 1 -1.5 .5l-3.5 -4.5"/>' },
  { n: 'music', t: 'note audio song', b: '<path d="M8 17m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M17 15m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M17 15v-9l-9 3v8"/>' },
  { n: 'brand-github', t: 'git social code', b: '<path d="M9 19c-4.3 1.4 -4.3 -2.5 -6 -3m12 5v-3.5c0 -1 .1 -1.4 -.5 -2c2.8 -.3 5.5 -1.4 5.5 -6a4.6 4.6 0 0 0 -1.3 -3.2a4.2 4.2 0 0 0 -.1 -3.2s-1.1 -.3 -3.5 1.3a12.3 12.3 0 0 0 -6.2 0c-2.4 -1.6 -3.5 -1.3 -3.5 -1.3a4.2 4.2 0 0 0 -.1 3.2a4.6 4.6 0 0 0 -1.3 3.2c0 4.6 2.7 5.7 5.5 6c-.6 .6 -.6 1.2 -.5 2v3.5"/>' },
  { n: 'brand-npm', t: 'package node javascript', b: '<path d="M4 4h16v16h-16z"/><path d="M8 8v8"/><path d="M12 8v8h2"/><path d="M16 8v8"/>' },
  { n: 'brand-python', t: 'python language dev', b: '<path d="M12 4a3 3 0 0 0 -3 3v3h6v1h-6a3 3 0 0 0 -3 3v3a3 3 0 0 0 3 3h2v-3a3 3 0 0 1 3 -3h3a3 3 0 0 0 3 -3v-4a3 3 0 0 0 -3 -3z"/><path d="M9 7h.01"/><path d="M15 17h.01"/>' },
  { n: 'brand-docker', t: 'container devops', b: '<path d="M4 12h3v4h-3z"/><path d="M7 12h3v4h-3z"/><path d="M10 12h3v4h-3z"/><path d="M7 8h3v4h-3z"/><path d="M3 16a5 5 0 0 0 5 4h6a7 7 0 0 0 7 -7v-1h-3"/><path d="M17 12a4 4 0 0 0 3 -4"/>' },
];

function iconsTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'icons-browser',
    group: 'icons',
    icon: '<path d="M3 5h18v14h-18z"/><path d="M3 10h18"/><path d="M8 5v14"/>',
    name: { en: 'Icon Browser', ru: 'Браузер иконок' },
    desc: {
      en: 'Search the built-in Tabler-style icon set and copy ready-to-use SVG.',
      ru: 'Поиск по встроенному набору иконок в стиле Tabler и копирование готового SVG.',
    },
    keywords: 'icons tabler svg browse search copy',
    mount(root, ctx) {
      const search = textInput({ placeholder: ctx.pick('Search icons by name or tag…', 'Поиск иконок по имени или тегу…'), value: '' });
      const grid = h('div', { class: 'dt-icon-grid' });
      const status = h('div', { class: 'dt-icon-status' });
      const count = h('span', { class: 'dt-hint' });
      let size = 24;
      let stroke = 1.7;

      const sizeSelect = select(
        [
          { value: '16', label: '16 px' },
          { value: '20', label: '20 px' },
          { value: '24', label: '24 px' },
          { value: '32', label: '32 px' },
          { value: '48', label: '48 px' },
        ],
        '24',
        (value) => {
          size = Number(value);
          render();
        },
      );

      const sizeSelectControl = sizeSelect;
      const strokeSelect = select(
        [
          { value: '1', label: '1' },
          { value: '1.5', label: '1.5' },
          { value: '1.7', label: '1.7' },
          { value: '2', label: '2' },
        ],
        '1.7',
        (value) => {
          stroke = Number(value);
          render();
        },
      );

      const svgFor = (icon: IconDef, withSize: boolean): string =>
        `<svg xmlns="http://www.w3.org/2000/svg"${withSize ? ` width="${size}" height="${size}"` : ''} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${icon.b}</svg>`;

      const render = () => {
        const query = search.value.trim().toLowerCase();
        const matches = ICONS.filter((icon) => !query || icon.n.includes(query) || icon.t.includes(query));
        grid.replaceChildren(
          ...matches.map((icon) => {
            const item = h(
              'button',
              { class: 'dt-icon-cell', type: 'button', title: icon.n },
              h('span', { class: 'dt-icon-preview', html: svgFor(icon, true) }),
              h('span', { class: 'dt-icon-name' }, icon.n),
            );
            item.addEventListener('click', async () => {
              const ok = await copyText(svgFor(icon, false));
              status.textContent = ok ? `${ctx.pick('Copied', 'Скопировано')}: ${icon.n}.svg` : ctx.pick('Copy failed', 'Не удалось скопировать');
              window.setTimeout(() => {
                status.textContent = '';
              }, 1800);
            });
            return item;
          }),
        );
        if (!matches.length) grid.appendChild(note(ctx.pick('No icons match your search.', 'Иконки не найдены.'), 'warn'));
        count.textContent = `${matches.length} / ${ICONS.length}`;
      };

      search.addEventListener('input', render);
      render();

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          h('div', { class: 'dt-inline-form' }, field(ctx.pick('Search', 'Поиск'), search), field(ctx.pick('Size', 'Размер'), sizeSelectControl), field(ctx.pick('Stroke', 'Толщина'), strokeSelect), count),
          pane(ctx.pick('Icons', 'Иконки'), grid),
          status,
          note(ctx.pick('Icons from the Tabler Icons set (MIT). Click any icon to copy its SVG markup.', 'Иконки из набора Tabler Icons (MIT). Нажмите на иконку, чтобы скопировать SVG.'), 'info'),
        ),
      );
    },
  });
}

export const iconTools = [iconsTool()];
