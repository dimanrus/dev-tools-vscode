/** Vector editor: shapes, freehand lines, SVG import/export and markup editing. */
import {
  area,
  badge,
  btn,
  checkbox,
  copyText,
  downloadBlob,
  errorSlot,
  field,
  fileDrop,
  iconBtn,
  note,
  pane,
  knobField as rangeField,
  readText,
  resizableSplit,
  select,
  setError,
  textInput,
  toolbar,
} from '../components.ts';
import { clamp, escapeHtml, h } from '../dom.ts';
import { dataUrlToText } from '../lib/incoming.ts';
import { defineTool } from '../tool-types.ts';

type VecTool = 'select' | 'rect' | 'ellipse' | 'line' | 'arrow' | 'pencil' | 'text' | 'fill';
type Matrix = [number, number, number, number, number, number];

interface Point {
  x: number;
  y: number;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Style {
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
  opacity: number;
}

interface RectGeom {
  kind: 'rect';
  w: number;
  h: number;
  radius: number;
}

interface EllipseGeom {
  kind: 'ellipse';
  rx: number;
  ry: number;
}

interface LineGeom {
  kind: 'line';
  dx: number;
  dy: number;
  arrow: boolean;
}

interface PolyGeom {
  kind: 'polyline' | 'polygon';
  points: Point[];
}

interface PathGeom {
  kind: 'path';
  d: string;
}

interface TextGeom {
  kind: 'text';
  text: string;
  size: number;
  family: string;
  bold: boolean;
  italic: boolean;
}

type Geometry = RectGeom | EllipseGeom | LineGeom | PolyGeom | PathGeom | TextGeom;

interface Shape extends Style {
  id: number;
  geom: Geometry;
  matrix: Matrix;
}

interface State {
  width: number;
  height: number;
  shapes: Shape[];
}

interface VecDrag {
  mode: 'create' | 'move' | 'resize' | 'pencil';
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  startMatrix: Matrix;
  startBox: Box;
  corner: 'nw' | 'ne' | 'se' | 'sw' | null;
  shapeId: number;
}

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

const FONTS = [
  { value: 'system-ui, sans-serif', label: 'System' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: '"Segoe UI", sans-serif', label: 'Segoe UI' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: '"Courier New", monospace', label: 'Courier' },
];

const ICONS = {
  select: '<path d="M7.904 17.563a1.2 1.2 0 0 0 2.228 .308l2.09 -3.096l4.621 4.621a1.2 1.2 0 0 0 1.697 0l1.414 -1.414a1.2 1.2 0 0 0 0 -1.697l-4.62 -4.62l3.095 -2.091a1.2 1.2 0 0 0 -.308 -2.228l-10.994 -3.14a1.2 1.2 0 0 0 -1.487 1.487z"/>',
  rect: '<path d="M4 5a1 1 0 0 1 1 -1h14a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-14a1 1 0 0 1 -1 -1z"/>',
  ellipse: '<path d="M12 12m-9 0a9 7 0 1 0 18 0a9 7 0 1 0 -18 0"/>',
  line: '<path d="M4 20l16 -16"/>',
  arrow: '<path d="M4 12h16"/><path d="M15 7l5 5l-5 5"/>',
  pencil: '<path d="M4 20h4l10 -10a2.4 2.4 0 0 0 -3.4 -3.4l-10 10z"/><path d="M13.5 6.5l3.4 3.4"/>',
  text: '<path d="M4 6v-1h16v1"/><path d="M12 5v14"/><path d="M9 19h6"/>',
  fill: '<path d="M19 11l-8 -8l-8.5 8.5a2 2 0 0 0 0 2.83l5.17 5.17a2 2 0 0 0 2.83 0z"/><path d="M5 12h14"/><path d="M19 16v3a2 2 0 0 1 -4 0v-3"/>',
  undo: '<path d="M9 14l-4 -4l4 -4"/><path d="M5 10h11a4 4 0 1 1 0 8h-1"/>',
  redo: '<path d="M15 14l4 -4l-4 -4"/><path d="M19 10h-11a4 4 0 1 0 0 8h1"/>',
  trash: '<path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"/><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3"/>',
  duplicate: '<path d="M7 7m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z"/><path d="M5 15v-8a2 2 0 0 1 2 -2h8"/>',
  front: '<path d="M12 3l9 5l-9 5l-9 -5z"/><path d="M3 13l9 5l9 -5"/>',
  back: '<path d="M4 15l8 4l8 -4"/><path d="M4 9l8 4l8 -4"/><path d="M12 3l8 4l-8 4l-8 -4z"/>',
  download: '<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2"/><path d="M7 11l5 5l5 -5"/><path d="M12 4l0 12"/>',
} as const;

const multiply = (left: Matrix, right: Matrix): Matrix => [
  left[0] * right[0] + left[2] * right[1],
  left[1] * right[0] + left[3] * right[1],
  left[0] * right[2] + left[2] * right[3],
  left[1] * right[2] + left[3] * right[3],
  left[0] * right[4] + left[2] * right[5] + left[4],
  left[1] * right[4] + left[3] * right[5] + left[5],
];

const translate = (x: number, y: number): Matrix => [1, 0, 0, 1, x, y];

const applyMatrix = (matrix: Matrix, point: Point): Point => ({
  x: matrix[0] * point.x + matrix[2] * point.y + matrix[4],
  y: matrix[1] * point.x + matrix[3] * point.y + matrix[5],
});

const invertMatrix = (matrix: Matrix): Matrix => {
  const det = matrix[0] * matrix[3] - matrix[1] * matrix[2];
  if (!det) return IDENTITY;
  return [
    matrix[3] / det,
    -matrix[1] / det,
    -matrix[2] / det,
    matrix[0] / det,
    (matrix[2] * matrix[5] - matrix[3] * matrix[4]) / det,
    (matrix[1] * matrix[4] - matrix[0] * matrix[5]) / det,
  ];
};

const matrixScale = (matrix: Matrix): number =>
  Math.sqrt(Math.abs(matrix[0] * matrix[3] - matrix[1] * matrix[2])) || 1;

const parseTransform = (value: string | null): Matrix => {
  if (!value) return IDENTITY;
  let result: Matrix = [...IDENTITY];
  const pattern = /(matrix|translate|scale|rotate)\s*\(([^)]*)\)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value))) {
    const numbers = match[2]
      .split(/[\s,]+/)
      .map((part) => Number.parseFloat(part))
      .filter((number) => Number.isFinite(number));
    let next: Matrix = [...IDENTITY];
    if (match[1] === 'matrix' && numbers.length >= 6) {
      next = [numbers[0], numbers[1], numbers[2], numbers[3], numbers[4], numbers[5]];
    } else if (match[1] === 'translate') {
      next = translate(numbers[0] ?? 0, numbers[1] ?? 0);
    } else if (match[1] === 'scale') {
      next = [numbers[0] ?? 1, 0, 0, numbers[1] ?? numbers[0] ?? 1, 0, 0];
    } else if (match[1] === 'rotate') {
      const angle = ((numbers[0] ?? 0) * Math.PI) / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      next = [cos, sin, -sin, cos, 0, 0];
    }
    result = multiply(result, next);
  }
  return result;
};

