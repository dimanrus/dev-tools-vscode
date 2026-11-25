/** Image editor: layered canvas, brush, text objects, image overlays and cropping. */
import {
  area,
  badge,
  btn,
  checkbox,
  downloadBlob,
  errorSlot,
  field,
  fileDrop,
  iconBtn,
  knobField,
  knobGrid,
  note,
  pane,
  readDataUrl,
  resizableSplit,
  segmented,
  select,
  setError,
  textInput,
  toolbar,
} from '../components.ts';
import { clamp, h } from '../dom.ts';
import { defineTool } from '../tool-types.ts';

type EditorTool = 'brush' | 'fill' | 'shape' | 'move' | 'text' | 'crop';
type ShapeMode = 'rect' | 'ellipse' | 'line' | 'arrow';
type SelectionMode = 'rect' | 'lasso';
type Align = 'left' | 'center' | 'right';
type ExportFormat = 'image/png' | 'image/jpeg' | 'image/webp';

interface LayerBase {
  id: number;
  name: string;
  visible: boolean;
  opacity: number;
}

interface RasterLayer extends LayerBase {
  kind: 'raster';
  canvas: HTMLCanvasElement;
}

interface TextLayer extends LayerBase {
  kind: 'text';
  text: string;
  x: number;
  y: number;
  size: number;
  family: string;
  color: string;
  bold: boolean;
  italic: boolean;
  align: Align;
}

interface ImageLayer extends LayerBase {
  kind: 'image';
  image: HTMLImageElement;
  x: number;
  y: number;
  scale: number;
}

type Layer = RasterLayer | TextLayer | ImageLayer;

