/** 2D/3D animation studio with keyframes, timeline, project files and Lottie/WebM export. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import {
  badge,
  btn,
  checkbox,
  downloadBlob,
  errorSlot,
  field,
  iconBtn,
  knobField,
  knobGrid,
  note,
  pane,
  segmented,
  select as selectInput,
  setError,
  tabs,
  textInput,
  toolbar,
} from '../components.ts';
import { clamp, h, svgIcon } from '../dom.ts';
import { encodeGif, type GifFrame } from '../lib/gif.ts';
import { defineTool } from '../tool-types.ts';

type AnimMode = '2d' | '3d';
type AnimKind =
  | 'rect'
  | 'ellipse'
  | 'text'
  | 'line'
  | 'box'
  | 'sphere'
  | 'torus'
  | 'pyramid'
  | 'prism'
  | 'cylinder'
  | 'bar'
  | 'model'
  | 'group';

interface AnimKey {
  t: number;
  x: number;
  y: number;
  z: number;
  scale: number;
  rotation: number;
  opacity: number;
  rotationX?: number;
  rotationZ?: number;
  scaleX?: number;
  scaleY?: number;
  scaleZ?: number;
}

interface AnimObject {
  id: number;
  name: string;
  kind: AnimKind;
  color: string;
  size: number;
  text: string;
  keys: AnimKey[];
  /** Parent group id (one level of nesting). */
  parentId?: number;
  /** Mode a group belongs to. */
  groupMode?: AnimMode;
  /** Collapsed state of a group in the object list. */
  collapsed?: boolean;
  mesh?: THREE.Object3D;
}

interface ProjectFile {
  mode: AnimMode;
  duration: number;
  width?: number;
  height?: number;
  objects: Array<Omit<AnimObject, 'mesh'>>;
}

interface Gizmo2dDrag {
  kind: 'x' | 'y' | 'both' | 'rotate' | 'scale';
  startX: number;
  startY: number;
  startKey: AnimKey;
  centerX: number;
  centerY: number;
  startAngle: number;
  startDistance: number;
}

const ICONS = {
  eye: '<path d="M2 12s3.5 -6 10 -6s10 6 10 6s-3.5 6 -10 6s-10 -6 -10 -6z"/><path d="M12 15a3 3 0 1 0 0 -6a3 3 0 0 0 0 6z"/>',
  trash: '<path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"/><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3"/>',
  download: '<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2"/><path d="M7 11l5 5l5 -5"/><path d="M12 4l0 12"/>',
  move: '<path d="M12 3v18"/><path d="M3 12h18"/><path d="M12 3l-2.6 2.6"/><path d="M12 3l2.6 2.6"/><path d="M12 21l-2.6 -2.6"/><path d="M12 21l2.6 -2.6"/><path d="M3 12l2.6 -2.6"/><path d="M3 12l2.6 2.6"/><path d="M21 12l-2.6 -2.6"/><path d="M21 12l-2.6 2.6"/>',
  rotate: '<path d="M4.5 12a7.5 7.5 0 1 1 2.7 5.8"/><path d="M4 20v-5.5h5.5"/>',
  scale: '<rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.2"/><path d="M14 20.5h6.5V14"/><path d="M20.5 20.5L13.5 13.5"/>',
  group: '<rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/><path d="M14 7h4a3 3 0 0 1 3 3v1"/><path d="M10 17H6a3 3 0 0 1 -3 -3v-1"/>',
  ungroup: '<rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/><path d="M14 6.5h6"/><path d="M10 17.5H4"/>',
  rename: '<path d="M4 20h4l10 -10a2.8 2.8 0 0 0 -4 -4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  chevronDown: '<path d="M6 9l6 6l6 -6"/>',
  chevronRight: '<path d="M9 6l6 6l-6 6"/>',
} as const;

const is2d = (kind: AnimKind): boolean =>
  kind === 'rect' || kind === 'ellipse' || kind === 'text' || kind === 'line';

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
const toDegrees = (radians: number): number => (radians * 180) / Math.PI;

const KIND_LABELS: Record<AnimKind, [string, string]> = {
  rect: ['Rectangle', 'Прямоугольник'],
  ellipse: ['Ellipse', 'Эллипс'],
  text: ['Text', 'Текст'],
  line: ['Line', 'Линия'],
  box: ['Box', 'Куб'],
  sphere: ['Sphere', 'Сфера'],
  torus: ['Torus', 'Тор'],
  pyramid: ['Pyramid', 'Пирамида'],
  prism: ['Triangle', 'Треугольник'],
  cylinder: ['Cylinder', 'Цилиндр'],
  bar: ['Line', 'Линия'],
  model: ['Model', 'Модель'],
  group: ['Group', 'Группа'],
};

const KIND_ICONS: Record<AnimKind, string> = {
  rect: '<rect x="3.5" y="6.5" width="17" height="11" rx="1.5"/>',
  ellipse: '<ellipse cx="12" cy="12" rx="8.5" ry="6"/>',
  text: '<path d="M5 6h14"/><path d="M12 6v12"/><path d="M8.5 18h7"/>',
  line: '<path d="M4.5 19l15-14"/><circle cx="4.5" cy="19" r="1.6"/><circle cx="19.5" cy="5" r="1.6"/>',
  box: '<path d="M12 3l8 4.4v9.2L12 21l-8-4.4V7.4z"/><path d="M12 12l8-4.6"/><path d="M12 12L4 7.4"/><path d="M12 12v9"/>',
  sphere: '<circle cx="12" cy="12" r="8"/><ellipse cx="12" cy="12" rx="8" ry="3"/>',
  torus: '<ellipse cx="12" cy="12" rx="8.5" ry="5"/><ellipse cx="12" cy="12" rx="3.4" ry="1.9"/>',
  pyramid: '<path d="M12 3l8.5 16H3.5z"/><path d="M12 3v16"/>',
  prism: '<path d="M12 3l7.5 12.5h-15z"/><path d="M4.5 15.5L3 20.5h18l-1.5-5"/>',
  cylinder: '<ellipse cx="12" cy="6.5" rx="7" ry="2.8"/><path d="M5 6.5v11a7 2.8 0 0 0 14 0v-11"/>',
  bar: '<path d="M4 17.5L20 6.5"/><path d="M2.8 19l-0.8 1.6"/>',
  model: '<path d="M4 8.5l8-4.5l8 4.5v7l-8 4.5l-8-4.5z"/><path d="M4 8.5l8 4.5l8-4.5"/><path d="M12 13v7"/>',
  group: '<rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/>',
};

const ADD_KINDS: Record<AnimMode, AnimKind[]> = {
  '2d': ['rect', 'ellipse', 'text', 'line'],
  '3d': ['box', 'sphere', 'torus', 'pyramid', 'prism', 'cylinder', 'bar'],
};

function sample(object: AnimObject, time: number): AnimKey {
  const keys = [...object.keys].sort((a, b) => a.t - b.t);
  if (!keys.length) return { t: time, x: 0.5, y: 0.5, z: 0, scale: 1, rotation: 0, opacity: 1 };
  if (time <= keys[0].t) return keys[0];
  if (time >= keys[keys.length - 1].t) return keys[keys.length - 1];
  for (let index = 0; index < keys.length - 1; index++) {
    const left = keys[index];
    const right = keys[index + 1];
    if (time >= left.t && time <= right.t) {
      const span = Math.max(0.0001, right.t - left.t);
      const factor = (time - left.t) / span;
      const mix = (a: number, b: number): number => a + (b - a) * factor;
      return {
        t: time,
        x: mix(left.x, right.x),
        y: mix(left.y, right.y),
        z: mix(left.z, right.z),
        scale: mix(left.scale, right.scale),
        rotation: mix(left.rotation, right.rotation),
        opacity: mix(left.opacity, right.opacity),
        rotationX: mix(left.rotationX ?? 0, right.rotationX ?? 0),
        rotationZ: mix(left.rotationZ ?? 0, right.rotationZ ?? 0),
        scaleX: mix(left.scaleX ?? left.scale, right.scaleX ?? right.scale),
        scaleY: mix(left.scaleY ?? left.scale, right.scaleY ?? right.scale),
        scaleZ: mix(left.scaleZ ?? left.scale, right.scaleZ ?? right.scale),
      };
    }
  }
  return keys[keys.length - 1];
}

function animationTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'media-animation',
    group: 'media',
    icon: '<path d="M4 5h16v14h-16z"/><path d="M10 9l5 3l-5 3z"/>',
    name: { en: 'Animation Studio', ru: 'Анимация' },
    desc: {
      en: 'Keyframe animation for 2D scenes and 3D objects with a transform gizmo, a timeline that labels every object and draws diamond keys, resolution presets, resizable stage, object groups, project files, Lottie, GIF and WebM export.',
      ru: 'Покадровая анимация 2D-сцен и 3D-объектов с гизмо, таймлайном с подписями объектов и ромбами-ключами, пресетами разрешения, изменяемой шириной сцены, группами объектов, сохранением проекта, экспортом Lottie, GIF и WebM.',
    },
    keywords: 'animation keyframe timeline 2d 3d gizmo lottie after effects gif webm svg project',
    mount(root, ctx) {
      let mode: AnimMode = '2d';
      let duration = 5;
      let current = 0;
      let playing = false;
      let lastFrame = 0;
      let nextId = 1;
      let selectedId = 0;
      let renamingId = 0;
      const selectedIds = new Set<number>();
      let docWidth = 960;
      let docHeight = 540;
      let gizmoMode: 'translate' | 'rotate' | 'scale' = 'translate';
      let gizmo2dDrag: Gizmo2dDrag | null = null;
      let gifFps = 15;
      let gifWidth = 640;
      let timelineZoom = 1;
      /** True while frames are captured for PNG/GIF/WebM, which hides editor gizmos. */
      let exporting = false;
      const objects: AnimObject[] = [];

      const error = errorSlot();
      const canvas2d = h('canvas', { class: 'dt-anim-canvas', width: 960, height: 540 });
      const stage3d = h('div', { class: 'dt-scene-stage dt-anim-3d' });
      const hud3d = h('div', { class: 'dt-scene-hud' });
      stage3d.append(hud3d);
      const stage2d = h('div', { class: 'dt-anim-stage' }, canvas2d);
      const objectList = h('div', { class: 'dt-ie-layers' });
      const inspector = h('div', { class: 'dt-stack' });
      const timeline = h('div', { class: 'dt-anim-timeline' });
      const timelineScroll = h('div', { class: 'dt-timeline-scroll' }, timeline);
      const timelineZoomLabel = h('span', { class: 'dt-timeline-zoom-label' }, '100%');
      const rulerLabel = h('span', { class: 'dt-anim-ruler-label' }, '');
      const rulerTrack = h('div', { class: 'dt-anim-ruler-track' });
      const ruler = h('div', { class: 'dt-anim-ruler' }, rulerLabel, rulerTrack);
      const rowsHost = h('div', { class: 'dt-anim-rows' });
      const trackLayer = h('div', { class: 'dt-anim-track-layer' });
      const playhead = h('div', { class: 'dt-anim-playhead' });
      trackLayer.append(playhead);
      const kindLabel = (kind: AnimKind): string => {
        const [en, ru] = KIND_LABELS[kind];
        return ctx.pick(en, ru);
      };
      const timeLabel = h('span', { class: 'dt-audio-time' }, '0.00 s');
      const modeSegment = segmented(
        [
          { value: '2d', label: ctx.pick('2D', '2D') },
          { value: '3d', label: ctx.pick('3D', '3D') },
        ],
        '2d',
        (value) => {
          mode = value === '3d' ? '3d' : '2d';
          selectedId = 0;
          selectedIds.clear();
          gizmo2dDrag = null;
          updateStageVisibility();
          syncUi();
          renderAddButtons();
        },
      );
      const reflectMode = (): void => {
        for (const segment of Array.from(modeSegment.querySelectorAll<HTMLElement>('.dt-segment'))) {
          const active = segment.dataset.value === mode;
          segment.classList.toggle('is-active', active);
          segment.setAttribute('aria-checked', String(active));
        }
      };
      const gizmoSegment = segmented(
        [
          { value: 'translate', label: ctx.pick('Move', 'Двигать'), icon: ICONS.move },
          { value: 'rotate', label: ctx.pick('Rotate', 'Вращать'), icon: ICONS.rotate },
          { value: 'scale', label: ctx.pick('Scale', 'Масштаб'), icon: ICONS.scale },
        ],
        'translate',
        (value) => {
          gizmoMode = value === 'rotate' ? 'rotate' : value === 'scale' ? 'scale' : 'translate';
          gizmo2dDrag = null;
          syncGizmo3d();
          renderFrame();
        },
      );
      gizmoSegment.style.display = 'none';

      // ---------- 3D ----------
      let renderer: THREE.WebGLRenderer | null = null;
      let scene3d: THREE.Scene | null = null;
      let camera3d: THREE.PerspectiveCamera | null = null;
      let controls3d: TransformControls | null = null;

      const ensure3d = (): void => {
        if (renderer) return;
        renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        stage3d.appendChild(renderer.domElement);
        scene3d = new THREE.Scene();
        scene3d.background = new THREE.Color('#0f172a');
        camera3d = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 200);
        camera3d.position.set(6, 5, 8);
        camera3d.lookAt(0, 1, 0);
        scene3d.add(new THREE.AmbientLight(0xffffff, 0.6));
        const sun = new THREE.DirectionalLight(0xffffff, 2.2);
        sun.position.set(5, 9, 6);
        sun.castShadow = true;
        scene3d.add(sun);
        const grid = new THREE.GridHelper(24, 24, 0x64748b, 0x273449);
        scene3d.add(grid);
        const ground = new THREE.Mesh(
          new THREE.PlaneGeometry(24, 24),
          new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.95 }),
        );
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene3d.add(ground);

        controls3d = new TransformControls(camera3d, renderer.domElement);
        controls3d.setSize(1.6);
        controls3d.setMode(gizmoMode);
        controls3d.addEventListener('objectChange', () => {
          applyGizmoTransform();
          updateHud3d();
        });
        controls3d.addEventListener('axis-changed', () => {
          renderFrame();
          updateHud3d();
        });
        controls3d.addEventListener('mouseUp', () => {
          renderInspector();
          renderTimeline();
        });
        scene3d.add(controls3d.getHelper());
      };

      const geometryFor = (kind: AnimKind): THREE.BufferGeometry => {
        if (kind === 'sphere') return new THREE.SphereGeometry(0.8, 40, 28);
        if (kind === 'torus') return new THREE.TorusGeometry(0.8, 0.28, 24, 80);
        if (kind === 'pyramid') return new THREE.ConeGeometry(1.05, 1.6, 4);
        if (kind === 'prism') return new THREE.CylinderGeometry(0.95, 0.95, 1.5, 3);
        if (kind === 'cylinder') return new THREE.CylinderGeometry(0.62, 0.62, 1.5, 36);
        if (kind === 'bar') return new THREE.BoxGeometry(2, 0.1, 0.1);
        return new THREE.BoxGeometry(1.2, 1.2, 1.2);
      };

      const ensureMesh = (object: AnimObject): void => {
        if (!scene3d || object.kind === 'model' || object.mesh) return;
        if (object.kind === 'group') {
          const group = new THREE.Group();
          object.mesh = group;
          scene3d.add(group);
          return;
        }
        const material = new THREE.MeshStandardMaterial({ color: object.color, metalness: 0.3, roughness: 0.35 });
        const mesh = new THREE.Mesh(geometryFor(object.kind), material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        object.mesh = mesh;
        scene3d.add(mesh);
      };

      /** Keeps 3D parents in sync with `parentId` links. */
      const syncMeshParents = (): void => {
        if (!scene3d) return;
        for (const object of objects) {
          if (!object.mesh || is2d(object.kind)) continue;
          const parent = object.parentId ? objects.find((item) => item.id === object.parentId) : undefined;
          const target = parent?.mesh ?? scene3d;
          if (object.mesh.parent !== target) target.add(object.mesh);
        }
      };

      const updateMesh = (object: AnimObject, key: AnimKey): void => {
        if (!object.mesh) return;
        const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
        object.mesh.position.set(key.x, key.y, key.z);
        object.mesh.rotation.set(toRadians(key.rotationX ?? 0), toRadians(key.rotation), toRadians(key.rotationZ ?? 0));
        object.mesh.scale.set(
          Math.max(0.05, key.scaleX ?? key.scale),
          Math.max(0.05, key.scaleY ?? key.scale),
          Math.max(0.05, key.scaleZ ?? key.scale),
        );
      };

      // ---------- 2D ----------
      const drawShape2d = (context: CanvasRenderingContext2D, object: AnimObject): void => {
        context.fillStyle = object.color;
        if (object.kind === 'rect') {
          context.fillRect(-object.size / 2, -object.size * 0.3, object.size, object.size * 0.6);
        } else if (object.kind === 'ellipse') {
          context.beginPath();
          context.ellipse(0, 0, object.size / 2, object.size * 0.3, 0, 0, Math.PI * 2);
          context.fill();
        } else if (object.kind === 'line') {
          context.strokeStyle = object.color;
          context.lineWidth = Math.max(2, object.size * 0.05);
          context.lineCap = 'round';
          context.beginPath();
          context.moveTo(-object.size / 2, 0);
          context.lineTo(object.size / 2, 0);
          context.stroke();
        } else {
          context.font = `700 ${object.size}px system-ui, "Segoe UI", sans-serif`;
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          context.fillText(object.text, 0, 0);
        }
      };

      const draw2d = (): void => {
        const context = canvas2d.getContext('2d');
        if (!context) return;
        context.clearRect(0, 0, canvas2d.width, canvas2d.height);
        const gradient = context.createLinearGradient(0, 0, canvas2d.width, canvas2d.height);
        gradient.addColorStop(0, '#0f172a');
        gradient.addColorStop(1, '#1e293b');
        context.fillStyle = gradient;
        context.fillRect(0, 0, canvas2d.width, canvas2d.height);
        const paint = (object: AnimObject, inherited: number): void => {
          const key = sample(object, current);
          const alpha = inherited * clamp(key.opacity, 0, 1);
          context.save();
          context.globalAlpha = alpha;
          context.translate(key.x * canvas2d.width, key.y * canvas2d.height);
          context.rotate((key.rotation * Math.PI) / 180);
          context.scale(key.scale, key.scale);
          if (object.kind === 'group') {
            context.translate(-key.x * canvas2d.width, -key.y * canvas2d.height);
            for (const child of childrenOf(object)) paint(child, alpha);
          } else {
            drawShape2d(context, object);
          }
          context.restore();
        };
        for (const object of topLevel()) paint(object, 1);
        if (mode === '2d' && !exporting) drawGizmo2d(context);
      };

      const gizmo2dParams = (): { object: AnimObject; key: AnimKey; cx: number; cy: number; axis: number; ring: number } | null => {
        if (mode !== '2d' || playing) return null;
        const object = selected();
        if (!object || !(is2d(object.kind) || object.kind === 'group') || (object.kind === 'group' && object.groupMode !== '2d')) return null;
        const key = sample(object, current);
        return {
          object,
          key,
          cx: key.x * canvas2d.width,
          cy: key.y * canvas2d.height,
          axis: 76,
          ring: 62,
        };
      };

      const drawArrow2d = (
        context: CanvasRenderingContext2D,
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        color: string,
        label: string,
      ): void => {
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const head = 9;
        context.strokeStyle = color;
        context.fillStyle = color;
        context.lineWidth = 2.4;
        context.beginPath();
        context.moveTo(x1, y1);
        context.lineTo(x2, y2);
        context.stroke();
        context.beginPath();
        context.moveTo(x2, y2);
        context.lineTo(x2 - Math.cos(angle - 0.42) * head, y2 - Math.sin(angle - 0.42) * head);
        context.lineTo(x2 - Math.cos(angle + 0.42) * head, y2 - Math.sin(angle + 0.42) * head);
        context.closePath();
        context.fill();
        context.font = '700 11px system-ui, sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(label, x2 + Math.cos(angle) * 12, y2 + Math.sin(angle) * 12);
      };

      const drawGizmo2d = (context: CanvasRenderingContext2D): void => {
        const params = gizmo2dParams();
        if (!params) return;
        const { cx, cy, axis, ring } = params;
        context.save();
        context.lineCap = 'round';
        if (gizmoMode === 'translate') {
          drawArrow2d(context, cx, cy, cx + axis, cy, '#ef4444', 'X');
          drawArrow2d(context, cx, cy, cx, cy - axis, '#22c55e', 'Y');
          context.fillStyle = 'rgba(248,250,252,0.95)';
          context.strokeStyle = '#0f172a';
          context.lineWidth = 1.5;
          context.beginPath();
          context.arc(cx, cy, 6, 0, Math.PI * 2);
          context.fill();
          context.stroke();
        } else if (gizmoMode === 'rotate') {
          context.strokeStyle = '#a78bfa';
          context.lineWidth = 2.4;
          context.beginPath();
          context.arc(cx, cy, ring, 0, Math.PI * 2);
          context.stroke();
          context.fillStyle = '#c4b5fd';
          for (const angle of [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2]) {
            context.beginPath();
            context.arc(cx + Math.cos(angle) * ring, cy + Math.sin(angle) * ring, 4, 0, Math.PI * 2);
            context.fill();
          }
          context.fillStyle = 'rgba(248,250,252,0.95)';
          context.beginPath();
          context.arc(cx, cy, 5, 0, Math.PI * 2);
          context.fill();
        } else {
          context.strokeStyle = '#38bdf8';
          context.lineWidth = 2;
          context.beginPath();
          context.moveTo(cx - axis, cy);
          context.lineTo(cx + axis, cy);
          context.moveTo(cx, cy - axis);
          context.lineTo(cx, cy + axis);
          context.stroke();
          context.fillStyle = '#7dd3fc';
          for (const [x, y] of [[cx + axis, cy], [cx - axis, cy], [cx, cy + axis], [cx, cy - axis]]) {
            context.fillRect(x - 5, y - 5, 10, 10);
          }
        }
        context.restore();
      };

      const distanceToSegment2d = (px: number, py: number, x1: number, y1: number, x2: number, y2: number): number => {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lengthSquared = dx * dx + dy * dy;
        if (!lengthSquared) return Math.hypot(px - x1, py - y1);
        const factor = clamp(((px - x1) * dx + (py - y1) * dy) / lengthSquared, 0, 1);
        return Math.hypot(px - (x1 + dx * factor), py - (y1 + dy * factor));
      };

      const hitGizmo2d = (point: { x: number; y: number }): Gizmo2dDrag['kind'] | null => {
        const params = gizmo2dParams();
        if (!params) return null;
        const { cx, cy, axis, ring } = params;
        const distance = Math.hypot(point.x - cx, point.y - cy);
        if (gizmoMode === 'rotate') return Math.abs(distance - ring) <= 12 ? 'rotate' : null;
        if (gizmoMode === 'scale') {
          const handles = [
            [cx + axis, cy],
            [cx - axis, cy],
            [cx, cy + axis],
            [cx, cy - axis],
          ];
          if (handles.some(([x, y]) => Math.hypot(point.x - x, point.y - y) <= 14)) return 'scale';
          return null;
        }
        if (distance <= 12) return 'both';
        if (distanceToSegment2d(point.x, point.y, cx, cy, cx + axis, cy) <= 10) return 'x';
        if (distanceToSegment2d(point.x, point.y, cx, cy, cx, cy - axis) <= 10) return 'y';
        return null;
      };

      const inverseGroupPoint = (point: { x: number; y: number }, key: AnimKey): { x: number; y: number } => {
        const px = key.x * canvas2d.width;
        const py = key.y * canvas2d.height;
        const scale = key.scale || 1;
        const angle = (-key.rotation * Math.PI) / 180;
        const dx = point.x - px;
        const dy = point.y - py;
        return {
          x: px + (dx * Math.cos(angle) - dy * Math.sin(angle)) / scale,
          y: py + (dx * Math.sin(angle) + dy * Math.cos(angle)) / scale,
        };
      };

      const hitObject2d = (point: { x: number; y: number }): AnimObject | undefined => {
        const test = (object: AnimObject, pt: { x: number; y: number }): AnimObject | undefined => {
          if (object.kind === 'group') {
            const local = inverseGroupPoint(pt, sample(object, current));
            for (const child of [...childrenOf(object)].reverse()) {
              const hit = test(child, local);
              if (hit) return hit;
            }
            return undefined;
          }
          const key = sample(object, current);
          const cx = key.x * canvas2d.width;
          const cy = key.y * canvas2d.height;
          const angle = (-key.rotation * Math.PI) / 180;
          const localX = (pt.x - cx) * Math.cos(angle) - (pt.y - cy) * Math.sin(angle);
          const localY = (pt.x - cx) * Math.sin(angle) + (pt.y - cy) * Math.cos(angle);
          const width = object.kind === 'text' ? Math.max(40, object.text.length * object.size * 0.55) : object.size;
          const height = object.kind === 'text' ? object.size : object.kind === 'line' ? 26 : object.size * 0.6;
          const halfWidth = (width * key.scale) / 2;
          const halfHeight = (height * key.scale) / 2;
          if (object.kind === 'ellipse') {
            if ((localX * localX) / (halfWidth * halfWidth) + (localY * localY) / (halfHeight * halfHeight) <= 1) return object;
          } else if (Math.abs(localX) <= halfWidth && Math.abs(localY) <= halfHeight) {
            return object;
          }
          return undefined;
        };
        for (const object of [...topLevel()].reverse()) {
          const hit = test(object, point);
          if (hit) return hit;
        }
        return undefined;
      };

      const canvas2dPoint = (event: PointerEvent): { x: number; y: number } => {
        const rect = canvas2d.getBoundingClientRect();
        return {
          x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * canvas2d.width,
          y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * canvas2d.height,
        };
      };

      canvas2d.style.touchAction = 'none';
      canvas2d.addEventListener('pointerdown', (event) => {
        if (mode !== '2d' || playing) return;
        const point = canvas2dPoint(event);
        const hit = hitGizmo2d(point);
        const object = selected();
        if (hit && object) {
          const params = gizmo2dParams();
          if (!params) return;
          const key = params.key;
          gizmo2dDrag = {
            kind: hit,
            startX: point.x,
            startY: point.y,
            startKey: { ...key },
            centerX: params.cx,
            centerY: params.cy,
            startAngle: Math.atan2(point.y - params.cy, point.x - params.cx),
            startDistance: Math.max(1, Math.hypot(point.x - params.cx, point.y - params.cy)),
          };
          canvas2d.setPointerCapture(event.pointerId);
          event.preventDefault();
          return;
        }
        const picked = hitObject2d(point);
        if (picked) select(picked.id, event.ctrlKey || event.metaKey || event.shiftKey);
        else if (selectedId) {
          selectOnly(0);
          syncUi();
        }
      });

      canvas2d.addEventListener('pointermove', (event) => {
        if (mode !== '2d' || playing) return;
        const point = canvas2dPoint(event);
        if (!gizmo2dDrag) {
          const hit = hitGizmo2d(point);
          canvas2d.style.cursor = hit ? 'grab' : hitObject2d(point) ? 'pointer' : 'default';
          return;
        }
        const drag = gizmo2dDrag;
        const patch: Partial<AnimKey> = {};
        const dx = point.x - drag.startX;
        const dy = point.y - drag.startY;
        if (drag.kind === 'x' || drag.kind === 'both') patch.x = clamp(drag.startKey.x + dx / canvas2d.width, 0, 1);
        if (drag.kind === 'y' || drag.kind === 'both') patch.y = clamp(drag.startKey.y + dy / canvas2d.height, 0, 1);
        if (drag.kind === 'rotate') {
          const angle = Math.atan2(point.y - drag.centerY, point.x - drag.centerX);
          let degrees = drag.startKey.rotation + ((angle - drag.startAngle) * 180) / Math.PI;
          if (event.shiftKey) degrees = Math.round(degrees / 15) * 15;
          degrees = ((((degrees + 180) % 360) + 360) % 360) - 180;
          patch.rotation = degrees;
        }
        if (drag.kind === 'scale') {
          const distance = Math.max(1, Math.hypot(point.x - drag.centerX, point.y - drag.centerY));
          patch.scale = clamp(drag.startKey.scale * (distance / drag.startDistance), 0.05, 5);
        }
        setKeyAtCurrent(patch);
      });

      const stopGizmo2d = (event: PointerEvent): void => {
        if (!gizmo2dDrag) return;
        gizmo2dDrag = null;
        if (canvas2d.hasPointerCapture(event.pointerId)) canvas2d.releasePointerCapture(event.pointerId);
        renderInspector();
        renderObjects();
        renderTimeline();
      };
      canvas2d.addEventListener('pointerup', stopGizmo2d);
      canvas2d.addEventListener('pointercancel', stopGizmo2d);

      const renderFrame = (): void => {
        if (mode === '2d') {
          draw2d();
          return;
        }
        ensure3d();
        const sceneObjects = objects.filter((item) => !is2d(item.kind));
        for (const object of sceneObjects) ensureMesh(object);
        syncMeshParents();
        for (const object of sceneObjects) updateMesh(object, sample(object, current));
        const helper = controls3d?.getHelper();
        if (helper) helper.visible = !exporting;
        if (renderer && scene3d && camera3d) renderer.render(scene3d, camera3d);
      };

      // ---------- objects ----------
      const belongs = (object: AnimObject): boolean => {
        if (object.kind === 'group') return object.groupMode === mode;
        return mode === '2d' ? is2d(object.kind) : !is2d(object.kind);
      };
      const activeObjects = (): AnimObject[] => objects.filter(belongs);
      const childrenOf = (group: AnimObject): AnimObject[] =>
        objects.filter((object) => object.parentId === group.id && belongs(object));
      const topLevel = (): AnimObject[] => activeObjects().filter((object) => !object.parentId);
      const selected = (): AnimObject | undefined => objects.find((object) => object.id === selectedId);
      const selectOnly = (id: number): void => {
        selectedIds.clear();
        if (id) selectedIds.add(id);
        selectedId = id;
      };
      /** Objects targeted by group/delete actions. */
      const selection = (): AnimObject[] => objects.filter((object) => selectedIds.has(object.id) && belongs(object));

      const defaultKey = (): AnimKey =>
        mode === '2d'
          ? { t: 0, x: 0.5, y: 0.5, z: 0, scale: 1, rotation: 0, opacity: 1 }
          : { t: 0, x: 0, y: 1, z: 0, scale: 1, rotation: 0, opacity: 1 };

      const addObject = (kind: AnimKind): void => {
        const key = defaultKey();
        key.t = 0;
        const object: AnimObject = {
          id: nextId++,
          name: `${kindLabel(kind)} ${nextId - 1}`,
          kind,
          color: ['#60a5fa', '#f472b6', '#34d399', '#fbbf24', '#a78bfa'][objects.length % 5],
          size: kind === 'text' ? 64 : kind === 'line' || kind === 'bar' ? 220 : is2d(kind) ? 160 : 1.2,
          text: ctx.pick('Animate me', 'Анимируй меня'),
          keys: [key],
        };
        objects.push(object);
        selectOnly(object.id);
        if (mode === '3d') ensure3d();
        syncUi();
      };

      const deleteObject = (): void => {
        const targets = selection();
        if (!targets.length) return;
        const ids = new Set<number>();
        for (const object of targets) {
          ids.add(object.id);
          if (object.kind === 'group') for (const child of childrenOf(object)) ids.add(child.id);
        }
        for (const object of objects) {
          if (ids.has(object.id) && object.mesh?.parent) object.mesh.parent.remove(object.mesh);
        }
        for (let index = objects.length - 1; index >= 0; index--) {
          if (ids.has(objects[index].id)) objects.splice(index, 1);
        }
        selectOnly(0);
        syncUi();
      };

      const groupSelected = (): void => {
        const members = selection().filter((object) => !object.parentId);
        if (!members.length) return;
        const keys = members.map((object) => sample(object, current));
        const center = { x: 0, y: 0, z: 0 };
        for (const key of keys) {
          center.x += key.x / keys.length;
          center.y += key.y / keys.length;
          center.z += key.z / keys.length;
        }
        const groupKey: AnimKey =
          mode === '2d'
            ? { t: 0, x: center.x, y: center.y, z: 0, scale: 1, rotation: 0, opacity: 1 }
            : { t: 0, x: center.x, y: center.y, z: center.z, scale: 1, rotation: 0, rotationX: 0, rotationZ: 0, opacity: 1 };
        const group: AnimObject = {
          id: nextId++,
          name: `${kindLabel('group')} ${nextId - 1}`,
          kind: 'group',
          groupMode: mode,
          color: '#94a3b8',
          size: 1,
          text: '',
          keys: [groupKey],
          collapsed: false,
        };
        if (mode === '3d') {
          // 3D children become local to the group pivot; keys stay absolute otherwise.
          for (const object of members) {
            for (const key of object.keys) {
              key.x -= groupKey.x;
              key.y -= groupKey.y;
              key.z -= groupKey.z;
            }
          }
        }
        objects.push(group);
        for (const object of members) object.parentId = group.id;
        if (mode === '3d') {
          ensure3d();
          ensureMesh(group);
          syncMeshParents();
        }
        selectOnly(group.id);
        syncUi();
      };

      const ungroupSelected = (): void => {
        const group = selected();
        if (!group || group.kind !== 'group') return;
        const key = sample(group, current);
        const children = childrenOf(group);
        if (mode === '2d') {
          const px = key.x * docWidth;
          const py = key.y * docHeight;
          const angle = toRadians(key.rotation);
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          for (const child of children) {
            for (const childKey of child.keys) {
              const dx = childKey.x * docWidth - px;
              const dy = childKey.y * docHeight - py;
              childKey.x = (px + (dx * cos - dy * sin) * key.scale) / docWidth;
              childKey.y = (py + (dx * sin + dy * cos) * key.scale) / docHeight;
              childKey.rotation += key.rotation;
              childKey.scale *= key.scale;
            }
          }
        } else {
          const matrix = new THREE.Matrix4().compose(
            new THREE.Vector3(key.x, key.y, key.z),
            new THREE.Quaternion().setFromEuler(
              new THREE.Euler(toRadians(key.rotationX ?? 0), toRadians(key.rotation), toRadians(key.rotationZ ?? 0)),
            ),
            new THREE.Vector3(key.scale, key.scale, key.scale),
          );
          const position = new THREE.Vector3();
          const quaternion = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          const local = new THREE.Matrix4();
          const world = new THREE.Matrix4();
          for (const child of children) {
            for (const childKey of child.keys) {
              local.compose(
                new THREE.Vector3(childKey.x, childKey.y, childKey.z),
                new THREE.Quaternion().setFromEuler(
                  new THREE.Euler(
                    toRadians(childKey.rotationX ?? 0),
                    toRadians(childKey.rotation),
                    toRadians(childKey.rotationZ ?? 0),
                  ),
                ),
                new THREE.Vector3(
                  childKey.scaleX ?? childKey.scale,
                  childKey.scaleY ?? childKey.scale,
                  childKey.scaleZ ?? childKey.scale,
                ),
              );
              world.multiplyMatrices(matrix, local).decompose(position, quaternion, scale);
              const euler = new THREE.Euler().setFromQuaternion(quaternion, 'YXZ');
              childKey.x = position.x;
              childKey.y = position.y;
              childKey.z = position.z;
              childKey.rotationX = toDegrees(euler.x);
              childKey.rotation = toDegrees(euler.y);
              childKey.rotationZ = toDegrees(euler.z);
              childKey.scaleX = scale.x;
              childKey.scaleY = scale.y;
              childKey.scaleZ = scale.z;
              childKey.scale = (scale.x + scale.y + scale.z) / 3;
            }
          }
        }
        for (const child of children) child.parentId = undefined;
        if (group.mesh?.parent) group.mesh.parent.remove(group.mesh);
        objects.splice(objects.indexOf(group), 1);
        if (mode === '3d') syncMeshParents();
        selectOnly(children[0]?.id ?? 0);
        syncUi();
      };

      const setKeyAtCurrent = (patch: Partial<AnimKey>): void => {
        const object = selected();
        if (!object) return;
        const rounded = Math.round(current * 100) / 100;
        let key = object.keys.find((item) => Math.abs(item.t - rounded) < 0.001);
        if (!key) {
          key = { ...sample(object, current), t: rounded };
          object.keys.push(key);
          object.keys.sort((a, b) => a.t - b.t);
        }
        Object.assign(key, patch);
        renderFrame();
        renderTimeline();
      };

      const addKey = (): void => {
        const object = selected();
        if (!object) return;
        const rounded = Math.round(current * 100) / 100;
        if (object.keys.some((item) => Math.abs(item.t - rounded) < 0.001)) return;
        object.keys.push({ ...sample(object, current), t: rounded });
        object.keys.sort((a, b) => a.t - b.t);
        renderTimeline();
        renderInspector();
      };

      const deleteKey = (): void => {
        const object = selected();
        if (!object) return;
        const rounded = Math.round(current * 100) / 100;
        object.keys = object.keys.filter((item) => Math.abs(item.t - rounded) >= 0.001);
        if (!object.keys.length) object.keys.push({ ...sample(object, 0), t: 0 });
        renderTimeline();
        renderInspector();
      };

      const applyGizmoTransform = (): void => {
        const object = selected();
        const mesh = object?.mesh;
        if (!object || !mesh) return;
        const toDegrees = (radians: number): number => Math.round((radians * 180) / Math.PI);
        const scale = { x: mesh.scale.x, y: mesh.scale.y, z: mesh.scale.z };
        setKeyAtCurrent({
          x: mesh.position.x,
          y: mesh.position.y,
          z: mesh.position.z,
          rotationX: toDegrees(mesh.rotation.x),
          rotation: toDegrees(mesh.rotation.y),
          rotationZ: toDegrees(mesh.rotation.z),
          scaleX: scale.x,
          scaleY: scale.y,
          scaleZ: scale.z,
          scale: (scale.x + scale.y + scale.z) / 3,
        });
      };

      const syncGizmo3d = (): void => {
        if (!controls3d) return;
        const object = selected();
        if (mode !== '3d' || !object?.mesh || playing) {
          controls3d.detach();
          renderFrame();
          updateHud3d();
          return;
        }
        controls3d.setMode(gizmoMode);
        if (controls3d.object !== object.mesh) controls3d.attach(object.mesh);
        renderFrame();
        updateHud3d();
      };

      const updateHud3d = (): void => {
        const object = selected();
        if (mode !== '3d' || !object?.mesh) {
          hud3d.classList.remove('is-visible');
          return;
        }
        const mesh = object.mesh;
        const toDegrees = (radians: number): number => Math.round((radians * 180) / Math.PI);
        const axis = controls3d?.axis ? ` · ${controls3d.axis}` : '';
        if (gizmoMode === 'translate') {
          hud3d.textContent = `${ctx.pick('Move', 'Двигать')}${axis} · X ${mesh.position.x.toFixed(2)}  Y ${mesh.position.y.toFixed(2)}  Z ${mesh.position.z.toFixed(2)}`;
        } else if (gizmoMode === 'rotate') {
          hud3d.textContent = `${ctx.pick('Rotate', 'Вращать')}${axis} · X ${toDegrees(mesh.rotation.x)}°  Y ${toDegrees(mesh.rotation.y)}°  Z ${toDegrees(mesh.rotation.z)}°`;
        } else {
          hud3d.textContent = `${ctx.pick('Scale', 'Масштаб')}${axis} · X ${mesh.scale.x.toFixed(2)}  Y ${mesh.scale.y.toFixed(2)}  Z ${mesh.scale.z.toFixed(2)}`;
        }
        hud3d.classList.add('is-visible');
      };

      // ---------- UI ----------
      const keyCountLabel = (count: number): string => ctx.pick(`${count} keys`, `${count} ключей`);

      const renderObjects = (): void => {
        objectList.replaceChildren();
        const rows: HTMLElement[] = [];
        const appendRow = (object: AnimObject, depth: number): void => {
          const row = h('div', {
            class: `dt-ie-layer-row ${selectedIds.has(object.id) ? 'is-active' : ''} ${object.kind === 'group' ? 'is-group' : ''}`,
            style: { paddingLeft: `${8 + depth * 16}px` },
          });
          if (object.kind === 'group') {
            row.appendChild(
              h(
                'button',
                {
                  class: 'dt-anim-chevron',
                  type: 'button',
                  title: object.collapsed ? ctx.pick('Expand', 'Развернуть') : ctx.pick('Collapse', 'Свернуть'),
                  onclick: (event: MouseEvent) => {
                    event.stopPropagation();
                    object.collapsed = !object.collapsed;
                    renderObjects();
                    renderTimeline();
                  },
                },
                svgIcon(object.collapsed ? ICONS.chevronRight : ICONS.chevronDown, 12),
              ),
            );
          }
          const icon = svgIcon(KIND_ICONS[object.kind], 14);
          icon.classList.add('dt-anim-kind-icon');
          row.appendChild(icon);
          if (renamingId === object.id) {
            const input = textInput({ value: object.name, class: 'dt-anim-rename' });
            const commit = (): void => {
              const value = input.value.trim();
              if (value) object.name = value;
              renamingId = 0;
              renderObjects();
              renderTimeline();
              renderInspector();
            };
            input.addEventListener('keydown', (event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commit();
              } else if (event.key === 'Escape') {
                renamingId = 0;
                renderObjects();
              }
            });
            input.addEventListener('blur', commit);
            row.appendChild(input);
            rows.push(row);
            window.setTimeout(() => {
              input.focus();
              input.select();
            }, 0);
          } else {
            row.appendChild(
              h(
                'button',
                {
                  class: 'dt-ie-layer',
                  type: 'button',
                  ondblclick: () => {
                    renamingId = object.id;
                    renderObjects();
                  },
                  onclick: (event: MouseEvent) => select(object.id, event.ctrlKey || event.metaKey || event.shiftKey),
                },
                h('span', { class: 'dt-ie-layer-name' }, object.name),
              ),
            );
            row.appendChild(h('span', { class: 'dt-ie-layer-kind' }, keyCountLabel(object.keys.length)));
            rows.push(row);
          }
          if (object.kind === 'group' && !object.collapsed) {
            for (const child of childrenOf(object)) appendRow(child, depth + 1);
          }
        };
        for (const object of [...topLevel()].reverse()) appendRow(object, 0);
        objectList.append(...rows);
        if (!activeObjects().length) {
          objectList.appendChild(note(ctx.pick('Add an object to start animating.', 'Добавьте объект, чтобы начать анимацию.'), 'info'));
        }
      };

      const select = (id: number, additive = false): void => {
        if (additive && id) {
          if (selectedIds.has(id) && selectedIds.size > 1) selectedIds.delete(id);
          else selectedIds.add(id);
          selectedId = selectedIds.has(id) ? id : (selectedIds.values().next().value ?? 0);
        } else {
          selectOnly(id);
        }
        renderObjects();
        renderInspector();
        renderTimeline();
        renderFrame();
        syncGizmo3d();
      };

      const renderInspector = (): void => {
        inspector.replaceChildren();
        const object = selected();
        if (!object) {
          inspector.appendChild(note(ctx.pick('Select an object to keyframe it.', 'Выберите объект для анимации.'), 'info'));
          return;
        }
        const key = sample(object, current);
        inspector.appendChild(
          h(
            'div',
            { class: 'dt-row dt-ie-inspector-head' },
            badge(kindLabel(object.kind)),
            h('span', { class: 'dt-ie-layer-title' }, object.name),
          ),
        );
        inspector.appendChild(
          field(
            ctx.pick('Name', 'Имя'),
            textInput({
              value: object.name,
              oninput: (value) => {
                object.name = value;
              },
              onchange: () => {
                renderObjects();
                renderTimeline();
              },
            }),
          ),
        );
        const color = h('input', { type: 'color', class: 'dt-color-input', value: object.color });
        color.addEventListener('input', () => {
          object.color = color.value;
          if (object.mesh) {
            object.mesh.traverse((child) => {
              if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
                child.material.color.set(object.color);
              }
            });
          }
          renderFrame();
        });
        if (object.kind !== 'group') inspector.appendChild(field(ctx.pick('Color', 'Цвет'), color));
        if (object.kind === 'text') {
          inspector.appendChild(
            field(
              ctx.pick('Text', 'Текст'),
              textInput({
                value: object.text,
                oninput: (value) => {
                  object.text = value;
                  draw2d();
                },
              }),
            ),
          );
        }
        const knobs: HTMLElement[] = [];
        const in2d = object.kind === 'group' ? object.groupMode === '2d' : is2d(object.kind);
        if (in2d) {
          knobs.push(
            knobField(ctx.pick('Size', 'Размер'), 20, 400, object.size, (value) => {
              object.size = value;
              draw2d();
            }),
          );
          knobs.push(knobField(ctx.pick('X, %', 'X, %'), 0, 100, Math.round(key.x * 100), (value) => setKeyAtCurrent({ x: value / 100 })));
          knobs.push(knobField(ctx.pick('Y, %', 'Y, %'), 0, 100, Math.round(key.y * 100), (value) => setKeyAtCurrent({ y: value / 100 })));
          knobs.push(
            knobField(ctx.pick('Scale, %', 'Масштаб, %'), 10, 300, Math.round(key.scale * 100), (value) =>
              setKeyAtCurrent({ scale: value / 100 }),
            ),
          );
          knobs.push(
            knobField(ctx.pick('Rotation', 'Поворот'), -180, 180, Math.round(key.rotation), (value) =>
              setKeyAtCurrent({ rotation: value }),
            ),
          );
        } else {
          const axisFormat = (value: number): string => value.toFixed(2);
          knobs.push(knobField('X', -5, 5, Number(key.x.toFixed(2)), (value) => setKeyAtCurrent({ x: value }), { step: 0.1, format: axisFormat }));
          knobs.push(knobField('Y', 0, 6, Number(key.y.toFixed(2)), (value) => setKeyAtCurrent({ y: value }), { step: 0.1, format: axisFormat }));
          knobs.push(knobField('Z', -5, 5, Number(key.z.toFixed(2)), (value) => setKeyAtCurrent({ z: value }), { step: 0.1, format: axisFormat }));
          knobs.push(
            knobField(ctx.pick('Rot X', 'Поворот X'), -180, 180, Math.round(key.rotationX ?? 0), (value) =>
              setKeyAtCurrent({ rotationX: value }),
            ),
          );
          knobs.push(
            knobField(ctx.pick('Rot Y', 'Поворот Y'), -180, 180, Math.round(key.rotation), (value) =>
              setKeyAtCurrent({ rotation: value }),
            ),
          );
          knobs.push(
            knobField(ctx.pick('Rot Z', 'Поворот Z'), -180, 180, Math.round(key.rotationZ ?? 0), (value) =>
              setKeyAtCurrent({ rotationZ: value }),
            ),
          );
          knobs.push(
            knobField(ctx.pick('Scale X, %', 'Масштаб X, %'), 10, 300, Math.round((key.scaleX ?? key.scale) * 100), (value) =>
              setKeyAtCurrent({ scaleX: value / 100 }),
            ),
          );
          knobs.push(
            knobField(ctx.pick('Scale Y, %', 'Масштаб Y, %'), 10, 300, Math.round((key.scaleY ?? key.scale) * 100), (value) =>
              setKeyAtCurrent({ scaleY: value / 100 }),
            ),
          );
          knobs.push(
            knobField(ctx.pick('Scale Z, %', 'Масштаб Z, %'), 10, 300, Math.round((key.scaleZ ?? key.scale) * 100), (value) =>
              setKeyAtCurrent({ scaleZ: value / 100 }),
            ),
          );
        }
        knobs.push(
          knobField(ctx.pick('Opacity, %', 'Прозрачность, %'), 0, 100, Math.round(key.opacity * 100), (value) =>
            setKeyAtCurrent({ opacity: value / 100 }),
          ),
        );
        inspector.appendChild(knobGrid(...knobs));
        inspector.appendChild(
          toolbar(
            btn(ctx.pick('Add key', 'Добавить ключ'), addKey, { variant: 'primary' }),
            btn(ctx.pick('Delete key', 'Удалить ключ'), deleteKey, { variant: 'ghost' }),
          ),
        );
        inspector.appendChild(
          toolbar(
            iconBtn(
              ICONS.group,
              ctx.pick('Group selection (Ctrl+click rows to select several)', 'Сгруппировать выделенные (Ctrl+клик по строкам — мультивыбор)'),
              groupSelected,
              { variant: 'ghost' },
            ),
            iconBtn(ICONS.ungroup, ctx.pick('Ungroup', 'Разгруппировать'), ungroupSelected, { variant: 'ghost' }),
            iconBtn(ICONS.trash, ctx.pick('Delete object', 'Удалить объект'), deleteObject, { variant: 'danger' }),
          ),
        );
      };

      const renderTimeline = (): void => {
        rulerLabel.textContent = ctx.pick('Object', 'Объект');
        rulerTrack.replaceChildren();
        const ticks = Math.max(10, Math.round(10 * timelineZoom));
        for (let index = 0; index <= ticks; index++) {
          const time = (duration / ticks) * index;
          const tick = h('span', { class: 'dt-anim-tick' }, `${time.toFixed(2)}s`);
          tick.style.left = `${(index / ticks) * 100}%`;
          rulerTrack.appendChild(tick);
        }
        rowsHost.replaceChildren();
        const rows: HTMLElement[] = [];
        const walk = (object: AnimObject, depth: number): void => {
          const track = h('div', { class: 'dt-anim-row-track' });
          for (const key of object.keys) {
            const marker = h('button', {
              class: `dt-anim-key ${Math.abs(key.t - current) < 0.001 ? 'is-current' : ''}`,
              type: 'button',
              title: `${key.t.toFixed(2)} s`,
            });
            marker.style.left = `${duration > 0 ? clamp(key.t / duration, 0, 1) * 100 : 0}%`;
            marker.addEventListener('click', (event) => {
              event.stopPropagation();
              selectOnly(object.id);
              current = key.t;
              renderObjects();
              renderInspector();
              updatePlayhead();
              renderFrame();
              syncGizmo3d();
            });
            track.appendChild(marker);
          }
          const label = h(
            'button',
            {
              class: `dt-anim-row-label ${object.kind === 'group' ? 'is-group' : ''}`,
              type: 'button',
              title: object.name,
              style: { paddingLeft: `${8 + depth * 14}px` },
              onclick: (event: MouseEvent) => select(object.id, event.ctrlKey || event.metaKey || event.shiftKey),
            },
            h('span', { class: 'dt-anim-row-dot' }),
            h('span', { class: 'dt-anim-row-name' }, object.name),
            h('span', { class: 'dt-anim-row-count' }, String(object.keys.length)),
          );
          label.querySelector<HTMLElement>('.dt-anim-row-dot')!.style.background =
            object.kind === 'group' ? '#94a3b8' : object.color;
          rows.push(h('div', { class: `dt-anim-row ${selectedIds.has(object.id) ? 'is-active' : ''}` }, label, track));
          if (object.kind === 'group' && !object.collapsed) {
            for (const child of childrenOf(object)) walk(child, depth + 1);
          }
        };
        const visible = topLevel();
        for (const object of visible) walk(object, 0);
        rowsHost.append(...rows);
        if (!visible.length) {
          rowsHost.appendChild(
            note(ctx.pick('Add an object to see its keyframes.', 'Добавьте объект, чтобы увидеть его ключевые кадры.'), 'info'),
          );
        }
        updatePlayhead();
      };

      const updatePlayhead = (): void => {
        playhead.style.left = `${(current / duration) * 100}%`;
        timeLabel.textContent = `${current.toFixed(2)} s`;
      };

      const syncUi = (): void => {
        updateStageVisibility();
        renderObjects();
        renderInspector();
        renderTimeline();
        renderAddButtons();
        renderFrame();
        syncGizmo3d();
      };

      const updateStageVisibility = (): void => {
        stage2d.style.display = mode === '2d' ? '' : 'none';
        stage3d.style.display = mode === '3d' ? '' : 'none';
        gizmoSegment.style.display = '';
        if (mode === '2d') fitCanvas2d();
        if (mode === '3d') {
          ensure3d();
          resize();
        }
        syncGizmo3d();
      };

      const seek = (time: number): void => {
        current = clamp(time, 0, duration);
        updatePlayhead();
        renderFrame();
      };

      // ---------- playback ----------
      const tick = (now: number): void => {
        if (!playing) return;
        const delta = lastFrame ? (now - lastFrame) / 1000 : 0;
        lastFrame = now;
        current += delta;
        if (current >= duration) current = 0;
        updatePlayhead();
        renderFrame();
        requestAnimationFrame(tick);
      };

      const play = (): void => {
        if (playing) return;
        playing = true;
        lastFrame = 0;
        controls3d?.detach();
        playBtn.querySelector('.dt-btn-label')!.textContent = ctx.pick('Pause', 'Пауза');
        requestAnimationFrame(tick);
      };

      const pause = (): void => {
        playing = false;
        playBtn.querySelector('.dt-btn-label')!.textContent = ctx.pick('Play', 'Играть');
        syncGizmo3d();
      };

      const playBtn = btn(ctx.pick('Play', 'Играть'), () => (playing ? pause() : play()), {
        variant: 'primary',
        icon: '<path d="M7 4v16l13 -8z"/>',
      });

      timeline.addEventListener('pointerdown', (event) => {
        const rect = rulerTrack.getBoundingClientRect();
        const ratio = clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
        seek(ratio * duration);
        renderInspector();
      });

      timeline.append(ruler, rowsHost, trackLayer);
      timeline.style.width = '100%';

      const applyTimelineZoom = (next: number): void => {
        const zoomed = clamp(next, 1, 8);
        if (zoomed === timelineZoom) return;
        timelineZoom = zoomed;
        timeline.style.width = `${timelineZoom * 100}%`;
        timelineZoomLabel.textContent = `${Math.round(timelineZoom * 100)}%`;
        renderTimeline();
      };

      // Ctrl+wheel zooms the timeline around the pointer.
      timelineScroll.addEventListener(
        'wheel',
        (event) => {
          if (!event.ctrlKey) return;
          event.preventDefault();
          const bounds = timelineScroll.getBoundingClientRect();
          const pointer = event.clientX - bounds.left;
          const contentX = timelineScroll.scrollLeft + pointer;
          const previousWidth = timelineScroll.scrollWidth || 1;
          const factor = event.deltaY < 0 ? 1.25 : 1 / 1.25;
          const zoomed = clamp(timelineZoom * factor, 1, 8);
          if (zoomed === timelineZoom) return;
          timelineZoom = zoomed;
          timeline.style.width = `${timelineZoom * 100}%`;
          timelineZoomLabel.textContent = `${Math.round(timelineZoom * 100)}%`;
          renderTimeline();
          const width = timelineScroll.scrollWidth || 1;
          timelineScroll.scrollLeft = (contentX / previousWidth) * width - pointer;
        },
        { passive: false },
      );

      // ---------- import / export ----------
      const saveProject = (): void => {
        const project: ProjectFile = {
          mode,
          duration,
          width: docWidth,
          height: docHeight,
          objects: objects
            .filter((object) => object.kind !== 'model')
            .map(({ mesh, ...rest }) => rest),
        };
        downloadBlob('animation-project.json', new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }));
      };

      const loadProject = async (file: File): Promise<void> => {
        try {
          const project = JSON.parse(await file.text()) as ProjectFile;
          for (const object of objects) if (object.mesh && scene3d) scene3d.remove(object.mesh);
          objects.length = 0;
          mode = project.mode === '3d' ? '3d' : '2d';
          duration = Math.max(0.5, Number(project.duration) || 5);
          applyResolution(Number(project.width) || 960, Number(project.height) || 540);
          for (const raw of project.objects) {
            objects.push({ ...raw, id: nextId++, keys: raw.keys.map((key) => ({ ...key })) });
          }
          selectedId = objects[0]?.id ?? 0;
          selectedIds.clear();
          if (selectedId) selectedIds.add(selectedId);
          reflectMode();
          syncUi();
        } catch {
          setError(error, ctx.pick('Invalid animation project.', 'Некорректный файл проекта анимации.'));
        }
      };

      const importSvg = async (file: File): Promise<void> => {
        try {
          const parsed = new DOMParser().parseFromString(await file.text(), 'image/svg+xml');
          if (parsed.querySelector('parsererror')) throw new Error('svg');
          const svg = parsed.documentElement;
          const width = Number.parseFloat(svg.getAttribute('width') ?? '') || 960;
          const height = Number.parseFloat(svg.getAttribute('height') ?? '') || 540;
          let imported = 0;
          for (const element of Array.from(svg.querySelectorAll('rect, circle, ellipse, text'))) {
            const tag = element.tagName.toLowerCase();
            const fill = element.getAttribute('fill') ?? '#60a5fa';
            const baseKey = defaultKey();
            if (tag === 'text') {
              const x = Number.parseFloat(element.getAttribute('x') ?? '0');
              const y = Number.parseFloat(element.getAttribute('y') ?? '0');
              objects.push({
                id: nextId++,
                name: (element.textContent ?? '').trim() || `Text ${objects.length + 1}`,
                kind: 'text',
                color: fill,
                size: Number.parseFloat(element.getAttribute('font-size') ?? '48') || 48,
                text: (element.textContent ?? '').trim(),
                keys: [{ ...baseKey, x: x / width, y: y / height }],
              });
              imported++;
              continue;
            }
            const size = tag === 'rect'
              ? Math.max(Number.parseFloat(element.getAttribute('width') ?? '10'), Number.parseFloat(element.getAttribute('height') ?? '10'))
              : Number.parseFloat(element.getAttribute('r') ?? element.getAttribute('rx') ?? '20') * 2;
            const x = Number.parseFloat(element.getAttribute('x') ?? element.getAttribute('cx') ?? '0');
            const y = Number.parseFloat(element.getAttribute('y') ?? element.getAttribute('cy') ?? '0');
            objects.push({
              id: nextId++,
              name: `${tag} ${objects.length + 1}`,
              kind: tag === 'rect' ? 'rect' : 'ellipse',
              color: fill,
              size: Math.max(20, size),
              text: '',
              keys: [{ ...baseKey, x: x / width, y: y / height }],
            });
            imported++;
          }
          mode = '2d';
          selectedId = objects[objects.length - 1]?.id ?? 0;
          selectedIds.clear();
          if (selectedId) selectedIds.add(selectedId);
          reflectMode();
          syncUi();
          renderAddButtons();
          if (!imported) setError(error, ctx.pick('No supported shapes found in this SVG.', 'В этом SVG не найдено поддерживаемых фигур.'));
        } catch {
          setError(error, ctx.pick('Cannot read this SVG.', 'Не удалось прочитать SVG.'));
        }
      };

      const importModel = async (file: File): Promise<void> => {
        try {
          ensure3d();
          const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
          let object: THREE.Object3D | null = null;
          if (extension === 'obj') object = new OBJLoader().parse(await file.text());
          else if (extension === 'stl') {
            const geometry = new STLLoader().parse(await file.arrayBuffer());
            object = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: '#94a3b8' }));
          } else if (extension === 'glb' || extension === 'gltf') {
            object = (await new GLTFLoader().parseAsync(await file.arrayBuffer(), '')).scene;
          }
          if (!object || !scene3d) {
            setError(error, ctx.pick('Supported: OBJ, STL, GLB, GLTF.', 'Поддерживаются: OBJ, STL, GLB, GLTF.'));
            return;
          }
          object.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          const box = new THREE.Box3().setFromObject(object);
          const size = box.getSize(new THREE.Vector3());
          const maxSide = Math.max(size.x, size.y, size.z) || 1;
          object.scale.multiplyScalar(2.6 / maxSide);
          const fitted = new THREE.Box3().setFromObject(object);
          object.position.x -= fitted.getCenter(new THREE.Vector3()).x;
          object.position.z -= fitted.getCenter(new THREE.Vector3()).z;
          object.position.y -= fitted.min.y;
          const group = new THREE.Group();
          group.add(object);
          scene3d.add(group);
          mode = '3d';
          const key: AnimKey = { t: 0, x: 0, y: 0, z: 0, scale: 1, rotation: 0, opacity: 1 };
          objects.push({
            id: nextId++,
            name: file.name,
            kind: 'model',
            color: '#94a3b8',
            size: 1,
            text: '',
            keys: [key],
            mesh: group,
          });
          selectedId = objects[objects.length - 1].id;
          selectedIds.clear();
          selectedIds.add(selectedId);
          reflectMode();
          syncUi();
        } catch {
          setError(error, ctx.pick('Cannot read this 3D model.', 'Не удалось прочитать 3D-модель.'));
        }
      };

      const hexToRgb = (value: string): [number, number, number] => {
        const hex = value.replace('#', '');
        const full = hex.length === 3 ? hex.split('').map((part) => part + part).join('') : hex;
        const numeric = Number.parseInt(full, 16);
        return [((numeric >> 16) & 0xff) / 255, ((numeric >> 8) & 0xff) / 255, (numeric & 0xff) / 255];
      };

      const exportLottie = (): void => {
        const fps = 30;
        const layers = objects
          .filter((object) => is2d(object.kind) && object.kind !== 'text')
          .map((object, index) => {
            const [r, g, b] = hexToRgb(object.color);
            const keys = [...object.keys].sort((a, b) => a.t - b.t);
            const animated = (property: (key: AnimKey) => number[]): unknown =>
              keys.length > 1
                ? { a: 1, k: keys.map((key) => ({ t: Math.round(key.t * fps), s: property(key) })) }
                : { a: 0, k: property(keys[0]) };
            return {
              ddd: 0,
              ind: index + 1,
              ty: 4,
              nm: object.name,
              sr: 1,
              ks: {
                o: animated((key) => [key.opacity * 100]),
                r: animated((key) => [key.rotation]),
                p: animated((key) => [key.x * docWidth, key.y * docHeight]),
                s: animated((key) => [key.scale * 100, key.scale * 100]),
                a: { a: 0, k: [0, 0] },
              },
              ao: 0,
              shapes: [
                {
                  ty: 'gr',
                  it: [
                    object.kind === 'rect'
                      ? { ty: 'rc', d: 1, s: { a: 0, k: [object.size, object.size * 0.6] }, p: { a: 0, k: [0, 0] }, r: 0 }
                      : { ty: 'el', d: 1, s: { a: 0, k: [object.size, object.size * 0.6] }, p: { a: 0, k: [0, 0] } },
                    { ty: 'fl', c: { a: 0, k: [r, g, b, 1] }, o: { a: 0, k: 100 } },
                    { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
                  ],
                },
              ],
              ip: 0,
              op: Math.round(duration * fps),
              st: 0,
              bm: 0,
            };
          });
        const lottie = {
          v: '5.7.4',
          fr: 30,
          ip: 0,
          op: Math.round(duration * 30),
          w: docWidth,
          h: docHeight,
          nm: 'Dev Tools Animation',
          ddd: 0,
          assets: [],
          layers,
        };
        downloadBlob('animation.json', new Blob([JSON.stringify(lottie, null, 2)], { type: 'application/json' }));
      };

      const exportCanvas = (): HTMLCanvasElement => (mode === '2d' ? canvas2d : (renderer?.domElement ?? canvas2d));

      const renderPng = (): void => {
        exporting = true;
        renderFrame();
        const source = exportCanvas();
        source.toBlob((value) => {
          exporting = false;
          renderFrame();
          if (value) downloadBlob('animation.png', value);
        }, 'image/png');
      };

      const exportVideo = async (): Promise<void> => {
        const source = exportCanvas();
        if (typeof MediaRecorder === 'undefined') {
          setError(error, ctx.pick('MediaRecorder is not available.', 'MediaRecorder недоступен.'));
          return;
        }
        const stream = source.captureStream(30);
        const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((type) =>
          MediaRecorder.isTypeSupported(type),
        ) ?? 'video/webm';
        const chunks: BlobPart[] = [];
        const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5_000_000 });
        recorder.ondataavailable = (event) => {
          if (event.data.size) chunks.push(event.data);
        };
        const stopped = new Promise<void>((resolve) => {
          recorder.onstop = () => resolve();
        });
        current = 0;
        try {
          exporting = true;
          renderFrame();
          recorder.start(200);
          const startedAt = performance.now();
          await new Promise<void>((resolve) => {
            const step = (now: number): void => {
              const elapsed = (now - startedAt) / 1000;
              current = Math.min(duration, elapsed);
              updatePlayhead();
              renderFrame();
              if (elapsed >= duration) {
                resolve();
                return;
              }
              requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
          });
          recorder.stop();
          await stopped;
          downloadBlob('animation.webm', new Blob(chunks, { type: mime }));
        } finally {
          exporting = false;
          renderFrame();
        }
      };

      const captureGifFrame = (maxWidth: number): { pixels: Uint8ClampedArray; width: number; height: number } => {
        const source = exportCanvas();
        const sourceWidth = Math.max(1, source.width);
        const sourceHeight = Math.max(1, source.height);
        const scale = Math.min(1, maxWidth / sourceWidth);
        const width = Math.max(2, Math.round(sourceWidth * scale));
        const height = Math.max(2, Math.round(sourceHeight * scale));
        const buffer = document.createElement('canvas');
        buffer.width = width;
        buffer.height = height;
        const context = buffer.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('canvas');
        context.drawImage(source, 0, 0, width, height);
        return { pixels: context.getImageData(0, 0, width, height).data, width, height };
      };

      const exportGif = async (): Promise<void> => {
        const wasPlaying = playing;
        if (wasPlaying) pause();
        const previousTime = current;
        const fps = Math.max(2, Math.round(gifFps));
        const frameCount = Math.max(2, Math.round(duration * fps));
        const frames: GifFrame[] = [];
        let width = 0;
        let height = 0;
        exporting = true;
        try {
          for (let index = 0; index < frameCount; index++) {
            current = (index / frameCount) * duration;
            updatePlayhead();
            renderFrame();
            const frame = captureGifFrame(gifWidth);
            width = frame.width;
            height = frame.height;
            frames.push({ pixels: frame.pixels, delay: 1000 / fps });
            gifStatus.textContent = `${ctx.pick('Rendering', 'Рендер')} ${index + 1} / ${frameCount}`;
            await new Promise<void>((resolve) => setTimeout(resolve, 0));
          }
          gifStatus.textContent = ctx.pick('Encoding GIF…', 'Кодирование GIF…');
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
          const bytes = encodeGif(frames, width, height);
          downloadBlob('animation.gif', new Blob([bytes.slice()], { type: 'image/gif' }));
          gifStatus.textContent = `${frameCount} frames · ${width}×${height} · ${(bytes.length / 1024).toFixed(0)} KB`;
        } catch {
          setError(error, ctx.pick('Cannot build the GIF.', 'Не удалось создать GIF.'));
          gifStatus.textContent = '';
        } finally {
          exporting = false;
          current = previousTime;
          updatePlayhead();
          renderFrame();
          if (wasPlaying) play();
        }
      };

      // ---------- panes ----------
      const RESOLUTIONS: Array<[number, number, string]> = [
        [1920, 1080, '16:9 · Full HD'],
        [1280, 720, '16:9 · HD'],
        [960, 540, '16:9 · SD'],
        [800, 600, '4:3'],
        [1080, 1080, '1:1 · Square'],
        [1080, 1920, '9:16 · Story'],
      ];
      const resWidth = textInput({ type: 'number', value: docWidth, min: 64, max: 4096, step: 2 });
      const resHeight = textInput({ type: 'number', value: docHeight, min: 64, max: 4096, step: 2 });
      const presetSelect = selectInput(
        [
          ...RESOLUTIONS.map(([width, height, label]) => ({ value: `${width}x${height}`, label: `${width}×${height} · ${label}` })),
          { value: 'custom', label: ctx.pick('Custom', 'Своё') },
        ],
        `${docWidth}x${docHeight}`,
        (value) => {
          if (value === 'custom') return;
          const [width, height] = value.split('x').map(Number);
          applyResolution(width, height);
        },
      );
      const applyResolution = (width: number, height: number): void => {
        docWidth = clamp(Math.round(Number.isFinite(width) ? width : docWidth), 64, 4096);
        docHeight = clamp(Math.round(Number.isFinite(height) ? height : docHeight), 64, 4096);
        resWidth.value = String(docWidth);
        resHeight.value = String(docHeight);
        const preset = `${docWidth}x${docHeight}`;
        presetSelect.value = Array.from(presetSelect.options).some((option) => option.value === preset) ? preset : 'custom';
        canvas2d.width = docWidth;
        canvas2d.height = docHeight;
        stage3d.style.aspectRatio = `${docWidth} / ${docHeight}`;
        fitCanvas2d();
        renderFrame();
        resize();
      };
      /** Keeps the 2D canvas inside the stage without distorting the project aspect ratio. */
      function fitCanvas2d(): void {
        const available = Math.max(120, stage2d.clientWidth - 12);
        const maxHeight = Math.min(window.innerHeight * 0.56, 620);
        const scale = Math.min(available / docWidth, maxHeight / docHeight);
        canvas2d.style.width = `${Math.max(60, Math.round(docWidth * scale))}px`;
        canvas2d.style.height = `${Math.max(40, Math.round(docHeight * scale))}px`;
      }
      resWidth.addEventListener('change', () => applyResolution(Number(resWidth.value), docHeight));
      resHeight.addEventListener('change', () => applyResolution(docWidth, Number(resHeight.value)));

      const projectPane = pane(
        ctx.pick('Project', 'Проект'),
        h(
          'div',
          { class: 'dt-stack' },
          field(
            ctx.pick('Duration, s', 'Длительность, с'),
            textInput({
              type: 'number',
              value: duration,
              min: 0.5,
              step: 0.5,
              oninput: (value) => {
                const parsed = Number(value);
                if (Number.isFinite(parsed) && parsed >= 0.5) {
                  duration = parsed;
                  renderTimeline();
                }
              },
            }),
          ),
          field(ctx.pick('Resolution', 'Разрешение'), presetSelect),
          h(
            'div',
            { class: 'dt-inline-form' },
            field(ctx.pick('Width, px', 'Ширина, px'), resWidth),
            field(ctx.pick('Height, px', 'Высота, px'), resHeight),
          ),
          toolbar(
            btn(ctx.pick('Save project', 'Сохранить проект'), saveProject, { variant: 'ghost' }),
            btn(ctx.pick('Open project', 'Открыть проект'), () => projectInput.click(), { variant: 'ghost' }),
          ),
          toolbar(
            btn(ctx.pick('Import SVG (2D)', 'Импорт SVG (2D)'), () => svgInput.click(), { variant: 'ghost' }),
            btn(ctx.pick('Import model (3D)', 'Импорт модели (3D)'), () => modelInput.click(), { variant: 'ghost' }),
          ),
        ),
      );

      const gifStatus = h('div', { class: 'dt-hint' }, '');

      const exportPane = pane(
        ctx.pick('Export', 'Экспорт'),
        h(
          'div',
          { class: 'dt-stack' },
          knobGrid(
            knobField('GIF FPS', 6, 30, gifFps, (value) => {
              gifFps = Math.round(value);
            }),
            knobField(ctx.pick('GIF width, px', 'Ширина GIF, px'), 240, 1280, gifWidth, (value) => {
              gifWidth = Math.round(value);
            }),
          ),
          toolbar(
            btn('GIF', () => void exportGif(), { variant: 'primary', icon: ICONS.download }),
            btn('WebM', () => void exportVideo(), { variant: 'primary', icon: ICONS.download }),
            btn('PNG', renderPng, { variant: 'ghost', icon: ICONS.download }),
            btn('Lottie JSON', exportLottie, { variant: 'ghost' }),
          ),
          gifStatus,
          note(
            ctx.pick(
              'GIF renders frame by frame (use the GIF FPS and width knobs), WebM is recorded in real time. Lottie export covers 2D shapes. Imported 3D models are not stored in project files.',
              'GIF рендерится покадрово (настройте FPS и ширину GIF), WebM пишется в реальном времени. Lottie покрывает 2D-фигуры. Импортированные 3D-модели не сохраняются в проекте.',
            ),
            'info',
          ),
        ),
      );

      const projectInput = h('input', { type: 'file', accept: '.json,application/json', class: 'dt-hidden' });
      const svgInput = h('input', { type: 'file', accept: '.svg,image/svg+xml', class: 'dt-hidden' });
      const modelInput = h('input', { type: 'file', accept: '.obj,.stl,.glb,.gltf', class: 'dt-hidden' });
      projectInput.addEventListener('change', () => {
        const file = projectInput.files?.[0];
        if (file) void loadProject(file);
        projectInput.value = '';
      });
      svgInput.addEventListener('change', () => {
        const file = svgInput.files?.[0];
        if (file) void importSvg(file);
        svgInput.value = '';
      });
      modelInput.addEventListener('change', () => {
        const file = modelInput.files?.[0];
        if (file) void importModel(file);
        modelInput.value = '';
      });

      const addToolbar = h('div', { class: 'dt-toolbar dt-anim-add' });
      const renderAddButtons = (): void => {
        addToolbar.replaceChildren();
        for (const kind of ADD_KINDS[mode]) {
          addToolbar.appendChild(iconBtn(KIND_ICONS[kind], kindLabel(kind), () => addObject(kind), { variant: 'ghost' }));
        }
      };

      const resize = (): void => {
        if (!renderer || !camera3d) return;
        const width = Math.max(1, stage3d.clientWidth);
        const height = Math.max(1, stage3d.clientHeight);
        renderer.setSize(width, height, false);
        camera3d.aspect = width / height;
        camera3d.updateProjectionMatrix();
      };
      const observer = new ResizeObserver(() => {
        if (!root.isConnected) {
          observer.disconnect();
          return;
        }
        resize();
        if (mode === '2d') fitCanvas2d();
      });
      observer.observe(stage3d);

      let stageRatio = 0.8;
      const stageColumn = h(
        'div',
        { class: 'dt-col' },
        h('div', { class: 'dt-toolbar' }, modeSegment, gizmoSegment, playBtn, timeLabel, h('span', { class: 'dt-grow' }), addToolbar),
        pane(ctx.pick('Stage', 'Сцена'), h('div', { class: 'dt-stack' }, stage2d, stage3d), [], '', { collapsible: false }),
      );
      const sideColumn = h(
        'div',
        { class: 'dt-col' },
        tabs([
          { id: 'objects', label: ctx.pick('Objects', 'Объекты'), render: () => pane(ctx.pick('Objects', 'Объекты'), objectList) },
          { id: 'keys', label: ctx.pick('Keyframes', 'Ключи'), render: () => pane(ctx.pick('Keyframes', 'Ключевые кадры'), inspector) },
          { id: 'project', label: ctx.pick('Project', 'Проект'), render: () => projectPane },
          { id: 'export', label: ctx.pick('Export', 'Экспорт'), render: () => exportPane },
        ]),
      );
      const stageSplitter = h('div', {
        class: 'dt-split-handle',
        role: 'separator',
        title: ctx.pick('Drag to resize the stage (30–85%)', 'Потяните, чтобы изменить ширину сцены (30–85%)'),
      });
      const workspace = h('div', { class: 'dt-split dt-split-resizable' }, stageColumn, stageSplitter, sideColumn);
      const sideMinWidth = (): number => {
        const tabBar = sideColumn.querySelector<HTMLElement>('.dt-tabs');
        if (!tabBar) return 320;
        const previous = tabBar.style.flexWrap;
        tabBar.style.flexWrap = 'nowrap';
        const needed = Math.ceil(tabBar.scrollWidth + 26);
        tabBar.style.flexWrap = previous;
        return clamp(needed, 300, 560);
      };
      const applyStageRatio = (ratio: number): void => {
        const minSide = sideMinWidth();
        workspace.style.setProperty('--dt-split-min-side', `${minSide}px`);
        const width = workspace.clientWidth;
        // Before the first layout the width is 0, so keep the requested ratio.
        const maxRatio = width > 40 ? Math.max(0.3, clamp(1 - (minSide + 10) / width, 0.3, 0.85)) : 0.85;
        stageRatio = clamp(ratio, 0.3, maxRatio);
        workspace.style.setProperty('--dt-split-ratio', `${(stageRatio * 100).toFixed(2)}%`);
        resize();
        fitCanvas2d();
      };
      applyStageRatio(stageRatio);
      stageSplitter.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        const bounds = workspace.getBoundingClientRect();
        stageSplitter.setPointerCapture(event.pointerId);
        stageSplitter.classList.add('is-active');
        const move = (moveEvent: PointerEvent): void => {
          if (!bounds.width) return;
          applyStageRatio((moveEvent.clientX - bounds.left) / bounds.width);
        };
        const stop = (): void => {
          stageSplitter.classList.remove('is-active');
          stageSplitter.removeEventListener('pointermove', move);
          stageSplitter.removeEventListener('pointerup', stop);
          stageSplitter.removeEventListener('pointercancel', stop);
        };
        stageSplitter.addEventListener('pointermove', move);
        stageSplitter.addEventListener('pointerup', stop);
        stageSplitter.addEventListener('pointercancel', stop);
      });
      window.addEventListener('resize', () => {
        if (!workspace.isConnected) return;
        applyStageRatio(stageRatio);
      });

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          error,
          workspace,
          pane(
            ctx.pick('Timeline', 'Таймлайн'),
            h('div', { class: 'dt-timeline-wide' }, timelineScroll),
            [
              btn('−', () => applyTimelineZoom(timelineZoom / 1.5), {
                variant: 'subtle',
                title: ctx.pick('Zoom out (Ctrl+wheel)', 'Уменьшить масштаб (Ctrl+колесо)'),
              }),
              timelineZoomLabel,
              btn('+', () => applyTimelineZoom(timelineZoom * 1.5), {
                variant: 'subtle',
                title: ctx.pick('Zoom in (Ctrl+wheel)', 'Увеличить масштаб (Ctrl+колесо)'),
              }),
              iconBtn(
                '<path d="M4 9V4h5"/><path d="M20 9V4h-5"/><path d="M4 15v5h5"/><path d="M20 15v5h-5"/>',
                ctx.pick('Fit the whole duration', 'Вписать всю длительность'),
                () => applyTimelineZoom(1),
                { variant: 'subtle' },
              ),
            ],
            '',
            { collapsible: false },
          ),
          h('div', { class: 'dt-hint' }, ctx.pick(
            'Click the timeline to seek, Ctrl+wheel or ± to zoom it. Change properties or drag the gizmo to create keys. Double-click a name to rename; Ctrl-click rows to select several and group them.',
            'Кликайте по таймлайну для перехода, Ctrl+колесо или ± — масштаб таймлайна. Меняйте свойства или тяните гизмо, чтобы создавать ключи. Двойной клик по имени — переименовать; Ctrl+клик по строкам — мультивыбор и группировка.',
          )),
        ),
      );
      root.append(projectInput, svgInput, modelInput);

      // ---------- boot ----------
      applyStageRatio(stageRatio);
      updateStageVisibility();
      syncUi();
      addObject('rect');
    },
  });
}

export const animationTools = [animationTool()];
