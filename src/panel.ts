/** The single webview panel that hosts the whole Dev Tools UI. */
import { randomBytes } from 'node:crypto';
import * as vscode from 'vscode';
import { handleRpc } from './rpc.ts';

interface RpcMessage {
  type?: string;
  id?: number;
  method?: string;
  params?: unknown;
}

let cachedTemplate: string | undefined;

async function loadTemplate(context: vscode.ExtensionContext): Promise<string> {
  if (cachedTemplate) return cachedTemplate;
  const uri = vscode.Uri.joinPath(context.extensionUri, 'media', 'index.html');
  cachedTemplate = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
  return cachedTemplate;
}

function resolveLanguage(): 'en' | 'ru' {
  const configured = vscode.workspace.getConfiguration('devTools').get<string>('language', 'auto');
  if (configured === 'en' || configured === 'ru') return configured;
  return vscode.env.language.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

function createNonce(): string {
  return randomBytes(16).toString('base64url');
}

export class DevToolsPanel {
  private static current: DevToolsPanel | undefined;

  static get instance(): DevToolsPanel | undefined {
    return DevToolsPanel.current;
  }

  static async show(context: vscode.ExtensionContext, toolId?: string): Promise<void> {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;
    if (DevToolsPanel.current) {
      DevToolsPanel.current.panel.reveal(column);
      if (toolId) void DevToolsPanel.current.panel.webview.postMessage({ type: 'open-tool', tool: toolId });
      return;
    }

    const panel = vscode.window.createWebviewPanel('devTools', vscode.l10n.t('Dev Tools'), column, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, 'media'),
        vscode.Uri.joinPath(context.extensionUri, 'dist'),
      ],
    });
    panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'icon.png');

    const instance = new DevToolsPanel(panel, context);
    DevToolsPanel.current = instance;
    await instance.render(toolId);
  }

  private readonly panel: vscode.WebviewPanel;
  private readonly context: vscode.ExtensionContext;

  private constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
    this.panel = panel;
    this.context = context;
    this.panel.onDidDispose(() => this.dispose(), null, []);
    this.panel.webview.onDidReceiveMessage((message: RpcMessage) => void this.onMessage(message), null, []);

    const configurationSubscription = vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('devTools.language')) {
        void this.panel.webview.postMessage({ type: 'host-lang', lang: resolveLanguage() });
      }
    });
    this.panel.onDidDispose(() => configurationSubscription.dispose(), null, []);
  }

  private async render(initialTool?: string): Promise<void> {
    const webview = this.panel.webview;
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'devtools.css'));
    const iconUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'icon.png'));
    const template = await loadTemplate(this.context);
    const nonce = createNonce();
    const configuredStartup = vscode.workspace.getConfiguration('devTools').get<string>('startupTool', '') ?? '';
    const candidate = initialTool ?? configuredStartup;
    const startupTool = /^[a-z0-9-]{1,64}$/.test(candidate) ? candidate : '';

    webview.html = template
      .replaceAll('{{cspSource}}', webview.cspSource)
      .replaceAll('{{nonce}}', nonce)
      .replaceAll('{{scriptUri}}', scriptUri.toString())
      .replaceAll('{{styleUri}}', styleUri.toString())
      .replaceAll('{{iconUri}}', iconUri.toString())
      .replaceAll('{{hostLang}}', resolveLanguage())
      .replaceAll('{{startupTool}}', startupTool)
      .replaceAll('{{title}}', vscode.l10n.t('Dev Tools'));
  }

  private async onMessage(message: RpcMessage): Promise<void> {
    if (!message || message.type !== 'rpc' || typeof message.id !== 'number') return;
    try {
      const result = await handleRpc(String(message.method), message.params);
      await this.panel.webview.postMessage({ type: 'rpc-result', id: message.id, result });
    } catch (error) {
      await this.panel.webview.postMessage({
        type: 'rpc-result',
        id: message.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private dispose(): void {
    if (DevToolsPanel.current === this) DevToolsPanel.current = undefined;
    this.panel.dispose();
  }
}
