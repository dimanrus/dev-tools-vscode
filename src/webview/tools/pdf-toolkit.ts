/** PDF toolkit: merge, delete, rotate, reorder, extract and split pages. */
import { PDFDocument, degrees } from 'pdf-lib';
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
  count: number;
}

interface PageRef {
  id: number;
  source: PdfSource;
  index: number;
  rotation: number;
}

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
    mount(root, ctx) {
      let nextSourceId = 1;
      let nextPageId = 1;
      let sources: PdfSource[] = [];
      let pages: PageRef[] = [];
      let selected = new Set<number>();
      let splitSize = 10;
      let splitChunks: Array<{ label: string; pages: PageRef[] }> = [];

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
          const card = h(
            'button',
            { type: 'button', class: `dt-pdf-page ${selected.has(page.id) ? 'is-selected' : ''}` },
            h('span', { class: 'dt-pdf-page-number' }, String(order + 1)),
            h('span', { class: 'dt-pdf-page-source' }, page.source.name),
            h('span', { class: 'dt-pdf-page-meta' }, `p.${page.index + 1}${page.rotation ? ` · ${page.rotation}°` : ''}`),
            page.rotation
              ? h('span', { class: 'dt-pdf-page-rotation' }, '⟳')
              : null,
          );
          card.addEventListener('click', () => toggleSelection(page.id));
          pagesHost.appendChild(card);
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
        setError(error, null);
        renderPages();
      };

      const rotateSelected = (delta: number): void => {
        if (!selected.size) {
          setError(error, ctx.pick('Select pages to rotate.', 'Выберите страницы для поворота.'));
          return;
        }
        for (const page of pages) {
          if (selected.has(page.id)) page.rotation = (page.rotation + delta + 360) % 360;
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
        sources = [];
        pages = [];
        selected = new Set();
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

      const documentsPane = pane(ctx.pick('Documents', 'Документы'), documentsHost);

      const exportPane = pane(
        ctx.pick('Export', 'Экспорт'),
        h(
          'div',
          { class: 'dt-stack' },
          toolbar(
            btn(
              ctx.pick('Download PDF', 'Скачать PDF'),
              () => void downloadPdf(pages, 'document.pdf'),
              { variant: 'primary' },
            ),
            btn(ctx.pick('Reset', 'Сбросить'), reset, { variant: 'ghost' }),
          ),
        ),
      );

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          error,
          upload,
          split(
            h('div', { class: 'dt-col' }, pagesPane),
            h('div', { class: 'dt-col' }, documentsPane, operationsPane, splitPane, exportPane),
          ),
        ),
      );

      renderPages();
    },
  });
}

export const pdfTools = [pdfToolkitTool()];
