/** Activity bar launcher: a native tree of all tools that opens the main panel. */
import * as vscode from 'vscode';
import { CATALOG } from './catalog.ts';
import type { CatalogEntry, CatalogGroup } from './catalog.ts';

type Lang = 'en' | 'ru';

interface GroupDef {
  id: CatalogGroup;
  icon: string;
  en: string;
  ru: string;
}

const GROUPS: GroupDef[] = [
  { id: 'converters', icon: 'arrow-swap', en: 'Converters', ru: 'Конвертеры' },
  { id: 'text', icon: 'text-size', en: 'Text', ru: 'Текст' },
  { id: 'encoders', icon: 'key', en: 'Encoders / Decoders', ru: 'Кодирование / Декодирование' },
  { id: 'formatters', icon: 'code', en: 'Formatters', ru: 'Форматирование' },
  { id: 'generators', icon: 'wand', en: 'Generators', ru: 'Генераторы' },
  { id: 'graphic', icon: 'symbol-color', en: 'Graphic & Color', ru: 'Графика и цвет' },
  { id: 'testers', icon: 'beaker', en: 'Testers', ru: 'Тестирование' },
  { id: 'icons', icon: 'star', en: 'Icons', ru: 'Иконки' },
  { id: 'thirdparty', icon: 'extensions', en: 'Extras', ru: 'Дополнительно' },
];

type TreeNode =
  | { kind: 'open' }
  | { kind: 'group'; group: GroupDef; count: number }
  | { kind: 'tool'; tool: CatalogEntry };

function currentLang(): Lang {
  const configured = vscode.workspace.getConfiguration('devTools').get<string>('language', 'auto');
  if (configured === 'en' || configured === 'ru') return configured;
  return vscode.env.language.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

function pick(value: { en: string; ru: string }, lang: Lang): string {
  return lang === 'ru' ? value.ru : value.en;
}

export class DevToolsTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private readonly changed = new vscode.EventEmitter<void>();

  readonly onDidChangeTreeData = this.changed.event;

  refresh(): void {
    this.changed.fire();
  }

  getChildren(element?: TreeNode): TreeNode[] {
    if (!element) {
      return [
        { kind: 'open' },
        ...GROUPS.map((group) => ({
          kind: 'group' as const,
          group,
          count: CATALOG.filter((tool) => tool.group === group.id).length,
        })),
      ];
    }
    if (element.kind === 'group') {
      return CATALOG.filter((tool) => tool.group === element.group.id).map((tool) => ({ kind: 'tool' as const, tool }));
    }
    return [];
  }

  getTreeItem(node: TreeNode): vscode.TreeItem {
    const lang = currentLang();

    if (node.kind === 'open') {
      const item = new vscode.TreeItem(
        lang === 'ru' ? 'Открыть панель Dev Tools' : 'Open Dev Tools panel',
        vscode.TreeItemCollapsibleState.None,
      );
      item.iconPath = new vscode.ThemeIcon('open-preview');
      item.command = { command: 'devTools.open', title: 'Open Dev Tools' };
      item.contextValue = 'devToolsOpen';
      item.tooltip = lang === 'ru'
        ? new vscode.MarkdownString('Открыть широкую панель в редакторе (Ctrl+Alt+D).')
        : new vscode.MarkdownString('Open the wide editor panel (Ctrl+Alt+D).');
      return item;
    }

    if (node.kind === 'group') {
      const item = new vscode.TreeItem(pick(node.group, lang), vscode.TreeItemCollapsibleState.Collapsed);
      item.iconPath = new vscode.ThemeIcon(node.group.icon);
      item.description = String(node.count);
      item.contextValue = 'devToolsGroup';
      return item;
    }

    const { tool } = node;
    const item = new vscode.TreeItem(pick(tool.name, lang), vscode.TreeItemCollapsibleState.None);
    item.id = tool.id;
    item.contextValue = 'devTool';
    item.tooltip = new vscode.MarkdownString(`**${pick(tool.name, lang)}**\n\n${pick(tool.desc, lang)}\n\n\`${tool.id}\``);
    item.command = {
      command: 'devTools.openTool',
      title: lang === 'ru' ? 'Открыть' : 'Open',
      arguments: [tool.id],
    };
    return item;
  }
}
