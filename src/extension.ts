import * as vscode from 'vscode';
import { DevToolsPanel } from './panel.ts';
import { DevToolsTreeProvider } from './sidebar.ts';

export function activate(context: vscode.ExtensionContext): void {
  const tree = new DevToolsTreeProvider();

  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.name = 'Dev Tools';
  statusBar.text = '$(tools) Dev Tools';
  statusBar.tooltip = vscode.l10n.t('Open Dev Tools');
  statusBar.command = 'devTools.open';

  const syncStatusBar = (): void => {
    const visible = vscode.workspace.getConfiguration('devTools').get<boolean>('showStatusBar', true);
    if (visible) statusBar.show();
    else statusBar.hide();
  };
  syncStatusBar();

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('devTools.launcher', tree),
    statusBar,
    vscode.commands.registerCommand('devTools.open', async () => {
      await DevToolsPanel.show(context);
    }),
    vscode.commands.registerCommand('devTools.openTool', async (toolId?: string) => {
      await DevToolsPanel.show(context, typeof toolId === 'string' ? toolId : undefined);
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('devTools.showStatusBar')) syncStatusBar();
      if (event.affectsConfiguration('devTools.language')) tree.refresh();
    }),
  );
}

export function deactivate(): void {
  /* nothing to clean up: the panel disposes itself */
}
