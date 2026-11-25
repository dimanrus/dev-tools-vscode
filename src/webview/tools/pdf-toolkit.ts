/** PDF toolkit: merge, delete, rotate, reorder, extract and split pages. */
import { PDFDocument, degrees } from 'pdf-lib';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  btn,
  checkbox,
  downloadBlob,
  errorSlot,
  field,
  fileDrop,
  iconBtn,
  note,
  pane,
  readArrayBuffer,
  setError,
  split,
  stats,
  textInput,
  toolbar,
} from '../components.ts';
import { h } from '../dom.ts';
import { defineTool } from '../tool-types.ts';

interface PdfSource {
  id: number;
  name: string;
  doc: PDFDocument;
  bytes: Uint8Array;
  count: number;
}

interface PageRef {
  id: number;
  source: PdfSource;
  index: number;
  rotation: number;
}

/** pdf.js touches DOM APIs at import time, so it is loaded only when a page is rendered. */
let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;
const loadPdfjs = (): Promise<typeof import('pdfjs-dist')> => (pdfjsPromise ??= import('pdfjs-dist'));

function pdfToolkitTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'converters-pdf-toolkit',
    group: 'converters',
    icon: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z"/><path d="M9 17h6"/><path d="M9 13h6"/>',
    name: { en: 'PDF Toolkit', ru: 'PDF-инструменты' },
    desc: {
      en: 'Merge PDFs, delete, rotate, reorder and extract pages, split into parts and save the result.',
      ru: 'Объединение PDF, удаление, поворот, перестановка и извлечение страниц, разделение на части и сохранение.',
    },
    keywords: 'pdf merge split delete pages rotate extract combine documents',
    fill: true,
    mount(root, ctx) {
      let nextSourceId = 1;
      let nextPageId = 1;
      let sources: PdfSource[] = [];
      let pages: PageRef[] = [];
      let selected = new Set<number>();
      let splitSize = 10;
      let splitChunks: Array<{ label: string; pages: PageRef[] }> = [];
      let anchorOrder: number | null = null;
      let previewOverlay: HTMLElement | null = null;

      const error = errorSlot();
      const pagesHost = h('div', { class: 'dt-pdf-pages' });
      const documentsHost = h('div', { class: 'dt-stack' });
      const splitHost = h('div', { class: 'dt-stack' });
      const summary = h('div');

      const selectedPages = (): PageRef[] => pages.filter((page) => selected.has(page.id));
      const toggleSelection = (id: number): void => {
        if (selected.has(id)) selected.delete(id);
        else selected.add(id);
        renderPages();
      };

      const workerUri = document.documentElement.dataset.pdfWorkerUri ?? '';
      const vendorUri = (folder: string): string | undefined =>
        workerUri ? workerUri.replace(/pdf\.worker\.min\.mjs$/, `${folder}/`) : undefined;
      const standardFontsUri = vendorUri('standard_fonts');
      const wasmUri = vendorUri('pdfjs-wasm');
      const iccUri = vendorUri('pdfjs-iccs');
      const cMapUri = vendorUri('pdfjs-cmaps');

      const thumbs = new Map<number, string>();
      const thumbImages = new Map<number, HTMLImageElement>();
      const pdfDocs = new Map<number, Promise<PDFDocumentProxy>>();
      let thumbQueue: Promise<void> = Promise.resolve();
      const thumbObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            thumbObserver.unobserve(entry.target);
            const page = pages.find((item) => item.id === Number((entry.target as HTMLElement).dataset.pageId));
            if (page) queueThumb(page);
          }
        },
        { rootMargin: '240px' },
      );

      const pdfDocFor = (source: PdfSource): Promise<PDFDocumentProxy> => {
        let promise = pdfDocs.get(source.id);
        if (!promise) {
          promise = (async () => {
            const pdfjs = await loadPdfjs();
            if (workerUri) pdfjs.GlobalWorkerOptions.workerSrc = workerUri;
            const task = pdfjs.getDocument({
              // pdf.js transfers (detaches) the buffer, so always hand it a copy.
              data: new Uint8Array(source.bytes),
              standardFontDataUrl: standardFontsUri,
              wasmUrl: wasmUri,
              iccUrl: iccUri,
              cMapUrl: cMapUri,
              cMapPacked: true,
            });
            return task.promise;
          })();
          pdfDocs.set(source.id, promise);
        }
        return promise;
      };

      /** Renders a page (with the user rotation applied) into a fresh canvas. */
      const paintPage = async (page: PageRef, width: number): Promise<HTMLCanvasElement> => {
        const pdf = await pdfDocFor(page.source);
        const pdfPage = await pdf.getPage(page.index + 1);
        const rotation = (pdfPage.rotate + page.rotation) % 360;
        const base = pdfPage.getViewport({ scale: 1, rotation });
        const viewport = pdfPage.getViewport({ scale: width / base.width, rotation });
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.ceil(viewport.width));
        canvas.height = Math.max(1, Math.ceil(viewport.height));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas 2D is unavailable');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        await pdfPage.render({ canvas, canvasContext: context, viewport }).promise;
        return canvas;
      };

      const queueThumb = (page: PageRef): void => {
        thumbQueue = thumbQueue.then(async () => {
          if (thumbs.has(page.id) || !thumbImages.has(page.id)) return;
          try {
            const canvas = await paintPage(page, 112 * Math.min(2, window.devicePixelRatio || 1));
            const url = canvas.toDataURL('image/jpeg', 0.82);
            thumbs.set(page.id, url);
            const image = thumbImages.get(page.id);
            if (image) {
              image.src = url;
              image.classList.remove('is-loading');
            }
          } catch {
            thumbImages.get(page.id)?.classList.remove('is-loading');
          }
        });
      };

      const closePreview = (): void => {
        if (!previewOverlay) return;
        previewOverlay.remove();
        previewOverlay = null;
        document.removeEventListener('keydown', onPreviewKey);
      };

      function onPreviewKey(event: KeyboardEvent): void {
        if (event.key === 'Escape') closePreview();
      }

      const openPreview = async (page: PageRef, order: number): Promise<void> => {
        closePreview();
        const body = h('div', { class: 'dt-pdf-preview-body' }, note(ctx.pick('Rendering…', 'Отрисовка…')));
        const overlay = h(
          'div',
          { class: 'dt-pdf-preview', role: 'dialog', 'aria-modal': 'true' },
          h(
            'div',
            { class: 'dt-pdf-preview-card' },
            h(
              'div',
              { class: 'dt-pdf-preview-head' },
              h(
                'span',
                { class: 'dt-pdf-preview-title' },
                `${page.source.name} · ${ctx.pick('page', 'стр.')} ${order + 1}`,
              ),
              h(
                'div',
                { class: 'dt-pdf-preview-actions' },
                iconBtn('<path d="M6 6l12 12"/><path d="M18 6l-12 12"/>', ctx.pick('Close', 'Закрыть'), closePreview),
              ),
            ),
            body,
          ),
        );
        overlay.addEventListener('click', (event) => {
          if (event.target === overlay) closePreview();
        });
        document.body.appendChild(overlay);
        previewOverlay = overlay;
        document.addEventListener('keydown', onPreviewKey);
        try {
          const pdf = await pdfDocFor(page.source);
          const pdfPage = await pdf.getPage(page.index + 1);
          const rotation = (pdfPage.rotate + page.rotation) % 360;
          const base = pdfPage.getViewport({ scale: 1, rotation });
          const width = Math.min(1100, window.innerWidth * 0.86, window.innerHeight * 0.72 * (base.width / base.height));
          body.replaceChildren(await paintPage(page, width));
        } catch {
          body.replaceChildren(note(ctx.pick('Cannot render this page.', 'Не удалось отобразить страницу.'), 'error'));
        }
      };

      const buildPdf = async (refs: PageRef[]): Promise<Uint8Array> => {
        const output = await PDFDocument.create();
        for (const ref of refs) {
          const [copied] = await output.copyPages(ref.source.doc, [ref.index]);
          if (ref.rotation) copied.setRotation(degrees((copied.getRotation().angle + ref.rotation) % 360));
          output.addPage(copied);
        }
        return output.save();
      };

      const downloadPdf = async (refs: PageRef[], name: string): Promise<void> => {
        try {
          const bytes = await buildPdf(refs);
          downloadBlob(name, new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' }));
        } catch {
          setError(error, ctx.pick('Cannot build the PDF.', 'Не удалось собрать PDF.'));
        }
      };

      const renderPages = (): void => {
        pagesHost.replaceChildren();
        thumbImages.clear();
        if (!pages.length) {
          pagesHost.appendChild(
            note(ctx.pick('Drop one or more PDF files to start.', 'Перетащите один или несколько PDF-файлов.'), 'info'),
          );
          summary.replaceChildren();
          splitChunks = [];
          renderSplit();
          return;
        }
        pages.forEach((page, order) => {
          const cached = thumbs.get(page.id);
          const image = h('img', { alt: '', class: cached ? '' : 'is-loading' });
          const card = h(
            'button',
            {
              type: 'button',
              class: `dt-pdf-page ${selected.has(page.id) ? 'is-selected' : ''}`,
              title: ctx.pick(
                'Click to select, Shift+click to select a range, double-click to preview',
                'Клик — выбрать, Shift+клик — выбрать диапазон, двойной клик — предпросмотр',
              ),
            },
            h(
              'span',
              { class: 'dt-pdf-thumb' },
              image,
              h('span', { class: 'dt-pdf-page-number' }, String(order + 1)),
              page.rotation ? h('span', { class: 'dt-pdf-page-rotation' }, '⟳') : null,
              h('span', { class: 'dt-pdf-page-zoom', title: ctx.pick('Preview page', 'Открыть страницу') }, '⤢'),
            ),
            h('span', { class: 'dt-pdf-page-source' }, page.source.name),
            h('span', { class: 'dt-pdf-page-meta' }, `p.${page.index + 1}${page.rotation ? ` · ${page.rotation}°` : ''}`),
          );
          card.addEventListener('click', (event) => {
            const target = event.target instanceof HTMLElement ? event.target : null;
            if (target?.closest('.dt-pdf-page-zoom')) {
              void openPreview(page, order);
              return;
            }
            // Shift-click selects the whole range from the last clicked page.
            if (event.shiftKey && anchorOrder !== null && anchorOrder !== order) {
              const [from, to] = anchorOrder < order ? [anchorOrder, order] : [order, anchorOrder];
              selected = new Set(pages.slice(from, to + 1).map((item) => item.id));
              renderPages();
              return;
            }
            anchorOrder = order;
            toggleSelection(page.id);
          });
          card.addEventListener('dblclick', () => void openPreview(page, order));
          card.dataset.pageId = String(page.id);
          thumbImages.set(page.id, image);
          if (cached) image.src = cached;
          pagesHost.appendChild(card);
          if (!cached) thumbObserver.observe(card);
        });
        summary.replaceChildren(
          stats([
            [ctx.pick('Pages', 'Страниц'), pages.length],
            [ctx.pick('Selected', 'Выбрано'), selected.size],
            [ctx.pick('Documents', 'Документов'), sources.length],
          ]),
        );
        renderDocuments();
        buildChunks();
      };

      const renderDocuments = (): void => {
        documentsHost.replaceChildren();
        for (const source of sources) {
          documentsHost.appendChild(
            h(
              'div',
              { class: 'dt-row dt-ie-layer-row' },
              h('span', { class: 'dt-ie-layer-name' }, source.name),
              h('span', { class: 'dt-ie-layer-kind' }, `${source.count} ${ctx.pick('pages', 'стр.')}`),
            ),
          );
        }
      };

      const buildChunks = (): void => {
        splitChunks = [];
        const size = Math.max(1, Math.round(splitSize));
        for (let index = 0; index < pages.length; index += size) {
          const chunk = pages.slice(index, index + size);
          splitChunks.push({
            label: `${index + 1}–${Math.min(pages.length, index + chunk.length)}`,
            pages: chunk,
          });
        }
        renderSplit();
      };

      const renderSplit = (): void => {
        splitHost.replaceChildren();
        if (!splitChunks.length) {
          splitHost.appendChild(note(ctx.pick('No pages to split yet.', 'Пока нечего делить.'), 'info'));
          return;
        }
        for (const chunk of splitChunks) {
          splitHost.appendChild(
            h(
              'div',
              { class: 'dt-row' },
              h('code', { class: 'dt-mono' }, chunk.label),
              h('span', { class: 'dt-hint' }, `${chunk.pages.length} ${ctx.pick('pages', 'стр.')}`),
              btn(
                ctx.pick('Download', 'Скачать'),
                () => void downloadPdf(chunk.pages, `split-${chunk.label.replace('–', '-')}.pdf`),
                { variant: 'ghost' },
              ),
            ),
          );
        }
      };

      const loadFiles = async (files: File[]): Promise<void> => {
        setError(error, null);
        for (const file of files) {
          try {
            const bytes = await readArrayBuffer(file);
            const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
            const source: PdfSource = {
              id: nextSourceId++,
              name: file.name,
              doc,
              bytes: new Uint8Array(bytes),
              count: doc.getPageCount(),
            };
            sources.push(source);
            for (let index = 0; index < source.count; index++) {
              pages.push({ id: nextPageId++, source, index, rotation: 0 });
            }
          } catch {
            setError(
              error,
              ctx.pick(`Cannot read ${file.name}. It may be encrypted or corrupted.`, `Не удалось прочитать ${file.name}. Возможно, файл зашифрован или повреждён.`),
            );
          }
        }
        renderPages();
      };

      const upload = fileDrop({
        accept: 'application/pdf,.pdf',
        multiple: true,
        hint: ctx.pick('Drop PDF files (multiple files are merged)', 'Перетащите PDF-файлы (несколько файлов объединяются)'),
        onFiles: (files) => void loadFiles(files),
      });

      const deleteSelected = (): void => {
        if (!selected.size) {
          setError(error, ctx.pick('Select pages to delete.', 'Выберите страницы для удаления.'));
          return;
        }
        pages = pages.filter((page) => !selected.has(page.id));
        selected = new Set();
        anchorOrder = null;
        setError(error, null);
        renderPages();
      };

      const rotateSelected = (delta: number): void => {
        if (!selected.size) {
          setError(error, ctx.pick('Select pages to rotate.', 'Выберите страницы для поворота.'));
          return;
        }
        for (const page of pages) {
          if (selected.has(page.id)) {
            page.rotation = (page.rotation + delta + 360) % 360;
            thumbs.delete(page.id);
          }
        }
        setError(error, null);
        renderPages();
      };

      const moveSelected = (direction: -1 | 1): void => {
        const indices = pages
          .map((page, index) => (selected.has(page.id) ? index : -1))
          .filter((index) => index >= 0);
        if (!indices.length) {
          setError(error, ctx.pick('Select a page to move.', 'Выберите страницу для перемещения.'));
          return;
        }
        if (direction < 0) {
          for (const index of indices) {
            if (index > 0 && !selected.has(pages[index - 1].id)) {
              [pages[index - 1], pages[index]] = [pages[index], pages[index - 1]];
            }
          }
        } else {
          for (const index of [...indices].reverse()) {
            if (index < pages.length - 1 && !selected.has(pages[index + 1].id)) {
              [pages[index + 1], pages[index]] = [pages[index], pages[index + 1]];
            }
          }
        }
        renderPages();
      };

      const selectAll = (value: boolean): void => {
        selected = value ? new Set(pages.map((page) => page.id)) : new Set();
        anchorOrder = null;
        renderPages();
      };

      const extractSelected = (): void => {
        const refs = selectedPages();
        if (!refs.length) {
          setError(error, ctx.pick('Select pages to extract.', 'Выберите страницы для извлечения.'));
          return;
        }
        void downloadPdf(refs, 'extracted.pdf');
      };

      const reset = (): void => {
        closePreview();
        sources = [];
        pages = [];
        selected = new Set();
        anchorOrder = null;
        setError(error, null);
        renderPages();
      };

      const pagesPane = pane(
        ctx.pick('Pages', 'Страницы'),
        h('div', { class: 'dt-stack' }, summary, pagesHost),
        [
          iconBtn(
            '<path d="M9 11l3 3l8 -8"/><path d="M20 12v6a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h9"/>',
            ctx.pick('Select all', 'Выбрать все'),
            () => selectAll(true),
          ),
          iconBtn(
            '<path d="M4 4l16 16"/>',
            ctx.pick('Clear selection', 'Снять выделение'),
            () => selectAll(false),
          ),
        ],
        'dt-pane-fill',
        { collapsible: false },
      );

      const operationsPane = pane(
        ctx.pick('Operations', 'Операции'),
        h(
          'div',
          { class: 'dt-stack' },
          toolbar(
            btn(ctx.pick('Delete selected', 'Удалить выбранные'), deleteSelected, { variant: 'danger' }),
            btn(ctx.pick('Extract selected', 'Извлечь выбранные'), extractSelected, { variant: 'primary' }),
          ),
          toolbar(
            btn(ctx.pick('Rotate ← 90°', 'Повернуть ← 90°'), () => rotateSelected(-90), { variant: 'ghost' }),
            btn(ctx.pick('Rotate → 90°', 'Повернуть → 90°'), () => rotateSelected(90), { variant: 'ghost' }),
          ),
          toolbar(
            btn(ctx.pick('Move up', 'Выше'), () => moveSelected(-1), { variant: 'ghost' }),
            btn(ctx.pick('Move down', 'Ниже'), () => moveSelected(1), { variant: 'ghost' }),
          ),
          h(
            'div',
            { class: 'dt-hint' },
            ctx.pick(
              'Click page cards to select them. Loading more PDFs appends their pages.',
              'Нажимайте на карточки страниц, чтобы выбрать их. Дополнительные PDF добавляют свои страницы.',
            ),
          ),
        ),
      );

      const splitPane = pane(
        ctx.pick('Split', 'Разделение'),
        h(
          'div',
          { class: 'dt-stack' },
          field(
            ctx.pick('Pages per file', 'Страниц в файле'),
            textInput({
              type: 'number',
              value: splitSize,
              min: 1,
              oninput: (value) => {
                const parsed = Number(value);
                if (Number.isFinite(parsed) && parsed > 0) {
                  splitSize = Math.round(parsed);
                  buildChunks();
                }
              },
            }),
          ),
          splitHost,
        ),
      );

      const documentsPane = pane(ctx.pick('Documents', 'Документы'), documentsHost, [], '', { defaultCollapsed: true });

      const exportActions = toolbar(
        btn(ctx.pick('Download PDF', 'Скачать PDF'), () => void downloadPdf(pages, 'document.pdf'), { variant: 'primary' }),
        btn(ctx.pick('Reset', 'Сбросить'), reset, { variant: 'ghost' }),
      );

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          error,
          upload,
          split(
            h('div', { class: 'dt-col' }, pagesPane),
            h('div', { class: 'dt-col' }, documentsPane, operationsPane, splitPane, exportActions),
            'dt-pdf-split',
          ),
        ),
      );

      renderPages();
    },
  });
}

export const pdfTools = [pdfToolkitTool()];