interface RectShape {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Snapshot {
  docWidth: number;
  docHeight: number;
  layers: Layer[];
  activeId: number;
}

interface DragState {
  mode: 'brush' | 'move' | 'crop' | 'shape';
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  originX: number;
  originY: number;
}

const FONTS = [
  { value: 'system-ui, sans-serif', label: 'System' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: '"Segoe UI", sans-serif', label: 'Segoe UI' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: '"Times New Roman", serif', label: 'Times' },
  { value: '"Courier New", monospace', label: 'Courier' },
  { value: 'Impact, sans-serif', label: 'Impact' },
  { value: '"Comic Sans MS", cursive', label: 'Comic' },
];

const ICONS = {
  brush: '<path d="M3 21v-4a4 4 0 1 1 4 4h-4"/><path d="M21 3l-9 9"/><path d="M13 7l4 4"/>',
  move: '<path d="M12 3l4 4m-4 -4l-4 4m4 -4v18m0 0l-4 -4m4 4l4 -4m-13 -5h18m0 0l-4 -4m4 4l-4 4m-14 -4l-4 4m4 -4l4 4"/>',
  text: '<path d="M4 6v-1h16v1"/><path d="M12 5v14"/><path d="M9 19h6"/>',
  crop: '<path d="M8 5v10a1 1 0 0 0 1 1h10"/><path d="M5 8h10a1 1 0 0 1 1 1v10"/>',
  undo: '<path d="M9 14l-4 -4l4 -4"/><path d="M5 10h11a4 4 0 1 1 0 8h-1"/>',
  redo: '<path d="M15 14l4 -4l-4 -4"/><path d="M19 10h-11a4 4 0 1 0 0 8h1"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  trash: '<path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"/><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3"/>',
  duplicate: '<path d="M7 7m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z"/><path d="M5 15v-8a2 2 0 0 1 2 -2h8"/>',
  up: '<path d="M12 5l0 14"/><path d="M16 9l-4 -4l-4 4"/>',
  down: '<path d="M12 5l0 14"/><path d="M16 15l-4 4l-4 -4"/>',
  eye: '<path d="M2 12s3.5 -6 10 -6s10 6 10 6s-3.5 6 -10 6s-10 -6 -10 -6z"/><path d="M12 15a3 3 0 1 0 0 -6a3 3 0 0 0 0 6z"/>',
  eyeOff: '<path d="M10.6 10.6a3 3 0 0 0 4.2 4.2"/><path d="M4 4l16 16"/><path d="M6.7 6.7c-2.3 1.6 -3.9 3.5 -4.7 5.3c1.7 3.6 5.3 6 10 6c1.4 0 2.7 -.3 3.9 -.7"/><path d="M9.9 5.2c.7 -.1 1.4 -.2 2.1 -.2c4.7 0 8.3 2.4 10 6c-.4 .9 -1 1.8 -1.7 2.6"/>',
  image: '<path d="M15 8h.01"/><path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3z"/><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5"/><path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3"/>',
  download: '<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2"/><path d="M7 11l5 5l5 -5"/><path d="M12 4l0 12"/>',
} as const;

function imageEditorTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'graphic-image-editor',
    group: 'graphic',
    icon: '<path d="M15 8h.01"/><path d="M11 20h-6a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v5"/><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l3 3"/><path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0"/><path d="M16 19h6"/><path d="M19 16v6"/>',
    name: { en: 'Image Editor', ru: 'Редактор изображений' },
    desc: {
      en: 'Paint on layers, draw shapes and lines, add text and image overlays, lasso selection, crop and export.',
      ru: 'Рисование по слоям, фигуры и линии, текст и наложение изображений, лассо, обрезка и экспорт.',
    },
    keywords: 'image editor layers brush paint shapes rectangle ellipse line arrow lasso text overlay crop cut annotate canvas png jpeg webp',
    mount(root, ctx) {
      // ---------- document state ----------
      let docWidth = 960;
      let docHeight = 640;
      let layers: Layer[] = [];
      let activeId = 0;
      let nextId = 1;
      let layerCount = 0;
      let textCount = 0;
      let imageCount = 0;
      let edited = false;
      let tool: EditorTool = 'brush';
      let brushColor = '#f97316';
      let brushSize = 24;
      let brushOpacity = 1;
      let brushMode: 'paint' | 'erase' = 'paint';
      let shapeMode: ShapeMode = 'rect';
      let shapeFilled = true;
      let shapeThickness = 6;
      let shapeEnd: { x: number; y: number } | null = null;
      let selectionMode: SelectionMode = 'rect';
      let lassoPoints: Array<{ x: number; y: number }> = [];
      let cropRect: RectShape | null = null;
      let drag: DragState | null = null;
      let frame = 0;
      let exportFormat: ExportFormat = 'image/png';
      let exportQuality = 0.92;
      let scaleContent = true;
      let zoom = 1;

      const undoStack: Snapshot[] = [];
      const redoStack: Snapshot[] = [];

      const measure = document.createElement('canvas').getContext('2d');
      if (!measure) throw new Error('Canvas 2D is not available');

      // ---------- elements ----------
      const error = errorSlot();
      const stage = h('div', { class: 'dt-ie-stage', tabindex: 0, dataset: { tool: 'brush' } });
      const display = h('canvas', { class: 'dt-ie-canvas' });
      stage.appendChild(display);
      const cropBar = h('div', { class: 'dt-ie-crop' });
      const hint = h('div', { class: 'dt-hint' });
      const docStats = h('span', { class: 'dt-ie-stats dt-hint' });
      const layerList = h('div', { class: 'dt-ie-layers' });
      const inspector = h('div', { class: 'dt-stack' });
      const sizeWidth = textInput({ type: 'number', value: docWidth, min: 1, max: 8000, class: 'dt-ie-size' });
      const sizeHeight = textInput({ type: 'number', value: docHeight, min: 1, max: 8000, class: 'dt-ie-size' });
      const sizePreset = select(
        [
          { value: 'custom', label: ctx.pick('Custom', 'Свой размер') },
          { value: '640x480', label: '640 × 480' },
          { value: '1280x720', label: '1280 × 720 (HD)' },
          { value: '1920x1080', label: '1920 × 1080 (Full HD)' },
          { value: '2560x1440', label: '2560 × 1440 (QHD)' },
          { value: '1080x1080', label: ctx.pick('1080 × 1080 (Square)', '1080 × 1080 (Квадрат)') },
          { value: '1080x1920', label: ctx.pick('1080 × 1920 (Story)', '1080 × 1920 (Сторис)') },
          { value: '1200x630', label: '1200 × 630 (OG)' },
        ],
        'custom',
        (value) => {
          if (value === 'custom') return;
          const [width, height] = value.split('x').map(Number);
          if (Number.isFinite(width) && Number.isFinite(height)) {
            sizeWidth.value = String(width);
            sizeHeight.value = String(height);
          }
        },
      );
      const markCustomSize = (): void => {
        sizePreset.value = 'custom';
      };
      sizeWidth.addEventListener('input', markCustomSize);
      sizeHeight.addEventListener('input', markCustomSize);

      const undoBtn = iconBtn(ICONS.undo, ctx.pick('Undo (Ctrl+Z)', 'Отменить (Ctrl+Z)'), () => undo(), {
        variant: 'subtle',
        disabled: true,
      });
      const redoBtn = iconBtn(ICONS.redo, ctx.pick('Redo (Ctrl+Shift+Z)', 'Повторить (Ctrl+Shift+Z)'), () => redo(), {
        variant: 'subtle',
        disabled: true,
      });

      const toolSegment = segmented(
        [
          { value: 'brush', label: ctx.pick('Brush', 'Кисть'), title: ctx.pick('Paint with the brush (B)', 'Рисовать кистью (B)') },
          { value: 'fill', label: ctx.pick('Fill', 'Заливка'), title: ctx.pick('Flood fill an area (F)', 'Залить область (F)') },
          { value: 'shape', label: ctx.pick('Shape', 'Фигура'), title: ctx.pick('Draw rectangles, ellipses, lines and arrows (S)', 'Рисовать прямоугольники, эллипсы, линии и стрелки (S)') },
          { value: 'move', label: ctx.pick('Move', 'Переместить'), title: ctx.pick('Move text and image layers (M)', 'Двигать текстовые слои и изображения (M)') },
          { value: 'text', label: ctx.pick('Text', 'Текст'), title: ctx.pick('Add or edit text (T)', 'Добавить или изменить текст (T)') },
          { value: 'crop', label: ctx.pick('Select', 'Выделение'), title: ctx.pick('Select an area to crop or cut out (C)', 'Выделить область для обрезки или вырезания (C)') },
        ],
        'brush',
        (value) => setTool(value as EditorTool),
      );

      const selectionSegment = segmented(
        [
          { value: 'rect', label: ctx.pick('Rectangle', 'Прямоугольник') },
          { value: 'lasso', label: ctx.pick('Lasso', 'Лассо') },
        ],
        'rect',
        (value) => {
          selectionMode = value as SelectionMode;
          cropRect = null;
          lassoPoints = [];
          updateCropBar();
          scheduleRender();
        },
      );
      const selectionBar = h('div', { class: 'dt-toolbar dt-ie-selection' }, selectionSegment);
      selectionBar.style.display = 'none';

      let textAreaRef: HTMLTextAreaElement | null = null;
      let posRefs: { id: number; x: HTMLInputElement; y: HTMLInputElement } | null = null;

      // ---------- helpers ----------
      const uid = (): number => nextId++;

      const activeLayer = (): Layer | undefined => layers.find((layer) => layer.id === activeId);

      const fontOf = (layer: TextLayer): string =>
        `${layer.italic ? 'italic ' : ''}${layer.bold ? '700' : '400'} ${layer.size}px ${layer.family}`;

      const textMetrics = (
        layer: TextLayer,
      ): { lines: string[]; widths: number[]; width: number; lineHeight: number; height: number } => {
        measure.font = fontOf(layer);
        const lines = layer.text.split('\n');
        const widths = lines.map((line) => measure.measureText(line || ' ').width);
        const lineHeight = layer.size * 1.22;
        return {
          lines,
          widths,
          width: Math.max(1, ...widths),
          lineHeight,
          height: lineHeight * Math.max(1, lines.length),
        };
      };

      const drawTextLayer = (target: CanvasRenderingContext2D, layer: TextLayer): void => {
        target.font = fontOf(layer);
        target.fillStyle = layer.color;
        target.textBaseline = 'top';
        target.textAlign = 'left';
        const metrics = textMetrics(layer);
        for (let index = 0; index < metrics.lines.length; index++) {
          const shift =
            layer.align === 'center'
              ? (metrics.width - metrics.widths[index]) / 2
              : layer.align === 'right'
                ? metrics.width - metrics.widths[index]
                : 0;
          target.fillText(metrics.lines[index], layer.x + shift, layer.y + index * metrics.lineHeight);
        }
      };

      const drawLayers = (target: CanvasRenderingContext2D): void => {
        for (const layer of layers) {
          if (!layer.visible || layer.opacity <= 0) continue;
          target.save();
          target.globalAlpha = layer.opacity;
          if (layer.kind === 'raster') {
            target.drawImage(layer.canvas, 0, 0);
          } else if (layer.kind === 'image') {
            target.drawImage(
              layer.image,
              layer.x,
              layer.y,
              layer.image.naturalWidth * layer.scale,
              layer.image.naturalHeight * layer.scale,
            );
          } else {
            drawTextLayer(target, layer);
          }
          target.restore();
        }
      };

      const boundsOf = (layer: Layer): RectShape | null => {
        if (layer.kind === 'text') {
          const metrics = textMetrics(layer);
          return { x: layer.x, y: layer.y, w: metrics.width, h: metrics.height };
        }
        if (layer.kind === 'image') {
          return {
            x: layer.x,
            y: layer.y,
            w: layer.image.naturalWidth * layer.scale,
            h: layer.image.naturalHeight * layer.scale,
          };
        }
        return null;
      };

      const hitTest = (point: { x: number; y: number }): Layer | undefined => {
        for (let index = layers.length - 1; index >= 0; index--) {
          const layer = layers[index];
          if (!layer.visible) continue;
          const bounds = boundsOf(layer);
          if (!bounds) continue;
          if (
            point.x >= bounds.x &&
            point.x <= bounds.x + bounds.w &&
            point.y >= bounds.y &&
            point.y <= bounds.y + bounds.h
          ) {
            return layer;
          }
        }
        return undefined;
      };

      const cloneLayer = (layer: Layer): Layer => {
        if (layer.kind === 'raster') {
          const copy = document.createElement('canvas');
          copy.width = layer.canvas.width;
          copy.height = layer.canvas.height;
          copy.getContext('2d')?.drawImage(layer.canvas, 0, 0);
          return { ...layer, canvas: copy };
        }
        return { ...layer };
      };

      const snapshot = (): Snapshot => ({
        docWidth,
        docHeight,
        layers: layers.map(cloneLayer),
        activeId,
      });

      const restore = (snap: Snapshot): void => {
        docWidth = snap.docWidth;
        docHeight = snap.docHeight;
        layers = snap.layers.map(cloneLayer);
        activeId = snap.activeId;
        cropRect = null;
        lassoPoints = [];
        edited = true;
        syncCanvasSize();
        syncUi();
      };

      const pushUndo = (): void => {
        undoStack.push(snapshot());
        // Keep undo history inside a sane memory budget: large documents hold fewer steps.
        const rasterCount = layers.reduce((total, layer) => total + (layer.kind === 'raster' ? 1 : 0), 0);
        const bytesPerStep = Math.max(1, docWidth * docHeight * 4 * Math.max(1, rasterCount));
        const limit = clamp(Math.floor(192_000_000 / bytesPerStep), 2, 16);
        while (undoStack.length > limit) undoStack.shift();
        redoStack.length = 0;
        updateHistory();
      };

      const updateHistory = (): void => {
        undoBtn.disabled = undoStack.length === 0;
        redoBtn.disabled = redoStack.length === 0;
      };

      function undo(): void {
        const previous = undoStack.pop();
        if (!previous) return;
        redoStack.push(snapshot());
        restore(previous);
        updateHistory();
      }

      function redo(): void {
        const next = redoStack.pop();
        if (!next) return;
        undoStack.push(snapshot());
        restore(next);
        updateHistory();
      }

      const syncCanvasSize = (): void => {
        display.width = Math.max(1, Math.round(docWidth));
        display.height = Math.max(1, Math.round(docHeight));
        sizeWidth.value = String(Math.round(docWidth));
        sizeHeight.value = String(Math.round(docHeight));
        applyZoom();
      };

      /** Ctrl/Cmd + wheel scales the canvas inside the scrolling stage. */
      const applyZoom = (): void => {
        if (zoom === 1) {
          display.style.width = '';
          display.style.height = '';
          stage.classList.remove('is-zoomed');
        } else {
          display.style.width = `${Math.max(1, Math.round(display.width * zoom))}px`;
          display.style.height = `${Math.max(1, Math.round(display.height * zoom))}px`;
          stage.classList.add('is-zoomed');
        }
        updateStats();
      };

      stage.addEventListener(
        'wheel',
        (event) => {
          if (!event.ctrlKey && !event.metaKey) return;
          event.preventDefault();
          const previous = zoom;
          const next = clamp(previous * (event.deltaY < 0 ? 1.15 : 1 / 1.15), 0.1, 8);
          if (next === previous) return;
          const rect = display.getBoundingClientRect();
          const localX = event.clientX - rect.left;
          const localY = event.clientY - rect.top;
          const stageRect = stage.getBoundingClientRect();
          zoom = next;
          applyZoom();
          stage.scrollLeft = display.offsetLeft + (localX / previous) * next - (event.clientX - stageRect.left);
          stage.scrollTop = display.offsetTop + (localY / previous) * next - (event.clientY - stageRect.top);
        },
        { passive: false },
      );

      const updateStats = (): void => {
        docStats.textContent = `${docWidth} × ${docHeight} · ${ctx.pick(
          `${layers.length} layer${layers.length === 1 ? '' : 's'}`,
          `${layers.length} сл.`,
        )}${zoom === 1 ? '' : ` · ${Math.round(zoom * 100)}%`}`;
      };

      // ---------- rendering ----------
      const drawShapeOn = (
        target: CanvasRenderingContext2D,
        start: { x: number; y: number },
        end: { x: number; y: number },
        mode: ShapeMode,
        color: string,
        filled: boolean,
        thickness: number,
        alpha: number,
      ): void => {
        const left = Math.min(start.x, end.x);
        const top = Math.min(start.y, end.y);
        const width = Math.abs(end.x - start.x);
        const height = Math.abs(end.y - start.y);
        target.save();
        target.globalAlpha = alpha;
        target.strokeStyle = color;
        target.fillStyle = color;
        target.lineWidth = thickness;
        target.lineCap = 'round';
        target.lineJoin = 'round';
        if (mode === 'rect') {
          if (filled) target.fillRect(left, top, width, height);
          else target.strokeRect(left, top, width, height);
        } else if (mode === 'ellipse') {
          target.beginPath();
          target.ellipse(
            left + width / 2,
            top + height / 2,
            Math.max(0.5, width / 2),
            Math.max(0.5, height / 2),
            0,
            0,
            Math.PI * 2,
          );
          if (filled) target.fill();
          else target.stroke();
        } else {
          target.beginPath();
          target.moveTo(start.x, start.y);
          target.lineTo(end.x, end.y);
          target.stroke();
          if (mode === 'arrow') {
            const angle = Math.atan2(end.y - start.y, end.x - start.x);
            const head = Math.max(10, thickness * 3.4);
            const spread = Math.PI / 7;
            target.beginPath();
            target.moveTo(end.x, end.y);
            target.lineTo(end.x - head * Math.cos(angle - spread), end.y - head * Math.sin(angle - spread));
            target.moveTo(end.x, end.y);
            target.lineTo(end.x - head * Math.cos(angle + spread), end.y - head * Math.sin(angle + spread));
            target.stroke();
          }
        }
        target.restore();
      };

      const paint = (): void => {
        const target = display.getContext('2d');
        if (!target) return;
        target.clearRect(0, 0, docWidth, docHeight);
        drawLayers(target);
        const line = Math.max(1, docWidth / 640);

        if (tool !== 'crop') {
          const layer = activeLayer();
          if (layer && layer.kind !== 'raster') {
            const bounds = boundsOf(layer);
            if (bounds) {
              target.save();
              target.strokeStyle = 'rgba(59,130,246,0.9)';
              target.lineWidth = line;
              target.setLineDash([line * 5, line * 4]);
              target.strokeRect(
                bounds.x - line,
                bounds.y - line,
                bounds.w + line * 2,
                bounds.h + line * 2,
              );
              target.restore();
            }
          }
        }

        if (drag?.mode === 'shape' && shapeEnd) {
          drawShapeOn(
            target,
            { x: drag.startX, y: drag.startY },
            shapeEnd,
            shapeMode,
            brushColor,
            shapeFilled,
            shapeThickness,
            brushOpacity,
          );
        }

        if (cropRect) {
          const selection = cropRect;
          target.save();
          if (selectionMode === 'lasso' && lassoPoints.length > 1) {
            target.beginPath();
            lassoPoints.forEach((point, index) => {
              if (index === 0) target.moveTo(point.x, point.y);
              else target.lineTo(point.x, point.y);
            });
            target.closePath();
            target.fillStyle = 'rgba(59,130,246,0.18)';
            target.fill();
            target.lineWidth = line * 1.6;
            target.setLineDash([line * 6, line * 4]);
            target.strokeStyle = '#ffffff';
            target.stroke();
            target.restore();
            return;
          }
          target.fillStyle = 'rgba(0,0,0,0.45)';
          target.fillRect(0, 0, docWidth, selection.y);
          target.fillRect(0, selection.y + selection.h, docWidth, docHeight - selection.y - selection.h);
          target.fillRect(0, selection.y, selection.x, selection.h);
          target.fillRect(selection.x + selection.w, selection.y, docWidth - selection.x - selection.w, selection.h);
          target.lineWidth = line * 1.6;
          target.setLineDash([line * 6, line * 4]);
          target.strokeStyle = '#ffffff';
          target.strokeRect(selection.x, selection.y, selection.w, selection.h);
          target.restore();
        }
      };

      const scheduleRender = (): void => {
        if (frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          paint();
        });
      };