const fmt = (value: number): string => String(Math.round(value * 1000) / 1000);

const normalizeColor = (value: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'none' || trimmed === 'transparent') return null;
  return trimmed === 'currentColor' ? '#000000' : trimmed;
};

const readStyleMap = (element: Element): Record<string, string> => {
  const map: Record<string, string> = {};
  const style = element.getAttribute('style');
  if (!style) return map;
  for (const part of style.split(';')) {
    const separator = part.indexOf(':');
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key) map[key] = value;
  }
  return map;
};

function vectorEditorTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'graphic-vector-editor',
    group: 'graphic',
    icon: '<path d="M3 4a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z"/><path d="M17 4a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z"/><path d="M3 18a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z"/><path d="M17 18a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z"/><path d="M5 7v10"/><path d="M19 7v10"/><path d="M7 5h10"/><path d="M7 19h10"/>',
    name: { en: 'Vector Editor', ru: 'Векторный редактор' },
    desc: {
      en: 'Draw shapes, freehand lines and arrows, edit SVG markup, import and export vector graphics.',
      ru: 'Рисование фигур, линий и стрелок, редактирование SVG-кода, импорт и экспорт векторной графики.',
    },
    keywords: 'svg vector shapes rect ellipse line arrow path polygon pencil draw edit markup export',
    mount(root, ctx) {
      // ---------- document state ----------
      let docWidth = 800;
      let docHeight = 600;
      let shapes: Shape[] = [];
      let selectedId = 0;
      let nextId = 1;
      let tool: VecTool = 'select';
      let drag: VecDrag | null = null;
      let frame = 0;
      let exportScale = 1;
      let zoom = 1;
      const undoStack: string[] = [];
      const redoStack: string[] = [];
      const defaults: Style = { fill: '#3b82f6', stroke: '#1e3a8a', strokeWidth: 2, opacity: 1 };

      const measure = document.createElement('canvas').getContext('2d');
      if (!measure) throw new Error('Canvas 2D is not available');
      const measureSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      measureSvg.setAttribute('width', '0');
      measureSvg.setAttribute('height', '0');
      measureSvg.style.position = 'absolute';
      measureSvg.style.left = '-9999px';
      measureSvg.style.opacity = '0';

      // ---------- elements ----------
      const error = errorSlot();
      const stage = h('div', { class: 'dt-ie-stage', tabindex: 0, dataset: { vtool: 'select' } });
      const display = h('canvas', { class: 'dt-ie-canvas' });
      stage.appendChild(display);
      const hint = h('div', { class: 'dt-hint' });
      const stats = h('span', { class: 'dt-ie-stats dt-hint' });
      const shapeList = h('div', { class: 'dt-ie-layers' });
      const inspector = h('div', { class: 'dt-stack' });
      const sourceArea = area({ rows: 8, placeholder: '<svg>…</svg>' });
      const sizeWidth = textInput({ type: 'number', value: docWidth, min: 1, max: 8000 });
      const sizeHeight = textInput({ type: 'number', value: docHeight, min: 1, max: 8000 });
      const toolButtons = new Map<VecTool, HTMLButtonElement>();

      let textInputRef: HTMLInputElement | null = null;

      const undoBtn = iconBtn(ICONS.undo, ctx.pick('Undo (Ctrl+Z)', 'Отменить (Ctrl+Z)'), () => undo(), {
        variant: 'subtle',
        disabled: true,
      });
      const redoBtn = iconBtn(ICONS.redo, ctx.pick('Redo (Ctrl+Shift+Z)', 'Повторить (Ctrl+Shift+Z)'), () => redo(), {
        variant: 'subtle',
        disabled: true,
      });

      // ---------- geometry ----------
      const selected = (): Shape | undefined => shapes.find((shape) => shape.id === selectedId);

      const fontOf = (geom: TextGeom): string =>
        `${geom.italic ? 'italic ' : ''}${geom.bold ? '700' : '400'} ${geom.size}px ${geom.family}`;

      const textBox = (geom: TextGeom): Box => {
        measure.font = fontOf(geom);
        const metrics = measure.measureText(geom.text || ' ');
        const ascent = metrics.actualBoundingBoxAscent || geom.size * 0.8;
        const descent = metrics.actualBoundingBoxDescent || geom.size * 0.2;
        return { x: 0, y: -ascent, w: Math.max(1, metrics.width), h: Math.max(1, ascent + descent) };
      };

      const pathBox = (d: string): Box => {
        const element = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        element.setAttribute('d', d);
        measureSvg.appendChild(element);
        let box: Box = { x: 0, y: 0, w: 1, h: 1 };
        try {
          const computed = element.getBBox();
          box = {
            x: computed.x,
            y: computed.y,
            w: Math.max(1, computed.width),
            h: Math.max(1, computed.height),
          };
        } catch {
          // Ignore malformed paths.
        }
        measureSvg.removeChild(element);
        return box;
      };

      const localBox = (shape: Shape): Box => {
        const geom = shape.geom;
        if (geom.kind === 'rect') return { x: 0, y: 0, w: geom.w, h: geom.h };
        if (geom.kind === 'ellipse') return { x: -geom.rx, y: -geom.ry, w: geom.rx * 2, h: geom.ry * 2 };
        if (geom.kind === 'line')
          return {
            x: Math.min(0, geom.dx),
            y: Math.min(0, geom.dy),
            w: Math.max(1, Math.abs(geom.dx)),
            h: Math.max(1, Math.abs(geom.dy)),
          };
        if (geom.kind === 'polyline' || geom.kind === 'polygon') {
          if (!geom.points.length) return { x: 0, y: 0, w: 1, h: 1 };
          const xs = geom.points.map((point) => point.x);
          const ys = geom.points.map((point) => point.y);
          const minX = Math.min(...xs);
          const minY = Math.min(...ys);
          return {
            x: minX,
            y: minY,
            w: Math.max(1, Math.max(...xs) - minX),
            h: Math.max(1, Math.max(...ys) - minY),
          };
        }
        if (geom.kind === 'text') return textBox(geom);
        return geom.kind === 'path' ? pathBox(geom.d) : { x: 0, y: 0, w: 1, h: 1 };
      };

      const shapeBox = (shape: Shape): Box => {
        const box = localBox(shape);
        const corners = [
          applyMatrix(shape.matrix, { x: box.x, y: box.y }),
          applyMatrix(shape.matrix, { x: box.x + box.w, y: box.y }),
          applyMatrix(shape.matrix, { x: box.x, y: box.y + box.h }),
          applyMatrix(shape.matrix, { x: box.x + box.w, y: box.y + box.h }),
        ];
        const xs = corners.map((point) => point.x);
        const ys = corners.map((point) => point.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        return { x: minX, y: minY, w: Math.max(1, Math.max(...xs) - minX), h: Math.max(1, Math.max(...ys) - minY) };
      };

      const localPath = (shape: Shape): Path2D | null => {
        const geom = shape.geom;
        if (geom.kind === 'text') return null;
        if (geom.kind === 'path') return new Path2D(geom.d);
        const path = new Path2D();
        if (geom.kind === 'rect') {
          if (geom.radius > 0) path.roundRect(0, 0, geom.w, geom.h, geom.radius);
          else path.rect(0, 0, geom.w, geom.h);
        } else if (geom.kind === 'ellipse') {
          path.ellipse(0, 0, geom.rx, geom.ry, 0, 0, Math.PI * 2);
        } else if (geom.kind === 'line') {
          path.moveTo(0, 0);
          path.lineTo(geom.dx, geom.dy);
        } else if (geom.kind === 'polyline' || geom.kind === 'polygon') {
          geom.points.forEach((point, index) => {
            if (index === 0) path.moveTo(point.x, point.y);
            else path.lineTo(point.x, point.y);
          });
          if (geom.kind === 'polygon') path.closePath();
        }
        return path;
      };

      const drawShape = (target: CanvasRenderingContext2D, shape: Shape): void => {
        target.save();
        target.globalAlpha = shape.opacity;
        target.transform(...shape.matrix);
        if (shape.geom.kind === 'text') {
          target.font = fontOf(shape.geom);
          target.textBaseline = 'alphabetic';
          if (shape.fill) {
            target.fillStyle = shape.fill;
            target.fillText(shape.geom.text, 0, 0);
          }
          if (shape.stroke) {
            target.strokeStyle = shape.stroke;
            target.lineWidth = shape.strokeWidth;
            target.strokeText(shape.geom.text, 0, 0);
          }
          target.restore();
          return;
        }
        const path = localPath(shape);
        if (shape.geom.kind === 'line') {
          const geom = shape.geom;
          if (shape.stroke) {
            target.strokeStyle = shape.stroke;
            target.lineWidth = shape.strokeWidth;
            target.lineCap = 'round';
            target.beginPath();
            target.moveTo(0, 0);
            target.lineTo(geom.dx, geom.dy);
            target.stroke();
            if (geom.arrow) {
              const angle = Math.atan2(geom.dy, geom.dx);
              const head = Math.max(10, shape.strokeWidth * 3.2);
              const spread = Math.PI / 7;
              target.beginPath();
              target.moveTo(geom.dx, geom.dy);
              target.lineTo(geom.dx - head * Math.cos(angle - spread), geom.dy - head * Math.sin(angle - spread));
              target.moveTo(geom.dx, geom.dy);
              target.lineTo(geom.dx - head * Math.cos(angle + spread), geom.dy - head * Math.sin(angle + spread));
              target.stroke();
            }
          }
          target.restore();
          return;
        }
        if (path) {
          if (shape.fill) {
            target.fillStyle = shape.fill;
            target.fill(path);
          }
          if (shape.stroke && shape.strokeWidth > 0) {
            target.strokeStyle = shape.stroke;
            target.lineWidth = shape.strokeWidth;
            target.lineJoin = 'round';
            target.stroke(path);
          }
        }
        target.restore();
      };

      const renderShapes = (target: CanvasRenderingContext2D): void => {
        for (const shape of shapes) drawShape(target, shape);
      };

      const hitShape = (point: Point, includeInterior = false): Shape | undefined => {
        const target = display.getContext('2d');
        for (let index = shapes.length - 1; index >= 0; index--) {
          const shape = shapes[index];
          if (shape.opacity <= 0) continue;
          const local = applyMatrix(invertMatrix(shape.matrix), point);
          const box = localBox(shape);
          if (shape.geom.kind === 'text') {
            if (local.x >= box.x && local.x <= box.x + box.w && local.y >= box.y && local.y <= box.y + box.h) {
              return shape;
            }
            continue;
          }
          const path = localPath(shape);
          if (!path || !target) continue;
          target.save();
          target.setTransform(1, 0, 0, 1, 0, 0);
          let hit = shape.fill || includeInterior ? target.isPointInPath(path, local.x, local.y) : false;
          if (!hit && (shape.stroke || shape.geom.kind === 'line')) {
            const tolerance = 6 / matrixScale(shape.matrix);
            target.lineWidth = Math.max(shape.strokeWidth, 1) + tolerance;
            hit = target.isPointInStroke(path, local.x, local.y);
          }
          target.restore();
          if (hit) return shape;
        }
        return undefined;
      };

      // ---------- history ----------
      const capture = (): string => JSON.stringify({ width: docWidth, height: docHeight, shapes } satisfies State);

      const pushHistory = (): void => {
        undoStack.push(capture());
        if (undoStack.length > 40) undoStack.shift();
        redoStack.length = 0;
        updateHistory();
      };

      const updateHistory = (): void => {
        undoBtn.disabled = undoStack.length === 0;
        redoBtn.disabled = redoStack.length === 0;
      };

      const loadState = (json: string): void => {
        const state = JSON.parse(json) as State;
        docWidth = state.width;
        docHeight = state.height;
        shapes = state.shapes;
        selectedId = 0;
        syncCanvasSize();
        syncUi();
      };

      function undo(): void {
        const previous = undoStack.pop();
        if (!previous) return;
        redoStack.push(capture());
        loadState(previous);
        updateHistory();
      }

      function redo(): void {
        const next = redoStack.pop();
        if (!next) return;
        undoStack.push(capture());
        loadState(next);
        updateHistory();
      }

      // ---------- SVG serialization ----------
      const styleAttrs = (shape: Shape): string =>
        `fill="${shape.fill ?? 'none'}" stroke="${shape.stroke ?? 'none'}" stroke-width="${fmt(
          shape.strokeWidth,
        )}" opacity="${fmt(shape.opacity)}"`;

      const transformAttr = (matrix: Matrix): string =>
        matrix.every((value, index) => Math.abs(value - IDENTITY[index]) < 0.0001)
          ? ''
          : ` transform="matrix(${matrix.map(fmt).join(' ')})"`;

      const serializeShape = (shape: Shape): string => {
        const geom = shape.geom;
        const attrs = `${styleAttrs(shape)}${transformAttr(shape.matrix)}`;
        if (geom.kind === 'rect') {
          return `<rect x="0" y="0" width="${fmt(geom.w)}" height="${fmt(geom.h)}" rx="${fmt(
            geom.radius,
          )}" ${attrs}/>`;
        }
        if (geom.kind === 'ellipse') {
          return `<ellipse cx="0" cy="0" rx="${fmt(geom.rx)}" ry="${fmt(geom.ry)}" ${attrs}/>`;
        }
        if (geom.kind === 'line') {
          return `<line x1="0" y1="0" x2="${fmt(geom.dx)}" y2="${fmt(geom.dy)}" ${attrs}/>`;
        }
        if (geom.kind === 'polyline' || geom.kind === 'polygon') {
          const points = geom.points.map((point) => `${fmt(point.x)},${fmt(point.y)}`).join(' ');
          return `<${geom.kind} points="${points}" ${attrs}/>`;
        }
        if (geom.kind === 'text') {
          return `<text x="0" y="0" font-size="${fmt(geom.size)}" font-family="${escapeHtml(
            geom.family,
          )}" font-weight="${geom.bold ? 700 : 400}" font-style="${
            geom.italic ? 'italic' : 'normal'
          }" ${attrs}>${escapeHtml(geom.text)}</text>`;
        }
        return geom.kind === 'path' ? `<path d="${escapeHtml(geom.d)}" ${attrs}/>` : '';
      };

      const svgMarkup = (): string =>
        `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(docWidth)}" height="${fmt(
          docHeight,
        )}" viewBox="0 0 ${fmt(docWidth)} ${fmt(docHeight)}">\n${shapes
          .map((shape) => `  ${serializeShape(shape)}`)
          .join('\n')}\n</svg>`;

      // ---------- SVG import ----------
      interface Inherited extends Style {
        fontSize: number;
        family: string;
        bold: boolean;
        italic: boolean;
      }

      const parseSvg = (markup: string): boolean => {
        const parsed = new DOMParser().parseFromString(markup, 'image/svg+xml');
        if (parsed.querySelector('parsererror') || parsed.documentElement.nodeName !== 'svg') {
          setError(error, ctx.pick('Invalid SVG markup.', 'Некорректный SVG-код.'));
          return false;
        }
        const source = parsed.documentElement;
        const viewBox = (source.getAttribute('viewBox') ?? '')
          .split(/[\s,]+/)
          .map((part) => Number.parseFloat(part))
          .filter((value) => Number.isFinite(value));
        const widthAttr = Number.parseFloat(source.getAttribute('width') ?? '');
        const heightAttr = Number.parseFloat(source.getAttribute('height') ?? '');
        const width = widthAttr || viewBox[2] || docWidth || 800;
        const height = heightAttr || viewBox[3] || docHeight || 600;
        const collected: Shape[] = [];
        const rootMatrix = multiply(
          viewBox.length === 4 && viewBox[2] > 0 && viewBox[3] > 0
            ? multiply([width / viewBox[2], 0, 0, height / viewBox[3], 0, 0], translate(-viewBox[0], -viewBox[1]))
            : IDENTITY,
          IDENTITY,
        );

        const createShape = (geom: Geometry, matrix: Matrix, inherited: Inherited): void => {
          collected.push({
            id: nextId++,
            geom,
            matrix,
            fill: inherited.fill,
            stroke: inherited.stroke,
            strokeWidth: inherited.strokeWidth,
            opacity: inherited.opacity,
          });
        };

        const readInherited = (element: Element, parent: Inherited): Inherited => {
          const map = readStyleMap(element);
          const attr = (name: string): string | null => element.getAttribute(name) ?? map[name] ?? null;
          const fill = attr('fill');
          const stroke = attr('stroke');
          const width = attr('stroke-width');
          const opacity = attr('opacity');
          const size = attr('font-size');
          const family = attr('font-family');
          const weight = attr('font-weight');
          const italic = attr('font-style');
          const parsedWidth = width ? Number.parseFloat(width) : Number.NaN;
          const parsedOpacity = opacity ? Number.parseFloat(opacity) : Number.NaN;
          return {
            fill: fill === null ? parent.fill : normalizeColor(fill),
            stroke: stroke === null ? parent.stroke : normalizeColor(stroke),
            strokeWidth: Number.isFinite(parsedWidth) ? parsedWidth : parent.strokeWidth,
            opacity: Number.isFinite(parsedOpacity) ? parent.opacity * parsedOpacity : parent.opacity,
            fontSize: size ? Number.parseFloat(size) || parent.fontSize : parent.fontSize,
            family: family ?? parent.family,
            bold: weight ? Number.parseFloat(weight) >= 600 || weight === 'bold' : parent.bold,
            italic: italic ? italic === 'italic' : parent.italic,
          };
        };

        const walk = (element: Element, matrix: Matrix, inherited: Inherited): void => {
          const tag = element.tagName.toLowerCase();
          if (['defs', 'title', 'desc', 'metadata', 'style', 'clippath', 'mask', 'lineargradient'].includes(tag)) return;
          const localMatrix = multiply(matrix, parseTransform(element.getAttribute('transform')));
          const style = readInherited(element, inherited);
          if (tag === 'g' || tag === 'svg') {
            for (const child of Array.from(element.children)) walk(child, localMatrix, style);
            return;
          }
          const number = (name: string, fallback = 0): number => {
            const value = Number.parseFloat(element.getAttribute(name) ?? '');
            return Number.isFinite(value) ? value : fallback;
          };
          if (tag === 'rect') {
            const radius = number('rx', number('ry', 0));
            createShape(
              { kind: 'rect', w: number('width'), h: number('height'), radius },
              multiply(localMatrix, translate(number('x'), number('y'))),
              style,
            );
          } else if (tag === 'circle') {
            const radius = number('r');
            createShape(
              { kind: 'ellipse', rx: radius, ry: radius },
              multiply(localMatrix, translate(number('cx'), number('cy'))),
              style,
            );
          } else if (tag === 'ellipse') {
            createShape(
              { kind: 'ellipse', rx: number('rx'), ry: number('ry') },
              multiply(localMatrix, translate(number('cx'), number('cy'))),
              style,
            );
          } else if (tag === 'line') {
            createShape(
              {
                kind: 'line',
                dx: number('x2') - number('x1'),
                dy: number('y2') - number('y1'),
                arrow: false,
              },
              multiply(localMatrix, translate(number('x1'), number('y1'))),
              style,
            );
          } else if (tag === 'polyline' || tag === 'polygon') {
            const values = (element.getAttribute('points') ?? '')
              .split(/[\s,]+/)
              .map((part) => Number.parseFloat(part))
              .filter((value) => Number.isFinite(value));
            const points: Point[] = [];
            for (let index = 0; index + 1 < values.length; index += 2) {
              points.push({ x: values[index], y: values[index + 1] });
            }
            if (points.length) createShape({ kind: tag, points }, localMatrix, style);
          } else if (tag === 'path') {
            const d = element.getAttribute('d');
            if (d) createShape({ kind: 'path', d }, localMatrix, style);
          } else if (tag === 'text') {
            createShape(
              {
                kind: 'text',
                text: (element.textContent ?? '').trim(),
                size: style.fontSize,
                family: style.family,
                bold: style.bold,
                italic: style.italic,
              },
              multiply(localMatrix, translate(number('x'), number('y'))),
              style,
            );
          }
        };

        walk(
          source,
          rootMatrix,
          {
            fill: '#000000',
            stroke: null,
            strokeWidth: 1,
            opacity: 1,
            fontSize: 16,
            family: 'system-ui, sans-serif',
            bold: false,
            italic: false,
          },
        );

        pushHistory();
        docWidth = Math.max(1, Math.round(width));
        docHeight = Math.max(1, Math.round(height));
        shapes = collected;
        selectedId = 0;
        syncCanvasSize();
        setError(error, null);
        syncUi();
        return true;
      };

      // ---------- rendering ----------
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
        stats.textContent = `${Math.round(docWidth)} × ${Math.round(docHeight)} · ${ctx.pick(
          `${shapes.length} shape${shapes.length === 1 ? '' : 's'}`,
          `${shapes.length} фигур`,
        )}${zoom === 1 ? '' : ` · ${Math.round(zoom * 100)}%`}`;
      };

      const paint = (): void => {
        const target = display.getContext('2d');
        if (!target) return;
        target.clearRect(0, 0, docWidth, docHeight);
        renderShapes(target);
        const shape = selected();
        if (!shape) return;
        const box = shapeBox(shape);
        const line = Math.max(1, docWidth / 640);
        const handle = Math.max(4, Math.min(docWidth, docHeight) / 90);
        target.save();
        target.strokeStyle = 'rgba(59,130,246,0.95)';
        target.lineWidth = line;
        target.setLineDash([line * 5, line * 4]);
        target.strokeRect(box.x, box.y, box.w, box.h);
        target.setLineDash([]);
        target.fillStyle = '#ffffff';
        for (const [x, y] of [
          [box.x, box.y],
          [box.x + box.w, box.y],
          [box.x, box.y + box.h],
          [box.x + box.w, box.y + box.h],
        ]) {
          target.fillRect(x - handle, y - handle, handle * 2, handle * 2);
          target.strokeRect(x - handle, y - handle, handle * 2, handle * 2);
        }
        target.restore();
      };

      const scheduleRender = (): void => {
        if (frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          paint();
        });
      };

      // ---------- pointer handling ----------
      const toDoc = (event: PointerEvent): Point => {
        const rect = display.getBoundingClientRect();
        const scale = rect.width > 0 ? display.width / rect.width : 1;
        return {
          x: clamp((event.clientX - rect.left) * scale, 0, docWidth),
          y: clamp((event.clientY - rect.top) * scale, 0, docHeight),
        };
      };

      const newShape = (geom: Geometry, matrix: Matrix): Shape => ({
        id: nextId++,
        geom,
        matrix,
        fill: defaults.fill,
        stroke: defaults.stroke,
        strokeWidth: defaults.strokeWidth,
        opacity: defaults.opacity,
      });

      const selectShape = (id: number): void => {
        if (selectedId === id) return;
        selectedId = id;
        setError(error, null);
        renderShapeList();
        renderInspector();
        scheduleRender();
      };

      const cornerAt = (shape: Shape, point: Point): VecDrag['corner'] => {
        const box = shapeBox(shape);
        const handle = Math.max(4, Math.min(docWidth, docHeight) / 90) * 1.8;
        if (Math.abs(point.x - box.x) <= handle && Math.abs(point.y - box.y) <= handle) return 'nw';
        if (Math.abs(point.x - (box.x + box.w)) <= handle && Math.abs(point.y - box.y) <= handle) return 'ne';
        if (Math.abs(point.x - (box.x + box.w)) <= handle && Math.abs(point.y - (box.y + box.h)) <= handle)
          return 'se';
        if (Math.abs(point.x - box.x) <= handle && Math.abs(point.y - (box.y + box.h)) <= handle) return 'sw';
        return null;
      };

      const onPointerDown = (event: PointerEvent): void => {
        if (event.button !== 0) return;
        const point = toDoc(event);
        stage.focus();
        setError(error, null);

        if (tool === 'select') {
          const current = selected();
          const corner = current ? cornerAt(current, point) : null;
          if (current && corner) {
            pushHistory();
            drag = {
              mode: 'resize',
              startX: point.x,
              startY: point.y,
              lastX: point.x,
              lastY: point.y,
              startMatrix: [...current.matrix],
              startBox: shapeBox(current),
              corner,
              shapeId: current.id,
            };
            display.setPointerCapture(event.pointerId);
            return;
          }
          const hit = hitShape(point);
          if (!hit) {
            selectShape(0);
            return;
          }
          selectShape(hit.id);
          pushHistory();
          drag = {
            mode: 'move',
            startX: point.x,
            startY: point.y,
            lastX: point.x,
            lastY: point.y,
            startMatrix: [...hit.matrix],
            startBox: shapeBox(hit),
            corner: null,
            shapeId: hit.id,
          };
          display.setPointerCapture(event.pointerId);
          return;
        }

        if (tool === 'fill') {
          const hit = hitShape(point, true);
          if (!hit) return;
          selectShape(hit.id);
          pushHistory();
          hit.fill = defaults.fill;
          renderInspector();
          refreshSource();
          scheduleRender();
          return;
        }

        if (tool === 'text') {
          pushHistory();
          const shape = newShape(
            {
              kind: 'text',
              text: ctx.pick('Text', 'Текст'),
              size: Math.max(12, Math.round(docWidth / 22)),
              family: FONTS[0].value,
              bold: false,
              italic: false,
            },
            translate(point.x, point.y),
          );
          shape.fill = '#111827';
          shape.stroke = null;
          shapes.push(shape);
          selectedId = shape.id;
          syncUi();
          requestAnimationFrame(() => {
            textInputRef?.focus();
            textInputRef?.select();
          });
          return;
        }

        pushHistory();
        if (tool === 'rect' || tool === 'ellipse') {
          const shape =
            tool === 'rect'
              ? newShape({ kind: 'rect', w: 1, h: 1, radius: 0 }, translate(point.x, point.y))
              : newShape({ kind: 'ellipse', rx: 1, ry: 1 }, translate(point.x, point.y));
          shapes.push(shape);
          selectedId = shape.id;
          drag = {
            mode: 'create',
            startX: point.x,
            startY: point.y,
            lastX: point.x,
            lastY: point.y,
            startMatrix: translate(point.x, point.y),
            startBox: { x: point.x, y: point.y, w: 1, h: 1 },
            corner: null,
            shapeId: shape.id,
          };
          display.setPointerCapture(event.pointerId);
          renderShapeList();
          renderInspector();
          scheduleRender();
          return;
        }
        if (tool === 'line' || tool === 'arrow') {
          const shape = newShape(
            { kind: 'line', dx: 1, dy: 1, arrow: tool === 'arrow' },
            translate(point.x, point.y),
          );
          if (!defaults.stroke) shape.stroke = '#1e293b';
          shapes.push(shape);
          selectedId = shape.id;
          drag = {
            mode: 'create',
            startX: point.x,
            startY: point.y,
            lastX: point.x,
            lastY: point.y,
            startMatrix: translate(point.x, point.y),
            startBox: { x: point.x, y: point.y, w: 1, h: 1 },
            corner: null,
            shapeId: shape.id,
          };
          display.setPointerCapture(event.pointerId);
          renderShapeList();
          renderInspector();
          scheduleRender();
          return;
        }
        // pencil
        const shape = newShape({ kind: 'polyline', points: [{ x: 0, y: 0 }] }, translate(point.x, point.y));
        if (!shape.fill) shape.fill = null;
        shapes.push(shape);
        selectedId = shape.id;
        drag = {
          mode: 'pencil',
          startX: point.x,
          startY: point.y,
          lastX: point.x,
          lastY: point.y,
          startMatrix: translate(point.x, point.y),
          startBox: { x: point.x, y: point.y, w: 1, h: 1 },
          corner: null,
          shapeId: shape.id,
        };
        display.setPointerCapture(event.pointerId);
        renderShapeList();
        renderInspector();
        scheduleRender();
      };

      const onPointerMove = (event: PointerEvent): void => {
        if (!drag) return;
        const point = toDoc(event);
        const shape = shapes.find((item) => item.id === drag?.shapeId);
        if (!shape) return;
        if (drag.mode === 'move') {
          shape.matrix = [
            drag.startMatrix[0],
            drag.startMatrix[1],
            drag.startMatrix[2],
            drag.startMatrix[3],
            drag.startMatrix[4] + (point.x - drag.startX),
            drag.startMatrix[5] + (point.y - drag.startY),
          ];
          scheduleRender();
          return;
        }
        if (drag.mode === 'resize' && drag.corner) {
          const box = drag.startBox;
          let left = box.x;
          let top = box.y;
          let right = box.x + box.w;
          let bottom = box.y + box.h;
          if (drag.corner.includes('w')) left = Math.min(point.x, right - 2);
          if (drag.corner.includes('e')) right = Math.max(point.x, left + 2);
          if (drag.corner.includes('n')) top = Math.min(point.y, bottom - 2);
          if (drag.corner.includes('s')) bottom = Math.max(point.y, top + 2);
          const scaleX = (right - left) / box.w;
          const scaleY = (bottom - top) / box.h;
          const originX = drag.corner.includes('w') ? right : left;
          const originY = drag.corner.includes('n') ? bottom : top;
          shape.matrix = multiply(
            multiply(translate(originX, originY), [scaleX, 0, 0, scaleY, 0, 0]),
            multiply(translate(-originX, -originY), drag.startMatrix),
          );
          scheduleRender();
          return;
        }
        if (drag.mode === 'create') {
          const minX = Math.min(drag.startX, point.x);
          const minY = Math.min(drag.startY, point.y);
          const width = Math.max(1, Math.abs(point.x - drag.startX));
          const height = Math.max(1, Math.abs(point.y - drag.startY));
          if (shape.geom.kind === 'rect') {
            shape.geom.w = width;
            shape.geom.h = height;
            shape.matrix = translate(minX, minY);
          } else if (shape.geom.kind === 'ellipse') {
            shape.geom.rx = width / 2;
            shape.geom.ry = height / 2;
            shape.matrix = translate(minX + width / 2, minY + height / 2);
          } else if (shape.geom.kind === 'line') {
            shape.geom.dx = point.x - drag.startX;
            shape.geom.dy = point.y - drag.startY;
          }
          scheduleRender();
          return;
        }
        if (drag.mode === 'pencil' && shape.geom.kind === 'polyline') {
          const last = shape.geom.points[shape.geom.points.length - 1];
          const localX = point.x - drag.startX;
          const localY = point.y - drag.startY;
          if (!last || Math.hypot(localX - last.x, localY - last.y) > 2) {
            shape.geom.points.push({ x: localX, y: localY });
          }
          scheduleRender();
        }
      };

      const onPointerUp = (event: PointerEvent): void => {
        if (!drag) return;
        const shape = shapes.find((item) => item.id === drag?.shapeId);
        if (shape && drag.mode === 'create') {
          const box = shapeBox(shape);
          if (box.w < 2 && box.h < 2) {
            shapes = shapes.filter((item) => item.id !== shape.id);
            selectedId = 0;
          }
        }
        if (shape && drag.mode === 'pencil' && shape.geom.kind === 'polyline' && shape.geom.points.length < 2) {
          shapes = shapes.filter((item) => item.id !== shape.id);
          selectedId = 0;
        }
        drag = null;
        if (display.hasPointerCapture(event.pointerId)) display.releasePointerCapture(event.pointerId);
        syncUi();
      };

      display.addEventListener('pointerdown', onPointerDown);
      display.addEventListener('pointermove', onPointerMove);
      display.addEventListener('pointerup', onPointerUp);
      display.addEventListener('pointercancel', onPointerUp);

      // ---------- list & inspector ----------
      const kindLabel = (geom: Geometry): string => {
        if (geom.kind === 'rect') return ctx.pick('Rectangle', 'Прямоугольник');
        if (geom.kind === 'ellipse') return ctx.pick('Ellipse', 'Эллипс');
        if (geom.kind === 'line') return geom.arrow ? ctx.pick('Arrow', 'Стрелка') : ctx.pick('Line', 'Линия');
        if (geom.kind === 'polyline') return ctx.pick('Polyline', 'Ломаная');
        if (geom.kind === 'polygon') return ctx.pick('Polygon', 'Полигон');
        if (geom.kind === 'text') return ctx.pick('Text', 'Текст');
        return 'Path';
      };

      const setTool = (next: VecTool): void => {
        tool = next;
        stage.dataset.vtool = next;
        for (const [id, button] of toolButtons) {
          const active = id === next;
          button.classList.toggle('is-active', active);
          button.setAttribute('aria-pressed', String(active));
        }
        const hints: Record<VecTool, [string, string]> = {
          select: [
            'Click a shape to select it, drag to move, pull a corner handle to resize.',
            'Нажмите на фигуру, чтобы выбрать, перетащите для перемещения, потяните за угол для изменения размера.',
          ],
          rect: ['Drag to draw a rectangle.', 'Потяните, чтобы нарисовать прямоугольник.'],
          ellipse: ['Drag to draw an ellipse.', 'Потяните, чтобы нарисовать эллипс.'],
          line: ['Drag to draw a straight line.', 'Потяните, чтобы нарисовать линию.'],
          arrow: ['Drag to draw an arrow.', 'Потяните, чтобы нарисовать стрелку.'],
          pencil: ['Draw freehand polylines.', 'Рисуйте произвольные линии.'],
          text: ['Click the canvas to place text, then edit it in the properties panel.', 'Нажмите на холст, чтобы добавить текст, затем отредактируйте его в свойствах.'],
          fill: [
            'Click a shape to fill it with the current fill color.',
            'Нажмите на фигуру, чтобы залить её текущим цветом заливки.',
          ],
        };
        hint.textContent = ctx.pick(hints[next][0], hints[next][1]);
      };

      const renderShapeList = (): void => {
        shapeList.replaceChildren();
        for (let index = shapes.length - 1; index >= 0; index--) {
          const shape = shapes[index];
          shapeList.appendChild(
            h(
              'div',
              { class: `dt-ie-layer-row ${shape.id === selectedId ? 'is-active' : ''}` },
              h(
                'button',
                {
                  class: 'dt-ie-layer',
                  type: 'button',
                  title: kindLabel(shape.geom),
                  onclick: () => selectShape(shape.id),
                },
                h('span', { class: 'dt-ie-layer-name' }, `${kindLabel(shape.geom)} #${shape.id}`),
                h('span', { class: 'dt-ie-layer-kind' }, shape.geom.kind),
              ),
            ),
          );
        }
        if (!shapes.length) {
          shapeList.appendChild(note(ctx.pick('Draw a shape to get started.', 'Нарисуйте фигуру, чтобы начать.'), 'info'));
        }
      };

      const styleTarget = (): Style => selected() ?? defaults;

      const applyStyleChange = (apply: (style: Style) => void): void => {
        apply(styleTarget());
        scheduleRender();
        refreshSource();
      };

      const renderInspector = (): void => {
        textInputRef = null;
        inspector.replaceChildren();
        const shape = selected();
        const style = styleTarget();
        inspector.appendChild(
          h(
            'div',
            { class: 'dt-row dt-ie-inspector-head' },
            badge(shape ? kindLabel(shape.geom) : ctx.pick('New shape', 'Новая фигура')),
            h(
              'span',
              { class: 'dt-ie-layer-title' },
              shape ? `${kindLabel(shape.geom)} #${shape.id}` : ctx.pick('Style for new shapes', 'Стиль новых фигур'),
            ),
          ),
        );

        const fillColor = h('input', { type: 'color', class: 'dt-color-input', value: style.fill ?? '#3b82f6' });
        fillColor.addEventListener('input', () => applyStyleChange((target) => (target.fill = fillColor.value)));
        const strokeColor = h('input', { type: 'color', class: 'dt-color-input', value: style.stroke ?? '#1e3a8a' });
        strokeColor.addEventListener('input', () => applyStyleChange((target) => (target.stroke = strokeColor.value)));

        inspector.appendChild(
          field(
            ctx.pick('Fill', 'Заливка'),
            h(
              'div',
              { class: 'dt-inline-options' },
              fillColor,
              checkbox(ctx.pick('Enabled', 'Включена'), style.fill !== null, (value) =>
                applyStyleChange((target) => (target.fill = value ? fillColor.value : null)),
              ),
            ),
          ),
        );
        inspector.appendChild(
          field(
            ctx.pick('Stroke', 'Обводка'),
            h(
              'div',
              { class: 'dt-inline-options' },
              strokeColor,
              checkbox(ctx.pick('Enabled', 'Включена'), style.stroke !== null, (value) =>
                applyStyleChange((target) => (target.stroke = value ? strokeColor.value : null)),
              ),
            ),
          ),
        );
        inspector.appendChild(
          rangeField(ctx.pick('Stroke width', 'Толщина обводки'), 0, 40, style.strokeWidth, (value) =>
            applyStyleChange((target) => (target.strokeWidth = value)),
          ),
        );
        inspector.appendChild(
          rangeField(ctx.pick('Opacity', 'Прозрачность'), 0, 100, Math.round(style.opacity * 100), (value) =>
            applyStyleChange((target) => (target.opacity = value / 100)),
          ),
        );

        if (shape?.geom.kind === 'rect') {
          inspector.appendChild(
            rangeField(ctx.pick('Corner radius', 'Скругление'), 0, 200, shape.geom.radius, (value) => {
              if (shape.geom.kind !== 'rect') return;
              shape.geom.radius = value;
              scheduleRender();
              refreshSource();
            }),
          );
        }

        if (shape?.geom.kind === 'text') {
          const geom = shape.geom;
          const content = textInput({
            value: geom.text,
            oninput: (value) => {
              geom.text = value;
              scheduleRender();
              refreshSource();
            },
          });
          textInputRef = content;
          inspector.appendChild(field(ctx.pick('Text', 'Текст'), content));
          inspector.appendChild(
            field(
              ctx.pick('Font', 'Шрифт'),
              select(FONTS, geom.family, (value) => {
                geom.family = value;
                scheduleRender();
                refreshSource();
              }),
            ),
          );
          inspector.appendChild(
            rangeField(ctx.pick('Font size', 'Размер шрифта'), 8, 200, geom.size, (value) => {
              geom.size = value;
              scheduleRender();
              refreshSource();
            }),
          );
          inspector.appendChild(
            h(
              'div',
              { class: 'dt-inline-options' },
              checkbox(ctx.pick('Bold', 'Жирный'), geom.bold, (value) => {
                geom.bold = value;
                scheduleRender();
                refreshSource();
              }),
              checkbox(ctx.pick('Italic', 'Курсив'), geom.italic, (value) => {
                geom.italic = value;
                scheduleRender();
                refreshSource();
              }),
            ),
          );
        }

        if (shape) {
          inspector.appendChild(
            toolbar(
              iconBtn(ICONS.front, ctx.pick('Bring to front', 'На передний план'), () => reorderShape(shape.id, 1), {
                variant: 'subtle',
              }),
              iconBtn(ICONS.back, ctx.pick('Send to back', 'На задний план'), () => reorderShape(shape.id, -1), {
                variant: 'subtle',
              }),
              iconBtn(ICONS.duplicate, ctx.pick('Duplicate shape', 'Дублировать фигуру'), duplicateShape, {
                variant: 'subtle',
              }),
              iconBtn(ICONS.trash, ctx.pick('Delete shape', 'Удалить фигуру'), deleteShape, { variant: 'danger' }),
            ),
          );
        }
      };

      const duplicateShape = (): void => {
        const shape = selected();
        if (!shape) return;
        pushHistory();
        const copy: Shape = {
          ...shape,
          id: nextId++,
          matrix: [shape.matrix[0], shape.matrix[1], shape.matrix[2], shape.matrix[3], shape.matrix[4] + 16, shape.matrix[5] + 16],
          geom: shape.geom.kind === 'polyline' || shape.geom.kind === 'polygon'
            ? { kind: shape.geom.kind, points: shape.geom.points.map((point) => ({ ...point })) }
            : { ...shape.geom },
        };
        shapes.push(copy);
        selectedId = copy.id;
        syncUi();
      };

      const deleteShape = (): void => {
        if (!selectedId) return;
        pushHistory();
        shapes = shapes.filter((shape) => shape.id !== selectedId);
        selectedId = 0;
        syncUi();
      };

      const reorderShape = (id: number, direction: -1 | 1): void => {
        const index = shapes.findIndex((shape) => shape.id === id);
        if (index < 0) return;
        const target = direction > 0 ? shapes.length - 1 : 0;
        if (index === target) return;
        pushHistory();
        const [shape] = shapes.splice(index, 1);
        shapes.splice(target, 0, shape);
        syncUi();
      };

      // ---------- source & sync ----------
      const refreshSource = (): void => {
        if (document.activeElement === sourceArea) return;
        sourceArea.value = svgMarkup();
      };

      const applySource = (): void => {
        parseSvg(sourceArea.value);
      };

      const syncUi = (): void => {
        updateStats();
        renderShapeList();
        renderInspector();
        updateHistory();
        refreshSource();
        scheduleRender();
      };

      const newDocument = (): void => {
        const width = clamp(Math.round(Number(sizeWidth.value)) || docWidth, 1, 8000);
        const height = clamp(Math.round(Number(sizeHeight.value)) || docHeight, 1, 8000);
        pushHistory();
        docWidth = width;
        docHeight = height;
        shapes = [];
        selectedId = 0;
        setError(error, null);
        syncCanvasSize();
        syncUi();
      };

      // ---------- export ----------
      const downloadSvg = (): void => {
        downloadBlob('vector.svg', new Blob([svgMarkup()], { type: 'image/svg+xml;charset=utf-8' }));
      };

      const exportPng = async (): Promise<void> => {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(docWidth * exportScale));
        canvas.height = Math.max(1, Math.round(docHeight * exportScale));
        const target = canvas.getContext('2d');
        if (!target) return;
        target.scale(exportScale, exportScale);
        renderShapes(target);
        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((value) => resolve(value), 'image/png');
        });
        if (!blob) {
          setError(error, ctx.pick('Export failed.', 'Не удалось экспортировать изображение.'));
          return;
        }
        downloadBlob('vector.png', blob);
      };

      // ---------- file input ----------
      const loadFile = async (file: File): Promise<void> => {
        try {
          const markup = await readText(file);
          sourceArea.value = markup;
          parseSvg(markup);
        } catch {
          setError(error, ctx.pick('Cannot read this SVG file.', 'Не удалось прочитать SVG-файл.'));
        }
      };

      const svgInput = h('input', { type: 'file', accept: '.svg,image/svg+xml', class: 'dt-hidden' });
      svgInput.addEventListener('change', () => {
        const file = svgInput.files?.[0];
        if (file) void loadFile(file);
        svgInput.value = '';
      });

      const dropZone = fileDrop({
        accept: '.svg,image/svg+xml',
        hint: ctx.pick('Drop an SVG file here to open it', 'Перетащите SVG-файл сюда, чтобы открыть'),
        onFiles: (files) => {
          if (files[0]) void loadFile(files[0]);
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
          deleteShape();
          return;
        }
        if (meta || event.altKey) return;
        if (key === 'v') setTool('select');
        else if (key === 'r') setTool('rect');
        else if (key === 'e') setTool('ellipse');
        else if (key === 'l') setTool('line');
        else if (key === 'a') setTool('arrow');
        else if (key === 'p') setTool('pencil');
        else if (key === 't') setTool('text');
        else if (key === 'f') setTool('fill');
      });

      // ---------- layout ----------
      const toolDefs: Array<{ id: VecTool; icon: string; label: [string, string] }> = [
        { id: 'select', icon: ICONS.select, label: ['Select (V)', 'Выбор (V)'] },
        { id: 'rect', icon: ICONS.rect, label: ['Rectangle (R)', 'Прямоугольник (R)'] },
        { id: 'ellipse', icon: ICONS.ellipse, label: ['Ellipse (E)', 'Эллипс (E)'] },
        { id: 'line', icon: ICONS.line, label: ['Line (L)', 'Линия (L)'] },
        { id: 'arrow', icon: ICONS.arrow, label: ['Arrow (A)', 'Стрелка (A)'] },
        { id: 'pencil', icon: ICONS.pencil, label: ['Freehand (P)', 'Свободная линия (P)'] },
        { id: 'text', icon: ICONS.text, label: ['Text (T)', 'Текст (T)'] },
        { id: 'fill', icon: ICONS.fill, label: ['Fill (F)', 'Заливка (F)'] },
      ];

      const toolGroup = h('div', { class: 'dt-toolbar dt-vec-tools' });
      for (const definition of toolDefs) {
        const button = iconBtn(
          definition.icon,
          ctx.pick(definition.label[0], definition.label[1]),
          () => setTool(definition.id),
          { variant: 'subtle' },
        );
        toolButtons.set(definition.id, button);
        toolGroup.appendChild(button);
      }

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          error,
          resizableSplit(
            h(
              'div',
              { class: 'dt-col' },
              h('div', { class: 'dt-toolbar' }, toolGroup, undoBtn, redoBtn, h('span', { class: 'dt-grow' }), stats),
              pane(
                ctx.pick('Canvas', 'Холст'),
                h('div', { class: 'dt-stack' }, dropZone, stage),
                [
                  btn(ctx.pick('Open SVG', 'Открыть SVG'), () => svgInput.click(), { variant: 'ghost' }),
                ],
                '',
                { collapsible: false },
              ),
              hint,
            ),
            h(
              'div',
              { class: 'dt-col' },
              pane(ctx.pick('Shapes', 'Фигуры'), shapeList),
              pane(ctx.pick('Properties', 'Свойства'), inspector),
              pane(
                ctx.pick('SVG source', 'SVG-код'),
                h('div', { class: 'dt-stack' }, sourceArea),
                [
                  btn(ctx.pick('Apply', 'Применить'), applySource, { variant: 'primary' }),
                  btn(
                    ctx.pick('Copy', 'Копировать'),
                    () => void copyText(svgMarkup()),
                    { variant: 'ghost' },
                  ),
                ],
              ),
              pane(
                ctx.pick('Document', 'Документ'),
                h(
                  'div',
                  { class: 'dt-stack' },
                  h(
                    'div',
                    { class: 'dt-ie-size-row' },
                    field(ctx.pick('Width', 'Ширина'), sizeWidth),
                    field(ctx.pick('Height', 'Высота'), sizeHeight),
                  ),
                  toolbar(btn(ctx.pick('New document', 'Новый документ'), newDocument, { variant: 'ghost' })),
                ),
              ),
              pane(
                ctx.pick('Export', 'Экспорт'),
                h(
                  'div',
                  { class: 'dt-stack' },
                  rangeField(ctx.pick('PNG scale', 'Масштаб PNG'), 100, 400, 100, (value) => {
                    exportScale = value / 100;
                  }),
                  toolbar(
                    btn(ctx.pick('Download SVG', 'Скачать SVG'), downloadSvg, {
                      variant: 'primary',
                      icon: ICONS.download,
                    }),
                    btn(ctx.pick('Download PNG', 'Скачать PNG'), () => void exportPng(), {
                      variant: 'ghost',
                      icon: ICONS.download,
                    }),
                  ),
                ),
              ),
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
      root.append(svgInput, measureSvg);

      // ---------- boot ----------
      syncCanvasSize();
      syncUi();
      setTool('select');
      const incoming = ctx.takeIncoming();
      if (incoming) {
        sourceArea.value = dataUrlToText(incoming.dataUrl);
        parseSvg(sourceArea.value);
      }
    },
  });
}

export const vectorEditorTools = [vectorEditorTool()];
