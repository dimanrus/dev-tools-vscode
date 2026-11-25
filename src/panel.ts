/** The single webview panel that hosts the whole Dev Tools UI. */
import { randomBytes } from 'node:crypto';
import * as vscode from 'vscode';
import { disposeMedia } from './media.ts';
import { handleRpc } from './rpc.ts';

interface RpcMessage {
  type?: string;
  id?: number;
  method?: string;
  params?: unknown;
  tool?: string;
  file?: PanelFile;
  lang?: string;
}

export interface PanelFile {
  name: string;
  mime: string;
  dataUrl: string;
  /** Absolute path when the file came from the file system. */
  path?: string;
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

  static async show(context: vscode.ExtensionContext, toolId?: string, file?: PanelFile): Promise<void> {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;
    if (DevToolsPanel.current) {
      DevToolsPanel.current.panel.reveal(column);
      if (toolId) void DevToolsPanel.current.panel.webview.postMessage({ type: 'open-tool', tool: toolId });
      if (toolId && file) {
        void DevToolsPanel.current.panel.webview.postMessage({ type: 'open-file', tool: toolId, file });
      }
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
    if (toolId && file) instance.queue({ type: 'open-file', tool: toolId, file });
  }

  private readonly panel: vscode.WebviewPanel;
  private readonly context: vscode.ExtensionContext;
  private ready = false;
  private readonly pending: Array<Record<string, unknown>> = [];

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
    const vendorUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'vendor', 'lamejs.iife.js'));
    const pdfWorkerUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'vendor', 'pdf.worker.min.mjs'),
    );
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
      .replaceAll('{{vendorUri}}', vendorUri.toString())
      .replaceAll('{{pdfWorkerUri}}', pdfWorkerUri.toString())
      .replaceAll('{{styleUri}}', styleUri.toString())
      .replaceAll('{{iconUri}}', iconUri.toString())
      .replaceAll('{{hostLang}}', resolveLanguage())
      .replaceAll('{{startupTool}}', startupTool)
      .replaceAll('{{title}}', vscode.l10n.t('Dev Tools'));
  }

  private async onMessage(message: RpcMessage): Promise<void> {
    if (message?.type === 'ready') {
      this.ready = true;
      for (const queued of this.pending.splice(0)) void this.panel.webview.postMessage(queued);
      return;
    }
    if (!message || message.type !== 'rpc' || typeof message.id !== 'number') return;
    try {
      const result = await handleRpc(String(message.method), message.params, (event, payload) => {
        void this.panel.webview.postMessage({ type: 'host-event', event, payload });
      });
      await this.panel.webview.postMessage({ type: 'rpc-result', id: message.id, result });
    } catch (error) {
      await this.panel.webview.postMessage({
        type: 'rpc-result',
        id: message.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private queue(message: Record<string, unknown>): void {
    if (this.ready) void this.panel.webview.postMessage(message);
    else this.pending.push(message);
  }

  private dispose(): void {
    disposeMedia();
    if (DevToolsPanel.current === this) DevToolsPanel.current = undefined;
    this.panel.dispose();
  }
}