      // ---------- layers ----------
      const createRasterLayer = (fill?: string, name?: string): RasterLayer => {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, docWidth);
        canvas.height = Math.max(1, docHeight);
        if (fill) {
          const target = canvas.getContext('2d');
          if (target) {
            target.fillStyle = fill;
            target.fillRect(0, 0, docWidth, docHeight);
          }
        }
        return {
          id: uid(),
          name: name ?? `Layer ${++layerCount}`,
          visible: true,
          opacity: 1,
          kind: 'raster',
          canvas,
        };
      };

      const ensureRasterLayer = (): RasterLayer => {
        const active = activeLayer();
        if (active?.kind === 'raster') return active;
        for (let index = layers.length - 1; index >= 0; index--) {
          const layer = layers[index];
          if (layer.kind === 'raster') {
            activeId = layer.id;
            renderLayerList();
            renderInspector();
            return layer;
          }
        }
        const layer = createRasterLayer();
        layers.push(layer);
        activeId = layer.id;
        renderLayerList();
        renderInspector();
        return layer;
      };

      const selectLayer = (id: number): void => {
        if (activeId === id) return;
        activeId = id;
        setError(error, null);
        renderLayerList();
        renderInspector();
        updateCropBar();
        scheduleRender();
      };

      const addRasterLayer = (): void => {
        pushUndo();
        const layer = createRasterLayer();
        layers.push(layer);
        activeId = layer.id;
        syncUi();
      };

      const addTextLayer = (x: number, y: number): void => {
        pushUndo();
        const layer: TextLayer = {
          id: uid(),
          name: `Text ${++textCount}`,
          visible: true,
          opacity: 1,
          kind: 'text',
          text: ctx.pick('Text', 'Текст'),
          x,
          y,
          size: clamp(Math.round(docWidth / 20), 16, 96),
          family: FONTS[0].value,
          color: '#111827',
          bold: false,
          italic: false,
          align: 'left',
        };
        layers.push(layer);
        activeId = layer.id;
        edited = true;
        syncUi();
      };

      const loadImage = (source: string): Promise<HTMLImageElement> =>
        new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error('image load error'));
          image.src = source;
        });

      const addImageFromSource = async (source: string, label?: string): Promise<void> => {
        setError(error, null);
        try {
          const image = await loadImage(source);
          pushUndo();
          const base = layers[0];
          const blank = layers.length === 1 && base?.kind === 'raster' && !edited;
          let scale = 1;
          let x = 0;
          let y = 0;
          if (blank && base && base.kind === 'raster') {
            const maxSide = Math.max(image.naturalWidth, image.naturalHeight);
            const fit = maxSide > 3072 ? 3072 / maxSide : 1;
            docWidth = Math.max(1, Math.round(image.naturalWidth * fit));
            docHeight = Math.max(1, Math.round(image.naturalHeight * fit));
            base.canvas.width = docWidth;
            base.canvas.height = docHeight;
            scale = fit;
            syncCanvasSize();
          } else {
            scale = Math.min(
              (docWidth * 0.8) / image.naturalWidth,
              (docHeight * 0.8) / image.naturalHeight,
              1,
            );
            x = (docWidth - image.naturalWidth * scale) / 2;
            y = (docHeight - image.naturalHeight * scale) / 2;
          }
          const layer: ImageLayer = {
            id: uid(),
            name: label || `Image ${++imageCount}`,
            visible: true,
            opacity: 1,
            kind: 'image',
            image,
            x,
            y,
            scale,
          };
          layers.push(layer);
          activeId = layer.id;
          edited = true;
          syncUi();
        } catch {
          setError(error, ctx.pick('Cannot read this image.', 'Не удалось прочитать изображение.'));
        }
      };

      const addImageLayer = async (file: File): Promise<void> => {
        const source = await readDataUrl(file);
        await addImageFromSource(source, file.name.replace(/\.[^.]+$/, ''));
      };

      const duplicateLayer = (): void => {
        const layer = activeLayer();
        if (!layer) return;
        pushUndo();
        const copy = cloneLayer(layer);
        copy.id = uid();
        copy.name = `${layer.name} ${ctx.pick('copy', 'копия')}`;
        if (copy.kind === 'text' || copy.kind === 'image') {
          copy.x += 16;
          copy.y += 16;
        }
        layers.splice(layers.indexOf(layer) + 1, 0, copy);
        activeId = copy.id;
        syncUi();
      };

      const deleteLayer = (): void => {
        const layer = activeLayer();
        if (!layer) return;
        if (layers.length === 1) {
          setError(error, ctx.pick('Keep at least one layer.', 'Должен остаться хотя бы один слой.'));
          return;
        }
        pushUndo();
        const index = layers.indexOf(layer);
        layers.splice(index, 1);
        activeId = layers[Math.min(index, layers.length - 1)].id;
        setError(error, null);
        syncUi();
      };

      const moveLayer = (id: number, direction: -1 | 1): void => {
        const index = layers.findIndex((layer) => layer.id === id);
        const targetIndex = index + direction;
        if (index < 0 || targetIndex < 0 || targetIndex >= layers.length) return;
        pushUndo();
        const [moved] = layers.splice(index, 1);
        layers.splice(targetIndex, 0, moved);
        renderLayerList();
        scheduleRender();
      };

      // ---------- crop ----------
      const normalizedRect = (x0: number, y0: number, x1: number, y1: number): RectShape => {
        const ax = clamp(x0, 0, docWidth);
        const ay = clamp(y0, 0, docHeight);
        const bx = clamp(x1, 0, docWidth);
        const by = clamp(y1, 0, docHeight);
        return {
          x: Math.min(ax, bx),
          y: Math.min(ay, by),
          w: Math.abs(bx - ax),
          h: Math.abs(by - ay),
        };
      };

      function applyCrop(): void {
        if (!cropRect) return;
        const area = {
          x: Math.round(cropRect.x),
          y: Math.round(cropRect.y),
          w: Math.round(cropRect.w),
          h: Math.round(cropRect.h),
        };
        if (area.w < 2 || area.h < 2) {
          setError(error, ctx.pick('Selection is too small.', 'Выделение слишком маленькое.'));
          return;
        }
        pushUndo();
        for (const layer of layers) {
          if (layer.kind === 'raster') {
            const next = document.createElement('canvas');
            next.width = area.w;
            next.height = area.h;
            next
              .getContext('2d')
              ?.drawImage(layer.canvas, area.x, area.y, area.w, area.h, 0, 0, area.w, area.h);
            layer.canvas = next;
          } else {
            layer.x -= area.x;
            layer.y -= area.y;
          }
        }
        docWidth = area.w;
        docHeight = area.h;
        cropRect = null;
        lassoPoints = [];
        edited = true;
        setError(error, null);
        syncCanvasSize();
        syncUi();
      }

      function cutSelection(): void {
        const layer = activeLayer();
        if (!cropRect) return;
        if (!layer || layer.kind !== 'raster') {
          setError(error, ctx.pick('Select a raster layer to cut from.', 'Выберите растровый слой для вырезания.'));
          return;
        }
        pushUndo();
        const target = layer.canvas.getContext('2d');
        if (target) {
          target.save();
          if (selectionMode === 'lasso' && lassoPoints.length > 2) {
            const path = new Path2D();
            lassoPoints.forEach((point, index) => {
              if (index === 0) path.moveTo(point.x, point.y);
              else path.lineTo(point.x, point.y);
            });
            path.closePath();
            target.globalCompositeOperation = 'destination-out';
            target.fillStyle = '#000000';
            target.fill(path);
          } else if (cropRect) {
            target.clearRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
          }
          target.restore();
        }
        cropRect = null;
        lassoPoints = [];
        edited = true;
        setError(error, null);
        updateCropBar();
        scheduleRender();
      }

      const updateCropBar = (): void => {
        cropBar.replaceChildren();
        if (!cropRect) return;
        const layer = activeLayer();
        cropBar.replaceChildren(
          h(
            'div',
            { class: 'dt-toolbar' },
            btn(ctx.pick('Crop to selection', 'Обрезать по выделению'), applyCrop, { variant: 'primary' }),
            layer?.kind === 'raster'
              ? btn(ctx.pick('Cut out of layer', 'Вырезать из слоя'), cutSelection, { variant: 'ghost' })
              : null,
            btn(
              ctx.pick('Cancel', 'Отмена'),
              () => {
                cropRect = null;
                lassoPoints = [];
                updateCropBar();
                scheduleRender();
              },
              { variant: 'ghost' },
            ),
          ),
        );
      };

      // ---------- pointer handling ----------
      const toDoc = (event: PointerEvent): { x: number; y: number } => {
        const rect = display.getBoundingClientRect();
        const scale = rect.width > 0 ? display.width / rect.width : 1;
        return {
          x: clamp((event.clientX - rect.left) * scale, 0, docWidth),
          y: clamp((event.clientY - rect.top) * scale, 0, docHeight),
        };
      };

      const paintStroke = (
        layer: RasterLayer,
        from: { x: number; y: number },
        to: { x: number; y: number },
      ): void => {
        const target = layer.canvas.getContext('2d');
        if (!target) return;
        target.save();
        target.globalCompositeOperation = brushMode === 'erase' ? 'destination-out' : 'source-over';
        target.globalAlpha = brushOpacity;
        target.strokeStyle = brushColor;
        target.lineWidth = brushSize;
        target.lineCap = 'round';
        target.lineJoin = 'round';
        target.beginPath();
        target.moveTo(from.x, from.y);
        target.lineTo(to.x + 0.01, to.y + 0.01);
        target.stroke();
        target.restore();
      };

      const parseHex = (value: string): { r: number; g: number; b: number } => {
        const hex = value.replace('#', '');
        const full = hex.length === 3 ? hex.split('').map((part) => part + part).join('') : hex;
        const numeric = Number.parseInt(full, 16);
        return {
          r: (numeric >> 16) & 0xff,
          g: (numeric >> 8) & 0xff,
          b: numeric & 0xff,
        };
      };

      const floodFill = (layer: RasterLayer, point: { x: number; y: number }): void => {
        const target = layer.canvas.getContext('2d', { willReadFrequently: true });
        if (!target) return;
        const width = layer.canvas.width;
        const height = layer.canvas.height;
        const x0 = Math.floor(point.x);
        const y0 = Math.floor(point.y);
        if (x0 < 0 || y0 < 0 || x0 >= width || y0 >= height) return;
        const image = target.getImageData(0, 0, width, height);
        const data = image.data;
        const startIndex = (y0 * width + x0) * 4;
        const seed = [data[startIndex], data[startIndex + 1], data[startIndex + 2], data[startIndex + 3]];
        const color = parseHex(brushColor);
        const alpha = Math.round(255 * brushOpacity);
        const tolerance = 40;
        const matches = (index: number): boolean =>
          Math.abs(data[index] - seed[0]) <= tolerance &&
          Math.abs(data[index + 1] - seed[1]) <= tolerance &&
          Math.abs(data[index + 2] - seed[2]) <= tolerance &&
          Math.abs(data[index + 3] - seed[3]) <= tolerance;
        if (
          Math.abs(seed[0] - color.r) <= 2 &&
          Math.abs(seed[1] - color.g) <= 2 &&
          Math.abs(seed[2] - color.b) <= 2 &&
          seed[3] === alpha
        ) {
          return;
        }
        const seen = new Uint8Array(width * height);
        const stack: number[] = [y0 * width + x0];
        while (stack.length) {
          const pixel = stack.pop() as number;
          if (seen[pixel]) continue;
          seen[pixel] = 1;
          const index = pixel * 4;
          if (!matches(index)) continue;
          data[index] = color.r;
          data[index + 1] = color.g;
          data[index + 2] = color.b;
          data[index + 3] = alpha;
          const x = pixel % width;
          const y = (pixel - x) / width;
          if (x > 0) stack.push(pixel - 1);
          if (x < width - 1) stack.push(pixel + 1);
          if (y > 0) stack.push(pixel - width);
          if (y < height - 1) stack.push(pixel + width);
        }
        target.putImageData(image, 0, 0);
      };

      const onPointerDown = (event: PointerEvent): void => {
        if (event.button !== 0) return;
        const point = toDoc(event);
        setError(error, null);
        stage.focus();

        if (tool === 'text') {
          const hit = hitTest(point);
          if (hit?.kind === 'text') {
            selectLayer(hit.id);
          } else {
            addTextLayer(point.x, point.y);
          }
          requestAnimationFrame(() => {
            textAreaRef?.focus();
            textAreaRef?.select();
          });
          return;
        }

        if (tool === 'crop') {
          lassoPoints = selectionMode === 'lasso' ? [{ x: point.x, y: point.y }] : [];
          cropRect = { x: point.x, y: point.y, w: 0, h: 0 };
          drag = {
            mode: 'crop',
            startX: point.x,
            startY: point.y,
            lastX: point.x,
            lastY: point.y,
            originX: 0,
            originY: 0,
          };
          updateCropBar();
          display.setPointerCapture(event.pointerId);
          scheduleRender();
          return;
        }

        if (tool === 'shape') {
          pushUndo();
          ensureRasterLayer();
          edited = true;
          shapeEnd = point;
          drag = {
            mode: 'shape',
            startX: point.x,
            startY: point.y,
            lastX: point.x,
            lastY: point.y,
            originX: 0,
            originY: 0,
          };
          display.setPointerCapture(event.pointerId);
          scheduleRender();
          return;
        }

        if (tool === 'fill') {
          pushUndo();
          const layer = ensureRasterLayer();
          floodFill(layer, point);
          edited = true;
          scheduleRender();
          return;
        }

        if (tool === 'brush') {
          pushUndo();
          const layer = ensureRasterLayer();
          edited = true;
          drag = {
            mode: 'brush',
            startX: point.x,
            startY: point.y,
            lastX: point.x,
            lastY: point.y,
            originX: 0,
            originY: 0,
          };
          paintStroke(layer, point, point);
          display.setPointerCapture(event.pointerId);
          scheduleRender();
          return;
        }

        const hit = hitTest(point);
        const active = activeLayer();
        const target = hit ?? (active && active.kind !== 'raster' ? active : undefined);
        if (!target || target.kind === 'raster') {
          setError(
            error,
            ctx.pick('Click a text or image layer to move it.', 'Нажмите на текстовый слой или изображение, чтобы двигать.'),
          );
          return;
        }
        selectLayer(target.id);
        pushUndo();
        drag = {
          mode: 'move',
          startX: point.x,
          startY: point.y,
          lastX: point.x,
          lastY: point.y,
          originX: target.x,
          originY: target.y,
        };
        display.setPointerCapture(event.pointerId);
      };

      const onPointerMove = (event: PointerEvent): void => {
        if (!drag) return;
        const point = toDoc(event);
        if (drag.mode === 'brush') {
          const layer = activeLayer();
          if (layer?.kind === 'raster') {
            paintStroke(layer, { x: drag.lastX, y: drag.lastY }, point);
          }
          drag.lastX = point.x;
          drag.lastY = point.y;
          scheduleRender();
          return;
        }
        if (drag.mode === 'move') {
          const layer = activeLayer();
          if (layer && (layer.kind === 'text' || layer.kind === 'image')) {
            layer.x = drag.originX + (point.x - drag.startX);
            layer.y = drag.originY + (point.y - drag.startY);
            syncPosFields(layer);
            scheduleRender();
          }
          return;
        }
        if (drag.mode === 'shape') {
          shapeEnd = point;
          scheduleRender();
          return;
        }
        if (selectionMode === 'lasso') {
          const last = lassoPoints[lassoPoints.length - 1];
          if (!last || Math.hypot(point.x - last.x, point.y - last.y) > 2) {
            lassoPoints.push(point);
          }
          if (lassoPoints.length) {
            const xs = lassoPoints.map((item) => item.x);
            const ys = lassoPoints.map((item) => item.y);
            const minX = Math.min(...xs);
            const minY = Math.min(...ys);
            cropRect = { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
          }
          scheduleRender();
          return;
        }
        cropRect = normalizedRect(drag.startX, drag.startY, point.x, point.y);
        scheduleRender();
      };

      const onPointerUp = (event: PointerEvent): void => {
        if (!drag) return;
        if (drag.mode === 'shape') {
          const layer = activeLayer();
          if (layer?.kind === 'raster' && shapeEnd) {
            drawShapeOn(
              layer.canvas.getContext('2d')!,
              { x: drag.startX, y: drag.startY },
              shapeEnd,
              shapeMode,
              brushColor,
              shapeFilled,
              shapeThickness,
              brushOpacity,
            );
          }
          shapeEnd = null;
        }
        if (drag.mode === 'crop') {
          if (selectionMode === 'lasso' && lassoPoints.length < 3) {
            lassoPoints = [];
            cropRect = null;
          } else if (cropRect && (cropRect.w < 2 || cropRect.h < 2)) {
            cropRect = null;
            lassoPoints = [];
          }
          updateCropBar();
        }
        drag = null;
        if (display.hasPointerCapture(event.pointerId)) display.releasePointerCapture(event.pointerId);
        scheduleRender();
      };

      display.addEventListener('pointerdown', onPointerDown);
      display.addEventListener('pointermove', onPointerMove);
      display.addEventListener('pointerup', onPointerUp);
      display.addEventListener('pointercancel', onPointerUp);

      // ---------- UI rendering ----------
      const kindLabel = (kind: Layer['kind']): string => {
        if (kind === 'raster') return ctx.pick('Raster', 'Растр');
        if (kind === 'text') return ctx.pick('Text', 'Текст');
        return ctx.pick('Image', 'Изображение');
      };

      const setTool = (next: EditorTool): void => {
        tool = next;
        stage.dataset.tool = next;
        for (const button of Array.from(toolSegment.querySelectorAll<HTMLElement>('.dt-segment'))) {
          const isActive = button.dataset.value === next;
          button.classList.toggle('is-active', isActive);
          button.setAttribute('aria-checked', String(isActive));
        }
        cropRect = null;
        lassoPoints = [];
        shapeEnd = null;
        selectionBar.style.display = next === 'crop' ? '' : 'none';
        updateCropBar();
        const hints: Record<EditorTool, [string, string]> = {
          brush: [
            'Drag on the canvas to paint. The topmost raster layer receives the stroke.',
            'Рисуйте по холсту. Штрих попадает на верхний растровый слой.',
          ],
          fill: [
            'Click a color region to flood fill it on the active raster layer with the brush color.',
            'Нажмите на область, чтобы залить её цветом кисти на активном растровом слое.',
          ],
          shape: [
            'Drag to draw a rectangle, ellipse, line or arrow. Shapes use the brush color and opacity.',
            'Потяните, чтобы нарисовать прямоугольник, эллипс, линию или стрелку. Фигуры используют цвет и прозрачность кисти.',
          ],
          move: [
            'Drag text or image layers to reposition them.',
            'Перетаскивайте текстовые слои и изображения, чтобы изменить их положение.',
          ],
          text: [
            'Click the canvas to add text, or click existing text to edit it.',
            'Нажмите на холст, чтобы добавить текст, или на существующий текст, чтобы изменить его.',
          ],
          crop: [
            'Drag a rectangle or lasso, then crop the whole document or cut the area out of the active raster layer.',
            'Нарисуйте прямоугольник или лассо, затем обрежьте весь документ или вырежьте область из активного растрового слоя.',
          ],
        };
        hint.textContent = ctx.pick(hints[next][0], hints[next][1]);
        scheduleRender();
      };

      const renderLayerList = (): void => {
        layerList.replaceChildren();
        for (let index = layers.length - 1; index >= 0; index--) {
          const layer = layers[index];
          const eye = iconBtn(
            layer.visible ? ICONS.eye : ICONS.eyeOff,
            layer.visible ? ctx.pick('Hide layer', 'Скрыть слой') : ctx.pick('Show layer', 'Показать слой'),
            () => {
              layer.visible = !layer.visible;
              renderLayerList();
              scheduleRender();
            },
            { variant: 'subtle', class: 'dt-ie-eye' },
          );
          const row = h(
            'div',
            { class: `dt-ie-layer-row ${layer.id === activeId ? 'is-active' : ''}` },
            eye,
            h(
              'button',
              {
                class: 'dt-ie-layer',
                type: 'button',
                title: layer.name,
                onclick: () => selectLayer(layer.id),
              },
              h('span', { class: 'dt-ie-layer-name' }, layer.name),
              h('span', { class: 'dt-ie-layer-kind' }, kindLabel(layer.kind)),
            ),
            iconBtn(ICONS.up, ctx.pick('Move up', 'Выше'), () => moveLayer(layer.id, 1), {
              variant: 'subtle',
              class: 'dt-ie-order',
            }),
            iconBtn(ICONS.down, ctx.pick('Move down', 'Ниже'), () => moveLayer(layer.id, -1), {
              variant: 'subtle',
              class: 'dt-ie-order',
            }),
          );
          layerList.appendChild(row);
        }
        if (!layers.length) layerList.appendChild(note(ctx.pick('No layers yet.', 'Слоёв пока нет.'), 'info'));
      };

      const syncPosFields = (layer: TextLayer | ImageLayer): void => {
        if (!posRefs || posRefs.id !== layer.id) return;
        posRefs.x.value = String(Math.round(layer.x));
        posRefs.y.value = String(Math.round(layer.y));
      };

      const positionFields = (layer: TextLayer | ImageLayer): HTMLElement => {
        const xInput = textInput({
          type: 'number',
          value: Math.round(layer.x),
          oninput: (value) => {
            layer.x = Number(value) || 0;
            scheduleRender();
          },
        });
        const yInput = textInput({
          type: 'number',
          value: Math.round(layer.y),
          oninput: (value) => {
            layer.y = Number(value) || 0;
            scheduleRender();
          },
        });
        posRefs = { id: layer.id, x: xInput, y: yInput };
        return h('div', { class: 'dt-inline-form' }, field('X', xInput), field('Y', yInput));
      };

      function renderInspector(): void {
        textAreaRef = null;
        posRefs = null;
        inspector.replaceChildren();
        const layer = activeLayer();
        if (!layer) {
          inspector.appendChild(note(ctx.pick('Add a layer to start.', 'Добавьте слой, чтобы начать.'), 'info'));
          return;
        }

        inspector.appendChild(
          h(
            'div',
            { class: 'dt-row dt-ie-inspector-head' },
            badge(kindLabel(layer.kind)),
            h('span', { class: 'dt-ie-layer-title' }, layer.name),
          ),
        );
        inspector.appendChild(
          knobGrid(
            knobField(
              ctx.pick('Layer opacity', 'Прозрачность слоя'),
              0,
              100,
              Math.round(layer.opacity * 100),
              (value) => {
                layer.opacity = value / 100;
                scheduleRender();
              },
            ),
          ),
        );

        if (layer.kind === 'text') {
          const content = area({
            value: layer.text,
            rows: 2,
            mono: false,
            oninput: (value) => {
              layer.text = value;
              scheduleRender();
            },
          });
          textAreaRef = content;
          inspector.appendChild(field(ctx.pick('Text', 'Текст'), content));
          inspector.appendChild(
            field(
              ctx.pick('Font', 'Шрифт'),
              select(FONTS, layer.family, (value) => {
                layer.family = value;
                scheduleRender();
              }),
            ),
          );
          const color = h('input', { type: 'color', class: 'dt-color-input', value: layer.color });
          color.addEventListener('input', () => {
            layer.color = color.value;
            scheduleRender();
          });
          inspector.appendChild(
            field(
              ctx.pick('Color & style', 'Цвет и стиль'),
              h(
                'div',
                { class: 'dt-inline-options' },
                color,
                checkbox(ctx.pick('Bold', 'Жирный'), layer.bold, (value) => {
                  layer.bold = value;
                  scheduleRender();
                }),
                checkbox(ctx.pick('Italic', 'Курсив'), layer.italic, (value) => {
                  layer.italic = value;
                  scheduleRender();
                }),
              ),
            ),
          );
          inspector.appendChild(
            knobGrid(
              knobField(ctx.pick('Font size', 'Размер шрифта'), 8, 200, layer.size, (value) => {
                layer.size = value;
                scheduleRender();
              }),
            ),
          );
          inspector.appendChild(
            field(
              ctx.pick('Alignment', 'Выравнивание'),
              segmented(
                [
                  { value: 'left', label: ctx.pick('Left', 'Слева'), title: ctx.pick('Align left', 'По левому краю') },
                  { value: 'center', label: ctx.pick('Center', 'Центр'), title: ctx.pick('Align center', 'По центру') },
                  { value: 'right', label: ctx.pick('Right', 'Справа'), title: ctx.pick('Align right', 'По правому краю') },
                ],
                layer.align,
                (value) => {
                  layer.align = value as Align;
                  scheduleRender();
                },
              ),
            ),
          );
          inspector.appendChild(positionFields(layer));
        } else if (layer.kind === 'image') {
          inspector.appendChild(
            knobGrid(
              knobField(ctx.pick('Scale', 'Масштаб'), 5, 400, Math.round(layer.scale * 100), (value) => {
                layer.scale = value / 100;
                scheduleRender();
              }),
            ),
          );
          inspector.appendChild(positionFields(layer));
          inspector.appendChild(
            h(
              'div',
              { class: 'dt-hint' },
              `${ctx.pick('Source', 'Исходник')}: ${layer.image.naturalWidth} × ${layer.image.naturalHeight}`,
            ),
          );
        } else {
          inspector.appendChild(
            h(
              'div',
              { class: 'dt-hint' },
              ctx.pick('Paint on this layer with the brush.', 'Рисуйте на этом слое кистью.'),
            ),
          );
          inspector.appendChild(
            toolbar(
              btn(
                ctx.pick('Fill layer', 'Залить слой'),
                () => {
                  pushUndo();
                  const target = layer.canvas.getContext('2d');
                  if (target) {
                    target.globalCompositeOperation = 'source-over';
                    target.fillStyle = brushColor;
                    target.fillRect(0, 0, docWidth, docHeight);
                  }
                  edited = true;
                  scheduleRender();
                },
                { variant: 'ghost' },
              ),
              btn(
                ctx.pick('Clear layer', 'Очистить слой'),
                () => {
                  pushUndo();
                  layer.canvas.getContext('2d')?.clearRect(0, 0, docWidth, docHeight);
                  edited = true;
                  scheduleRender();
                },
                { variant: 'ghost' },
              ),
            ),
          );
        }

        inspector.appendChild(
          toolbar(
            iconBtn(ICONS.duplicate, ctx.pick('Duplicate layer', 'Дублировать слой'), duplicateLayer),
            iconBtn(ICONS.trash, ctx.pick('Delete layer', 'Удалить слой'), deleteLayer, { variant: 'danger' }),
          ),
        );
      }

      const syncUi = (): void => {
        updateStats();
        renderLayerList();
        renderInspector();
        updateCropBar();
        updateHistory();
        scheduleRender();
      };

      // ---------- export ----------
      const exportImage = async (): Promise<void> => {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, docWidth);
        canvas.height = Math.max(1, docHeight);
        const target = canvas.getContext('2d');
        if (!target) return;
        if (exportFormat === 'image/jpeg') {
          target.fillStyle = '#ffffff';
          target.fillRect(0, 0, canvas.width, canvas.height);
        }
        drawLayers(target);
        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((value) => resolve(value), exportFormat, exportQuality);
        });
        if (!blob) {
          setError(error, ctx.pick('Export failed.', 'Не удалось экспортировать изображение.'));
          return;
        }
        downloadBlob(`image-editor.${exportFormat.split('/')[1]}`, blob);
      };

      const createDocument = (width: number, height: number): void => {
        pushUndo();
        docWidth = width;
        docHeight = height;
        layers = [createRasterLayer('#ffffff', ctx.pick('Background', 'Фон'))];
        activeId = layers[0].id;
        cropRect = null;
        lassoPoints = [];
        edited = false;
        setError(error, null);
        syncCanvasSize();
        syncUi();
      };

      const readDocumentSize = (): { width: number; height: number } | null => {
        const width = Math.round(Number(sizeWidth.value));
        const height = Math.round(Number(sizeHeight.value));
        if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
          setError(
            error,
            ctx.pick('Enter a width and height of at least 1 px.', 'Укажите ширину и высоту не меньше 1 px.'),
          );
          return null;
        }
        return { width: clamp(width, 1, 8000), height: clamp(height, 1, 8000) };
      };

      const newDocumentFromInputs = (): void => {
        const size = readDocumentSize();
        if (!size) return;
        createDocument(size.width, size.height);
      };

      const resizeDocument = (): void => {
        const size = readDocumentSize();
        if (!size) return;
        if (size.width === docWidth && size.height === docHeight) {
          setError(error, null);
          return;
        }
        pushUndo();
        const scaleX = size.width / docWidth;
        const scaleY = size.height / docHeight;
        const uniform = Math.min(scaleX, scaleY);
        for (const layer of layers) {
          if (layer.kind === 'raster') {
            const next = document.createElement('canvas');
            next.width = size.width;
            next.height = size.height;
            const target = next.getContext('2d');
            if (target) {
              target.imageSmoothingEnabled = true;
              target.imageSmoothingQuality = 'high';
              if (scaleContent) {
                target.drawImage(layer.canvas, 0, 0, docWidth, docHeight, 0, 0, size.width, size.height);
              } else {
                target.drawImage(layer.canvas, 0, 0);
              }
            }
            layer.canvas = next;
            continue;
          }
          if (!scaleContent) continue;
          layer.x *= scaleX;
          layer.y *= scaleY;
          if (layer.kind === 'text') {
            layer.size = Math.max(1, Math.round(layer.size * uniform));
          } else {
            layer.scale *= uniform;
          }
        }
        docWidth = size.width;
        docHeight = size.height;
        cropRect = null;
        edited = true;
        setError(error, null);
        syncCanvasSize();
        syncUi();
      };

      // ---------- brush controls ----------
      const brushColorInput = h('input', { type: 'color', class: 'dt-color-input', value: brushColor });
      brushColorInput.addEventListener('input', () => {
        brushColor = brushColorInput.value;
      });
      const brushPane = pane(
        ctx.pick('Brush', 'Кисть'),
        h(
          'div',
          { class: 'dt-stack' },
          field(ctx.pick('Color', 'Цвет'), brushColorInput),
          knobGrid(
            knobField(ctx.pick('Size', 'Размер'), 1, 200, brushSize, (value) => {
              brushSize = value;
            }),
            knobField(ctx.pick('Opacity', 'Непрозрачность'), 5, 100, Math.round(brushOpacity * 100), (value) => {
              brushOpacity = value / 100;
            }),
          ),
          field(
            ctx.pick('Mode', 'Режим'),
            segmented(
              [
                { value: 'paint', label: ctx.pick('Paint', 'Кисть') },
                { value: 'erase', label: ctx.pick('Erase', 'Ластик') },
              ],
              brushMode,
              (value) => {
                brushMode = value === 'erase' ? 'erase' : 'paint';
              },
            ),
          ),
        ),
      );

      // ---------- shape controls ----------
      const shapePane = pane(
        ctx.pick('Shapes & lines', 'Фигуры и линии'),
        h(
          'div',
          { class: 'dt-stack' },
          field(
            ctx.pick('Shape', 'Фигура'),
            segmented(
              [
                { value: 'rect', label: ctx.pick('Rect', 'Прям.') },
                { value: 'ellipse', label: ctx.pick('Ellipse', 'Эллипс') },
                { value: 'line', label: ctx.pick('Line', 'Линия') },
                { value: 'arrow', label: ctx.pick('Arrow', 'Стрелка') },
              ],
              shapeMode,
              (value) => {
                shapeMode = value as ShapeMode;
              },
            ),
          ),
          checkbox(ctx.pick('Filled', 'Заливка'), shapeFilled, (value) => {
            shapeFilled = value;
          }),
          knobGrid(
            knobField(ctx.pick('Stroke width', 'Толщина линии'), 1, 60, shapeThickness, (value) => {
              shapeThickness = value;
            }),
          ),
          h(
            'div',
            { class: 'dt-hint' },
            ctx.pick(
              'Shapes and lines use the brush color and opacity.',
              'Фигуры и линии используют цвет и непрозрачность кисти.',
            ),
          ),
        ),
      );

      // ---------- export controls ----------
      const documentPane = pane(
        ctx.pick('Document', 'Документ'),
        h(
          'div',
          { class: 'dt-stack' },
          field(ctx.pick('Preset', 'Пресет'), sizePreset),
          h(
            'div',
            { class: 'dt-ie-size-row' },
            field(ctx.pick('Width', 'Ширина'), sizeWidth),
            field(ctx.pick('Height', 'Высота'), sizeHeight),
          ),
          checkbox(ctx.pick('Scale content', 'Масштабировать содержимое'), scaleContent, (value) => {
            scaleContent = value;
          }),
          toolbar(
            btn(ctx.pick('Resize', 'Изменить размер'), resizeDocument, { variant: 'primary' }),
            btn(ctx.pick('New document', 'Новый документ'), newDocumentFromInputs, { variant: 'ghost' }),
          ),
          h(
            'div',
            { class: 'dt-hint' },
            ctx.pick(
              'Without scaling, content stays in the top-left corner and may be cropped.',
              'Без масштабирования содержимое остаётся в левом верхнем углу и может обрезаться.',
            ),
          ),
        ),
      );

      const exportPane = pane(
        ctx.pick('Export', 'Экспорт'),
        h(
          'div',
          { class: 'dt-stack' },
          field(
            ctx.pick('Format', 'Формат'),
            select(
              [
                { value: 'image/png', label: 'PNG' },
                { value: 'image/jpeg', label: 'JPEG' },
                { value: 'image/webp', label: 'WebP' },
              ],
              exportFormat,
              (value) => {
                exportFormat = value as ExportFormat;
              },
            ),
          ),
          knobGrid(
            knobField(ctx.pick('Quality', 'Качество'), 10, 100, Math.round(exportQuality * 100), (value) => {
              exportQuality = value / 100;
            }),
          ),
          toolbar(
            btn(ctx.pick('Download image', 'Скачать изображение'), () => void exportImage(), {
              variant: 'primary',
              icon: ICONS.download,
            }),
          ),
        ),
      );

      // ---------- image input ----------
      const imageInput = h('input', { type: 'file', accept: 'image/*', class: 'dt-hidden' });
      imageInput.addEventListener('change', () => {
        const file = imageInput.files?.[0];
        if (file) void addImageLayer(file);
        imageInput.value = '';
      });
      const openImagePicker = (): void => imageInput.click();

      const dropZone = fileDrop({
        accept: 'image/*',
        hint: ctx.pick('Drop an image to add it as a layer', 'Перетащите изображение, чтобы добавить слой'),
        onFiles: (files) => {
          if (files[0]) void addImageLayer(files[0]);
        },
      });

      // ---------- keyboard ----------
      root.addEventListener('keydown', (event) => {
        const target = event.target as HTMLElement | null;
        if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
        const meta = event.ctrlKey || event.metaKey;
        const key = event.key.toLowerCase();
        if (meta && key === 'z') {
          event.preventDefault();
          if (event.shiftKey) redo();
          else undo();
          return;
        }
        if (meta && key === 'y') {
          event.preventDefault();
          redo();
          return;
        }
        if (key === 'delete' || key === 'backspace') {
          event.preventDefault();
          deleteLayer();
          return;
        }
        if (meta || event.altKey) return;
        if (key === 'b') setTool('brush');
        else if (key === 'f') setTool('fill');
        else if (key === 's') setTool('shape');
        else if (key === 'm') setTool('move');
        else if (key === 't') setTool('text');
        else if (key === 'c') setTool('crop');
      });

      // ---------- layout ----------
      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          error,
          resizableSplit(
            h(
              'div',
              { class: 'dt-col' },
              toolbar(toolSegment),
              selectionBar,
              pane(
                ctx.pick('Canvas', 'Холст'),
                h('div', { class: 'dt-stack' }, dropZone, stage, cropBar),
                [undoBtn, redoBtn, docStats],
                '',
                { collapsible: false },
              ),
              hint,
            ),
            h(
              'div',
              { class: 'dt-col' },
              pane(ctx.pick('Layers', 'Слои'), layerList, [
                iconBtn(ICONS.plus, ctx.pick('Add raster layer', 'Добавить растровый слой'), addRasterLayer),
                iconBtn(
                  ICONS.text,
                  ctx.pick('Add text layer', 'Добавить текстовый слой'),
                  () => {
                    addTextLayer(docWidth * 0.1, docHeight * 0.4);
                    requestAnimationFrame(() => textAreaRef?.focus());
                  },
                  { variant: 'subtle' },
                ),
                iconBtn(ICONS.image, ctx.pick('Add image layer', 'Добавить изображение'), openImagePicker, {
                  variant: 'subtle',
                }),
                iconBtn(ICONS.trash, ctx.pick('Delete active layer', 'Удалить активный слой'), deleteLayer, {
                  variant: 'danger',
                }),
              ]),
              pane(ctx.pick('Layer properties', 'Свойства слоя'), inspector),
              brushPane,
              shapePane,
              documentPane,
              exportPane,
            ),
            {
              ratio: 0.68,
              minSide: 340,
              className: 'dt-ie-split',
              title: ctx.pick('Drag to resize the canvas area', 'Потяните, чтобы изменить ширину холста'),
            },
          ),
        ),
      );
      root.appendChild(imageInput);

      // ---------- boot ----------
      syncCanvasSize();
      layers = [createRasterLayer('#ffffff', ctx.pick('Background', 'Фон'))];
      activeId = layers[0].id;
      syncUi();
      setTool('brush');
      const incoming = ctx.takeIncoming();
      if (incoming) void addImageFromSource(incoming.dataUrl, incoming.name.replace(/\.[^.]+$/, ''));
    },
  });
}

export const imageEditorTools = [imageEditorTool()];
