import * as vscode from 'vscode';
import { disposeMedia } from './media.ts';
import { DevToolsPanel } from './panel.ts';
import { DevToolsTreeProvider } from './sidebar.ts';

interface FileTool {
  id: string;
  en: string;
  ru: string;
  extensions: string[];
}

const FILE_TOOLS: FileTool[] = [
  { id: 'graphic-image-adjust', en: 'Image Adjustments', ru: 'Коррекция изображений', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] },
  { id: 'graphic-image-editor', en: 'Image Editor', ru: 'Редактор изображений', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'] },
  { id: 'graphic-vector-editor', en: 'Vector Editor', ru: 'Векторный редактор', extensions: ['svg'] },
  { id: 'media-audio-editor', en: 'Audio Editor', ru: 'Редактор звука', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'] },
  { id: 'media-video-editor', en: 'Video Editor', ru: 'Видеоредактор', extensions: ['mp4', 'mov', 'webm', 'mkv'] },
  { id: 'media-scene-editor', en: '3D Scene', ru: '3D-сцена', extensions: ['obj', 'stl', 'glb', 'gltf'] },
  { id: 'media-metadata', en: 'Media Metadata', ru: 'Метаданные файлов', extensions: ['png', 'jpg', 'jpeg', 'webp', 'mp3', 'wav', 'mp4', 'mov', 'webm'] },
  { id: 'media-ffmpeg-convert', en: 'FFmpeg Converter', ru: 'Конвертер FFmpeg', extensions: ['mp4', 'mov', 'webm', 'mkv', 'avi', 'flv', 'ts', 'm4v', 'mpg', 'mpeg', 'mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'gif'] },
  { id: 'media-stream-viewer', en: 'Stream Viewer', ru: 'Просмотр потоков', extensions: ['mp4', 'mov', 'webm', 'mkv', 'ts', 'm3u8', 'mpd'] },
  { id: 'converters-pdf-toolkit', en: 'PDF Toolkit', ru: 'PDF-инструменты', extensions: ['pdf'] },
];

const MIME_BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  obj: 'model/obj',
  stl: 'model/stl',
  glb: 'model/gltf-binary',
  gltf: 'model/gltf+json',
  pdf: 'application/pdf',
};

async function openFileInTool(context: vscode.ExtensionContext, uri?: vscode.Uri): Promise<void> {
  const target = uri ?? vscode.window.activeTextEditor?.document.uri;
  if (!target || target.scheme !== 'file') {
    void vscode.window.showInformationMessage(vscode.l10n.t('Select a file to open in Dev Tools.'));
    return;
  }
  const extension = target.path.split('.').pop()?.toLowerCase() ?? '';
  const options = FILE_TOOLS.filter((tool) => tool.extensions.includes(extension));
  if (!options.length) {
    void vscode.window.showInformationMessage(vscode.l10n.t('No Dev Tools editor supports this file type.'));
    return;
  }
  const lang = vscode.env.language.toLowerCase().startsWith('ru') ? 'ru' : 'en';
  const picked = await vscode.window.showQuickPick(
    options.map((tool) => ({ label: lang === 'ru' ? tool.ru : tool.en, description: tool.id, tool: tool.id })),
    { title: vscode.l10n.t('Open in Dev Tools'), placeHolder: vscode.l10n.t('Choose an editor') },
  );
  if (!picked) return;
  try {
    const mime = MIME_BY_EXTENSION[extension] ?? 'application/octet-stream';
    // FFmpeg tools work on the original file, so hand them the path without copying gigabytes through the webview.
    const pathBased = picked.tool === 'media-ffmpeg-convert' || picked.tool === 'media-stream-viewer';
    if (pathBased) {
      await DevToolsPanel.show(context, picked.tool, {
        name: target.path.split('/').pop() ?? `file.${extension}`,
        mime,
        dataUrl: '',
        path: target.fsPath,
      });
      return;
    }
    const stat = await vscode.workspace.fs.stat(target);
    if (stat.size > 96 * 1024 * 1024) {
      void vscode.window.showWarningMessage(vscode.l10n.t('File is too large to open in the webview (limit 96 MB).'));
      return;
    }
    const bytes = await vscode.workspace.fs.readFile(target);
    const dataUrl = `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
    await DevToolsPanel.show(context, picked.tool, {
      name: target.path.split('/').pop() ?? `file.${extension}`,
      mime,
      dataUrl,
      path: target.fsPath,
    });
  } catch (error) {
    void vscode.window.showErrorMessage(
      vscode.l10n.t('Cannot read the file: {0}', error instanceof Error ? error.message : String(error)),
    );
  }
}

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
    vscode.commands.registerCommand('devTools.openWith', async (uri?: vscode.Uri) => {
      await openFileInTool(context, uri);
    }),
    vscode.commands.registerCommand('devTools.licenses', async () => {
      await DevToolsPanel.show(context, 'licenses');
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('devTools.showStatusBar')) syncStatusBar();
      if (event.affectsConfiguration('devTools.language')) tree.refresh();
    }),
  );
}

export function deactivate(): void {
  disposeMedia();
  /* the panel disposes itself */
}
