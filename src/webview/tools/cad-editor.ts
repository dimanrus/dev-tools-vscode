/** CAD editor: sketch, push/pull, precise dimensions, layers, scenes, measure and model exchange. */
import * as THREE from 'three';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { TDSLoader } from 'three/examples/jsm/loaders/TDSLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import {
  badge,
  btn,
  checkbox,
  downloadBlob,
  errorSlot,
  field,
  iconBtn,
  note,
  pane,
  segmented,
  select,
  setError,
  split,
  textInput,
  toolbar,
} from '../components.ts';
import { clamp, h } from '../dom.ts';
import { svgIcon } from '../dom.ts';
import { defineTool } from '../tool-types.ts';

type CadTool = 'select' | 'rect' | 'circle' | 'pushpull' | 'measure' | 'line';
type CadMode = 'move' | 'rotate' | 'scale';
type PartKind = 'box' | 'cylinder' | 'model';
type StyleMode = 'solid' | 'wireframe' | 'blueprint';
type SnapType = 'vertex' | 'face' | 'grid';
type FaceAxis = 'x' | 'y' | 'z';

interface CadLayer {
  id: number;
  name: string;
  visible: boolean;
}

interface CadPart {
  id: number;
  kind: PartKind;
  name: string;
  mesh: THREE.Object3D;
  width: number;
  depth: number;
  height: number;
  radius: number;
  layerId: number;
  componentId: number | null;
  color: string;
  texture: THREE.Texture | null;
  visible: boolean;
  modelSource?: string;
}

interface Measurement {
  id: number;
  a: THREE.Vector3;
  b: THREE.Vector3;
  line: THREE.Line;
  label: HTMLSpanElement;
}

interface CadLineObject {
  id: number;
  points: THREE.Vector3[];
  object: THREE.Line;
  layerId: number;
}

interface SnapResult {
  point: THREE.Vector3;
  type: SnapType;
}

interface FaceInfo {
  part: CadPart;
  axis: FaceAxis;
  sign: number;
  normal: THREE.Vector3;
  localCenter: THREE.Vector3;
  sizeU: number;
  sizeV: number;
}

interface FaceDrag {
  part: CadPart;
  axis: FaceAxis;
  normalWorld: THREE.Vector3;
  screenDir: THREE.Vector2;
  startX: number;
  startY: number;
  startPosition: THREE.Vector3;
  startDims: { width: number; depth: number; height: number; radius: number };
}

interface CadScene {
  id: number;
  name: string;
  theta: number;
  phi: number;
  radius: number;
  target: [number, number, number];
  layers: Record<number, boolean>;
}

interface CadDrag {
  mode: 'create' | 'pushpull' | CadMode;
  tool: CadTool;
  startGround: THREE.Vector3;
  startX: number;
  startY: number;
  part: CadPart | null;
  startHeight: number;
  startPosition: THREE.Vector3;
  startRotation: number;
  startScale: number;
  startDims: { width: number; depth: number; height: number; radius: number };
}

const ICONS = {
  eye: '<path d="M2 12s3.5 -6 10 -6s10 6 10 6s-3.5 6 -10 6s-10 -6 -10 -6z"/><path d="M12 15a3 3 0 1 0 0 -6a3 3 0 0 0 0 6z"/>',
  eyeOff: '<path d="M10.6 10.6a3 3 0 0 0 4.2 4.2"/><path d="M4 4l16 16"/><path d="M6.7 6.7c-2.3 1.6 -3.9 3.5 -4.7 5.3c1.7 3.6 5.3 6 10 6c1.4 0 2.7 -.3 3.9 -.7"/><path d="M9.9 5.2c.7 -.1 1.4 -.2 2.1 -.2c4.7 0 8.3 2.4 10 6c-.4 .9 -1 1.8 -1.7 2.6"/>',
  trash: '<path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"/><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3"/>',
  duplicate: '<path d="M7 7m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z"/><path d="M5 15v-8a2 2 0 0 1 2 -2h8"/>',
} as const;

function cadEditorTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'media-cad-editor',
    group: 'media',
    icon: '<path d="M4 20l4 -9l4 9z"/><path d="M14 20v-6h6v6z"/><path d="M4 7l4 -4l4 4l-4 4z"/><path d="M12 12l6 -3l4 3l-4 3z"/>',
    name: { en: 'CAD Editor', ru: 'CAD-редактор' },
    desc: {
      en: 'Sketch footprints, push/pull any face, snap lines and measurements to vertices/faces, use layers/scenes and exchange OBJ/STL/GLB/FBX.',
      ru: 'Черчение контуров, выдавливание любой грани, линии и замеры с привязкой к вершинам/граням, слои/сцены и обмен OBJ/STL/GLB/FBX.',
    },
    keywords: 'cad sketchup push pull face measure snap vertex line dimension layers scenes components obj stl glb fbx dae 3ds texture',
    mount(root, ctx) {
      let nextId = 1;
      let nextLayerId = 2;
      let nextComponentId = 1;
      let nextSceneId = 1;
      let nextMeasureId = 1;
      let nextLineId = 1;
      let selectedId = 0;
      let activeLayerId = 1;
      let tool: CadTool = 'rect';
      let mode: CadMode = 'move';
      let snap = true;
      let color = '#60a5fa';
      let styleMode: StyleMode = 'solid';
      let shadows = true;
      let theta = Math.PI / 4;
      let phi = Math.PI / 3.4;
      let radius = 14;
      let drag: CadDrag | null = null;
      let orbiting = false;
      let moved = false;
      let gizmoPointer = false;
      let faceDrag: FaceDrag | null = null;
      let lastPointer = { x: 0, y: 0 };
      let pendingMeasure: THREE.Vector3 | null = null;
      let previewLine: THREE.Line | null = null;
      let linePoints: THREE.Vector3[] = [];
      let linePreview: THREE.Line | null = null;
      let liveLabelText = '';
      const target = new THREE.Vector3(0, 0.8, 0);
      const parts: CadPart[] = [];
      const lines: CadLineObject[] = [];
      const layers: CadLayer[] = [{ id: 1, name: 'Layer 1', visible: true }];
      const scenes: CadScene[] = [];
      const measurements: Measurement[] = [];

      const error = errorSlot();
      const stage = h('div', { class: 'dt-scene-stage', dataset: { tool: 'rect' } });
      const overlay = h('div', { class: 'dt-cad-overlay' });
      const liveLabel = h('span', { class: 'dt-cad-live' });
      stage.append(overlay);
      overlay.append(liveLabel);
      const list = h('div', { class: 'dt-ie-layers' });
      const inspector = h('div', { class: 'dt-stack' });
      const scenesHost = h('div', { class: 'dt-stack' });
      const layersHost = h('div', { class: 'dt-stack' });
      const stats = h('span', { class: 'dt-ie-stats dt-hint' });

      const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      stage.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#0f172a');
      const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 500);

      scene.add(new THREE.AmbientLight(0xffffff, 0.6));
      const sun = new THREE.DirectionalLight(0xffffff, 2.3);
      sun.position.set(6, 10, 5);
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.camera.left = -16;
      sun.shadow.camera.right = 16;
      sun.shadow.camera.top = 16;
      sun.shadow.camera.bottom = -16;
      scene.add(sun);

      const grid = new THREE.GridHelper(30, 60, 0x64748b, 0x273449);
      scene.add(grid);
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(30, 30),
        new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.95 }),
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.002;
      ground.receiveShadow = true;
      scene.add(ground);

      const selection = new THREE.BoxHelper(new THREE.Object3D(), 0x38bdf8);
      selection.visible = false;
      scene.add(selection);

      const controls = new TransformControls(camera, renderer.domElement);
      controls.setSize(1.8);
      controls.translationSnap = 0.25;
      controls.rotationSnap = Math.PI / 12;
      controls.scaleSnap = 0.1;
      const gizmoHelper = controls.getHelper();
      scene.add(gizmoHelper);

      const faceHighlight = new THREE.Group();
      const faceHighlightMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          color: 0xf59e0b,
          transparent: true,
          opacity: 0.42,
          side: THREE.DoubleSide,
          depthTest: false,
          depthWrite: false,
        }),
      );
      faceHighlightMesh.renderOrder = 8;
      const faceHighlightBorder = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.PlaneGeometry(1, 1)),
        new THREE.LineBasicMaterial({ color: 0xfbbf24, depthTest: false }),
      );
      faceHighlightBorder.renderOrder = 9;
      faceHighlight.add(faceHighlightMesh, faceHighlightBorder);
      faceHighlight.visible = false;
      scene.add(faceHighlight);

      const snapMarker = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0xfb923c, depthTest: false, depthWrite: false }),
      );
      snapMarker.renderOrder = 10;
      snapMarker.visible = false;
      scene.add(snapMarker);

      const selected = (): CadPart | undefined => parts.find((part) => part.id === selectedId);
      const selectPart = (id: number): void => {
        selectedId = id;
        setError(error, null);
        syncUi();
      };
      const syncGizmo = (): void => {
        const part = selected();
        if (tool !== 'select' || !part) {
          controls.detach();
          return;
        }
        controls.setMode(mode === 'move' ? 'translate' : mode);
        if (controls.object !== part.mesh) controls.attach(part.mesh);
      };

      controls.addEventListener('objectChange', () => {
        const part = selected();
        if (part) selection.setFromObject(part.mesh);
      });

      controls.addEventListener('mouseUp', () => {
        const part = selected();
        if (part && mode === 'scale' && part.kind !== 'model') {
          const factor = part.mesh.scale;
          if (factor.x !== 1 || factor.y !== 1 || factor.z !== 1) {
            if (part.kind === 'cylinder') {
              setDims(part, {
                radius: part.radius * ((factor.x + factor.z) / 2),
                height: part.height * factor.y,
              });
            } else {
              setDims(part, {
                width: part.width * factor.x,
                depth: part.depth * factor.z,
                height: part.height * factor.y,
              });
            }
            part.mesh.scale.set(1, 1, 1);
          }
        }
        syncUi();
      });
      const snapValue = (value: number): number => (snap ? Math.round(value / 0.25) * 0.25 : Math.round(value * 1000) / 1000);
      const layerOf = (part: CadPart): CadLayer | undefined => layers.find((layer) => layer.id === part.layerId);

      const applyVisibility = (): void => {
        for (const part of parts) {
          const layer = layerOf(part);
          part.mesh.visible = part.visible && (layer?.visible ?? true);
        }
        for (const line of lines) {
          line.object.visible = layers.find((layer) => layer.id === line.layerId)?.visible ?? true;
        }
      };

      const materialsOf = (part: CadPart): THREE.MeshStandardMaterial[] => {
        const found: THREE.MeshStandardMaterial[] = [];
        part.mesh.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return;
          const material = child.material;
          const list = Array.isArray(material) ? material : [material];
          for (const item of list) if (item instanceof THREE.MeshStandardMaterial) found.push(item);
        });
        return found;
      };

      const applyStyle = (): void => {
        for (const part of parts) {
          for (const material of materialsOf(part)) {
            material.wireframe = styleMode !== 'solid';
            if (styleMode === 'blueprint') {
              material.color.set('#7dd3fc');
              material.map = null;
            } else {
              material.color.set(part.color);
              material.map = part.texture;
            }
            material.needsUpdate = true;
          }
        }
        scene.background = new THREE.Color(styleMode === 'solid' ? '#0f172a' : '#08111f');
        renderer.shadowMap.enabled = shadows;
        ground.visible = styleMode === 'solid';
      };

      const geometryFor = (part: CadPart): THREE.BufferGeometry =>
        part.kind === 'cylinder'
          ? new THREE.CylinderGeometry(Math.max(0.05, part.radius), Math.max(0.05, part.radius), Math.max(0.05, part.height), 48)
          : new THREE.BoxGeometry(Math.max(0.05, part.width), Math.max(0.05, part.height), Math.max(0.05, part.depth));

      const refreshPart = (part: CadPart): void => {
        if (part.kind === 'model') return;
        rebuildGeometry(part);
        (part.mesh as THREE.Mesh).position.y = part.height / 2;
      };

      const rebuildGeometry = (part: CadPart): void => {
        if (part.kind === 'model') return;
        const mesh = part.mesh as THREE.Mesh;
        mesh.geometry.dispose();
        mesh.geometry = geometryFor(part);
      };

      const addPart = (kind: PartKind, position: THREE.Vector3, name?: string): CadPart => {
        const material = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), metalness: 0.2, roughness: 0.55 });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1, 0.1), material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.position.set(snapValue(position.x), 0.5, snapValue(position.z));
        const part: CadPart = {
          id: nextId++,
          kind,
          name: name ?? `${kind === 'cylinder' ? ctx.pick('Cylinder', 'Цилиндр') : ctx.pick('Box', 'Куб')} ${nextId - 1}`,
          mesh,
          width: 0.1,
          depth: 0.1,
          height: 1,
          radius: 0.1,
          layerId: activeLayerId,
          componentId: null,
          color,
          texture: null,
          visible: true,
        };
        mesh.name = part.name;
        scene.add(mesh);
        parts.push(part);
        selectedId = part.id;
        return part;
      };

      const deletePart = (): void => {
        const part = selected();
        if (!part) return;
        scene.remove(part.mesh);
        part.mesh.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            const material = child.material;
            if (Array.isArray(material)) material.forEach((item) => item.dispose());
            else material.dispose();
          }
        });
        parts.splice(parts.indexOf(part), 1);
        selectedId = parts[parts.length - 1]?.id ?? 0;
        syncUi();
      };

      const copyPart = (source: CadPart, offset: THREE.Vector3): CadPart => {
        const mesh = source.mesh.clone(true);
        mesh.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = Array.isArray(child.material)
              ? child.material.map((item) => item.clone())
              : (child.material as THREE.Material).clone();
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        mesh.position.copy(source.mesh.position).add(offset);
        scene.add(mesh);
        const copy: CadPart = {
          ...source,
          id: nextId++,
          name: `${source.name} ${ctx.pick('copy', 'копия')}`,
          mesh,
          componentId: source.componentId,
          layerId: activeLayerId,
        };
        parts.push(copy);
        mesh.name = copy.name;
        selectedId = copy.id;
        return copy;
      };

      const duplicatePart = (): void => {
        const source = selected();
        if (!source) return;
        copyPart(source, new THREE.Vector3(1.5, 0, 0));
        syncUi();
      };

      const makeComponent = (): void => {
        const part = selected();
        if (!part) return;
        if (!part.componentId) part.componentId = nextComponentId++;
        syncUi();
      };

      const insertInstance = (): void => {
        const source = selected();
        if (!source?.componentId) {
          setError(error, ctx.pick('Make the solid a component first.', 'Сначала сделайте тело компонентом.'));
          return;
        }
        copyPart(source, new THREE.Vector3(1.5, 0, 0));
        syncUi();
      };

      const setDims = (
        part: CadPart,
        next: Partial<Pick<CadPart, 'width' | 'depth' | 'height' | 'radius'>>,
      ): void => {
        const targets = part.componentId ? parts.filter((item) => item.componentId === part.componentId) : [part];
        for (const target of targets) {
          const oldHeight = target.height;
          if (next.width !== undefined) target.width = next.width;
          if (next.depth !== undefined) target.depth = next.depth;
          if (next.radius !== undefined) target.radius = next.radius;
          if (next.height !== undefined) target.height = next.height;
          if (target.kind !== 'model' && next.height !== undefined) {
            target.mesh.position.y += (target.height - oldHeight) / 2;
          }
          refreshPart(target);
        }
        renderTree();
      };

      const renderLayers = (): void => {
        layersHost.replaceChildren();
        for (const layer of layers) {
          layersHost.appendChild(
            h(
              'div',
              { class: `dt-row dt-tree-row ${layer.id === activeLayerId ? 'is-active' : ''}` },
              h(
                'button',
                {
                  class: 'dt-tree-eye',
                  type: 'button',
                  title: layer.visible ? ctx.pick('Hide layer', 'Скрыть слой') : ctx.pick('Show layer', 'Показать слой'),
                  onclick: (event: MouseEvent) => {
                    event.stopPropagation();
                    layer.visible = !layer.visible;
                    applyVisibility();
                    renderTree();
                    renderLayers();
                  },
                },
                svgIcon(layer.visible ? ICONS.eye : ICONS.eyeOff, 13),
              ),
              h(
                'button',
                {
                  class: 'dt-ie-layer',
                  type: 'button',
                  onclick: () => {
                    activeLayerId = layer.id;
                    renderLayers();
                  },
                },
                h('span', { class: 'dt-ie-layer-name' }, layer.name),
                h('span', { class: 'dt-ie-layer-kind' }, `${parts.filter((part) => part.layerId === layer.id).length}`),
              ),
              layers.length > 1
                ? iconBtn(
                    ICONS.trash,
                    ctx.pick('Delete layer', 'Удалить слой'),
                    () => {
                      const fallback = layers.find((item) => item.id !== layer.id);
                      if (!fallback) return;
                      for (const part of parts) if (part.layerId === layer.id) part.layerId = fallback.id;
                      for (const line of lines) if (line.layerId === layer.id) line.layerId = fallback.id;
                      layers.splice(layers.indexOf(layer), 1);
                      activeLayerId = fallback.id;
                      applyVisibility();
                      syncUi();
                    },
                    { variant: 'subtle', class: 'dt-tree-eye' },
                  )
                : null,
            ),
          );
        }
        layersHost.appendChild(
          h(
            'div',
            { class: 'dt-row' },
            textInput({ placeholder: ctx.pick('New layer name', 'Имя нового слоя') }),
            btn(
              ctx.pick('Add layer', 'Добавить слой'),
              (event: MouseEvent) => {
                const row = (event.currentTarget as HTMLElement).parentElement;
                const input = row?.querySelector('input');
                const name = input?.value.trim() || `Layer ${layers.length + 1}`;
                const layer: CadLayer = { id: nextLayerId++, name, visible: true };
                layers.push(layer);
                activeLayerId = layer.id;
                if (input) input.value = '';
                syncUi();
              },
              { variant: 'ghost' },
            ),
          ),
        );
      };

      const renderTree = (): void => {
        list.replaceChildren();
        for (const layer of layers) {
          const kids = parts.filter((part) => part.layerId === layer.id);
          list.appendChild(
            h(
              'div',
              { class: 'dt-tree-row dt-tree-layer' },
              h('span', { class: 'dt-ie-layer-name' }, `${layer.name}${layer.visible ? '' : ' · ' + ctx.pick('hidden', 'скрыт')}`),
              h('span', { class: 'dt-ie-layer-kind' }, `${kids.length}`),
            ),
          );
          for (const part of [...kids].reverse()) {
            list.appendChild(
              h(
                'div',
                { class: `dt-tree-row ${part.id === selectedId ? 'is-active' : ''}`, style: { paddingLeft: '14px' } },
                h(
                  'button',
                  {
                    class: 'dt-tree-eye',
                    type: 'button',
                    onclick: (event: MouseEvent) => {
                      event.stopPropagation();
                      part.visible = !part.visible;
                      applyVisibility();
                      renderTree();
                    },
                  },
                  svgIcon(part.visible ? ICONS.eye : ICONS.eyeOff, 13),
                ),
                h(
                  'button',
                  { class: 'dt-ie-layer', type: 'button', onclick: () => selectPart(part.id) },
                  h(
                    'span',
                    { class: 'dt-ie-layer-name' },
                    `${part.name}${part.componentId ? ` · C${part.componentId}` : ''}`,
                  ),
                  h(
                    'span',
                    { class: 'dt-ie-layer-kind' },
                    part.kind === 'box'
                      ? `${part.width.toFixed(2)}×${part.depth.toFixed(2)}×${part.height.toFixed(2)}`
                      : part.kind === 'cylinder'
                        ? `r ${part.radius.toFixed(2)} · h ${part.height.toFixed(2)}`
                        : ctx.pick('model', 'модель'),
                  ),
                ),
              ),
            );
          }
        }
        if (!parts.length) list.appendChild(note(ctx.pick('Sketch a rectangle or circle on the grid.', 'Начертите прямоугольник или круг по сетке.'), 'info'));
        stats.textContent = `${parts.length} ${ctx.pick('solids', 'тел')} · ${measurements.length} ${ctx.pick('measurements', 'замеров')} · ${lines.length} ${ctx.pick('lines', 'линий')}`;
      };

      const dimensionField = (label: string, value: number, apply: (value: number) => void): HTMLElement =>
        field(
          label,
          textInput({
            type: 'number',
            value: Number(value.toFixed(3)),
            min: 0.01,
            step: 0.05,
            oninput: (raw) => {
              const parsed = Number(raw);
              if (!Number.isFinite(parsed) || parsed <= 0) return;
              apply(snapValue(parsed));
            },
          }),
        );

      const rotationField = (label: string, radians: number, apply: (radians: number) => void): HTMLElement =>
        field(
          label,
          textInput({
            type: 'number',
            value: Math.round((radians * 180) / Math.PI),
            step: 5,
            oninput: (raw) => {
              const degrees = Number(raw);
              if (Number.isFinite(degrees)) apply((degrees * Math.PI) / 180);
            },
          }),
        );

      const renderInspector = (): void => {
        inspector.replaceChildren();
        const part = selected();
        if (!part) {
          inspector.appendChild(note(ctx.pick('Select a solid to edit it.', 'Выберите тело для редактирования.'), 'info'));
          return;
        }
        inspector.appendChild(
          h(
            'div',
            { class: 'dt-row dt-ie-inspector-head' },
            badge(part.kind === 'model' ? ctx.pick('Model', 'Модель') : part.kind === 'cylinder' ? ctx.pick('Cylinder', 'Цилиндр') : ctx.pick('Box', 'Куб')),
            h('span', { class: 'dt-ie-layer-title' }, part.name),
            part.componentId ? badge(`C${part.componentId}`, 'warn') : null,
          ),
        );

        const colorInput = h('input', { type: 'color', class: 'dt-color-input', value: part.color });
        colorInput.addEventListener('input', () => {
          part.color = colorInput.value;
          if (styleMode === 'solid') {
            for (const material of materialsOf(part)) material.color.set(part.color);
          }
        });
        inspector.appendChild(field(ctx.pick('Color', 'Цвет'), colorInput));

        if (part.kind !== 'model') {
          if (part.kind === 'box') {
            inspector.appendChild(
              h(
                'div',
                { class: 'dt-inline-form' },
                dimensionField(ctx.pick('Width, m', 'Ширина, м'), part.width, (value) => setDims(part, { width: value })),
                dimensionField(ctx.pick('Depth, m', 'Глубина, м'), part.depth, (value) => setDims(part, { depth: value })),
                dimensionField(ctx.pick('Height, m', 'Высота, м'), part.height, (value) => setDims(part, { height: value })),
              ),
            );
          } else {
            inspector.appendChild(
              h(
                'div',
                { class: 'dt-inline-form' },
                dimensionField(ctx.pick('Radius, m', 'Радиус, м'), part.radius, (value) => setDims(part, { radius: value })),
                dimensionField(ctx.pick('Height, m', 'Высота, м'), part.height, (value) => setDims(part, { height: value })),
              ),
            );
          }
        }
        inspector.appendChild(
          h(
            'div',
            { class: 'dt-inline-form' },
            field('X', textInput({ type: 'number', value: Number(part.mesh.position.x.toFixed(2)), step: 0.05, oninput: (raw) => (part.mesh.position.x = snapValue(Number(raw) || 0)) })),
            field('Y', textInput({ type: 'number', value: Number(part.mesh.position.y.toFixed(2)), step: 0.05, oninput: (raw) => (part.mesh.position.y = Number(raw) || 0) })),
            field('Z', textInput({ type: 'number', value: Number(part.mesh.position.z.toFixed(2)), step: 0.05, oninput: (raw) => (part.mesh.position.z = snapValue(Number(raw) || 0)) })),
          ),
        );
        inspector.appendChild(
          h(
            'div',
            { class: 'dt-inline-form' },
            rotationField(ctx.pick('Rot X', 'Поворот X'), part.mesh.rotation.x, (value) => (part.mesh.rotation.x = value)),
            rotationField(ctx.pick('Rot Y', 'Поворот Y'), part.mesh.rotation.y, (value) => (part.mesh.rotation.y = value)),
            rotationField(ctx.pick('Rot Z', 'Поворот Z'), part.mesh.rotation.z, (value) => (part.mesh.rotation.z = value)),
          ),
        );
        inspector.appendChild(
          toolbar(
            btn(ctx.pick('Texture', 'Текстура'), () => textureInput.click(), { variant: 'ghost' }),
            btn(ctx.pick('Clear texture', 'Убрать текстуру'), () => {
              part.texture = null;
              if (styleMode !== 'blueprint') for (const material of materialsOf(part)) { material.map = null; material.needsUpdate = true; }
            }, { variant: 'ghost' }),
          ),
        );
        inspector.appendChild(
          toolbar(
            btn(ctx.pick('Make component', 'Сделать компонентом'), makeComponent, { variant: 'ghost' }),
            btn(ctx.pick('Insert instance', 'Вставить экземпляр'), insertInstance, { variant: 'ghost' }),
          ),
        );
        inspector.appendChild(
          toolbar(
            iconBtn(ICONS.duplicate, ctx.pick('Duplicate', 'Дублировать'), duplicatePart, { variant: 'subtle' }),
            iconBtn(ICONS.trash, ctx.pick('Delete', 'Удалить'), deletePart, { variant: 'danger' }),
          ),
        );
      };

      const renderScenes = (): void => {
        scenesHost.replaceChildren();
        if (!scenes.length) {
          scenesHost.appendChild(note(ctx.pick('Save the current camera and layer visibility as a scene.', 'Сохраните текущую камеру и видимость слоёв как сцену.'), 'info'));
          return;
        }
        for (const saved of scenes) {
          scenesHost.appendChild(
            h(
              'div',
              { class: 'dt-row' },
              h('span', { class: 'dt-ie-layer-name' }, saved.name),
              btn(
                ctx.pick('Apply', 'Применить'),
                () => {
                  theta = saved.theta;
                  phi = saved.phi;
                  radius = saved.radius;
                  target.set(...saved.target);
                  for (const layer of layers) layer.visible = saved.layers[layer.id] ?? true;
                  applyVisibility();
                  applyCamera();
                  renderLayers();
                  renderTree();
                },
                { variant: 'ghost' },
              ),
              iconBtn(ICONS.trash, ctx.pick('Delete scene', 'Удалить сцену'), () => {
                scenes.splice(scenes.indexOf(saved), 1);
                renderScenes();
              }, { variant: 'danger' }),
            ),
          );
        }
      };

      const syncUi = (): void => {
        renderLayers();
        renderTree();
        renderInspector();
        renderScenes();
        applyVisibility();
        applyStyle();
        const part = selected();
        if (part) {
          selection.setFromObject(part.mesh);
          selection.visible = part.mesh.visible;
        } else selection.visible = false;
        syncGizmo();
      };

      const applyCamera = (): void => {
        const sin = Math.sin(phi);
        camera.position.set(
          target.x + radius * sin * Math.sin(theta),
          target.y + radius * Math.cos(phi),
          target.z + radius * sin * Math.cos(theta),
        );
        camera.lookAt(target);
      };

      const pointerNdc = (event: PointerEvent | MouseEvent): THREE.Vector2 => {
        const rect = renderer.domElement.getBoundingClientRect();
        return new THREE.Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -((event.clientY - rect.top) / rect.height) * 2 + 1,
        );
      };

      const groundPoint = (event: PointerEvent | MouseEvent): THREE.Vector3 | null => {
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(pointerNdc(event), camera);
        const point = new THREE.Vector3();
        return raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), point) ? point : null;
      };

      const partForObject = (node: THREE.Object3D | null): CadPart | undefined => {
        while (node) {
          const found = parts.find((part) => part.mesh === node);
          if (found) return found;
          node = node.parent;
        }
        return undefined;
      };

      const pickHit = (
        event: PointerEvent | MouseEvent,
      ): { part: CadPart; intersection: THREE.Intersection } | undefined => {
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(pointerNdc(event), camera);
        const hits = raycaster.intersectObjects(
          parts.filter((part) => part.mesh.visible).map((part) => part.mesh),
          true,
        );
        for (const intersection of hits) {
          const part = partForObject(intersection.object);
          if (part) return { part, intersection };
        }
        return undefined;
      };

      const pickPart = (event: PointerEvent | MouseEvent): CadPart | undefined => pickHit(event)?.part;

      const projectToScreen = (point: THREE.Vector3): THREE.Vector2 => {
        const ndc = point.clone().project(camera);
        const rect = renderer.domElement.getBoundingClientRect();
        return new THREE.Vector2((ndc.x * 0.5 + 0.5) * rect.width, (-ndc.y * 0.5 + 0.5) * rect.height);
      };

      const eventPixel = (event: PointerEvent | MouseEvent): THREE.Vector2 => {
        const rect = renderer.domElement.getBoundingClientRect();
        return new THREE.Vector2(event.clientX - rect.left, event.clientY - rect.top);
      };

      const nearestVertex = (mesh: THREE.Mesh, event: PointerEvent | MouseEvent): THREE.Vector3 | null => {
        const attribute = mesh.geometry.getAttribute('position');
        if (!attribute) return null;
        const pixel = eventPixel(event);
        const point = new THREE.Vector3();
        let best: THREE.Vector3 | null = null;
        let bestDistance = 14 * 14;
        const step = attribute.count > 30000 ? Math.ceil(attribute.count / 30000) : 1;
        for (let index = 0; index < attribute.count; index += step) {
          point.fromBufferAttribute(attribute as THREE.BufferAttribute, index).applyMatrix4(mesh.matrixWorld);
          const distance = projectToScreen(point).distanceToSquared(pixel);
          if (distance < bestDistance) {
            bestDistance = distance;
            best = point.clone();
          }
        }
        return best;
      };

      const snapPoint = (event: PointerEvent | MouseEvent): SnapResult | null => {
        const hit = pickHit(event);
        if (hit) {
          const mesh = hit.intersection.object;
          if (mesh instanceof THREE.Mesh) {
            const vertex = nearestVertex(mesh, event);
            if (vertex) return { point: vertex, type: 'vertex' };
          }
          return { point: hit.intersection.point.clone(), type: 'face' };
        }
        const ground = groundPoint(event);
        if (!ground) return null;
        return { point: new THREE.Vector3(snapValue(ground.x), 0.01, snapValue(ground.z)), type: 'grid' };
      };

      const showSnapMarker = (snap: SnapResult | null): void => {
        if (!snap) {
          snapMarker.visible = false;
          return;
        }
        snapMarker.position.copy(snap.point);
        const color = snap.type === 'vertex' ? 0xfb923c : snap.type === 'face' ? 0x38bdf8 : 0x94a3b8;
        (snapMarker.material as THREE.MeshBasicMaterial).color.setHex(color);
        snapMarker.visible = true;
      };
      const hideSnapMarker = (): void => {
        snapMarker.visible = false;
      };

      const faceInfoFromHit = (part: CadPart, intersection: THREE.Intersection): FaceInfo | null => {
        if (part.kind === 'model' || !intersection.face) return null;
        const normal = intersection.face.normal.clone().normalize();
        const absX = Math.abs(normal.x);
        const absY = Math.abs(normal.y);
        const absZ = Math.abs(normal.z);
        const axis: FaceAxis = absX >= absY && absX >= absZ ? 'x' : absY >= absZ ? 'y' : 'z';
        const sign = Math.sign(normal[axis]) || 1;
        const localCenter = new THREE.Vector3();
        let sizeU = 1;
        let sizeV = 1;
        if (part.kind === 'cylinder') {
          if (axis === 'y') {
            localCenter.set(0, (sign * part.height) / 2, 0);
            sizeU = part.radius * 2;
            sizeV = part.radius * 2;
          } else {
            localCenter.copy(part.mesh.worldToLocal(intersection.point.clone()));
            sizeU = part.height;
            sizeV = part.radius * 1.4;
          }
        } else if (axis === 'x') {
          localCenter.set((sign * part.width) / 2, 0, 0);
          sizeU = part.depth;
          sizeV = part.height;
        } else if (axis === 'y') {
          localCenter.set(0, (sign * part.height) / 2, 0);
          sizeU = part.width;
          sizeV = part.depth;
        } else {
          localCenter.set(0, 0, (sign * part.depth) / 2);
          sizeU = part.width;
          sizeV = part.height;
        }
        return { part, axis, sign, normal, localCenter, sizeU, sizeV };
      };

      const updateFaceHighlight = (face: FaceInfo | null): void => {
        if (!face) {
          faceHighlight.visible = false;
          return;
        }
        const localQuaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), face.normal);
        faceHighlight.position.copy(face.localCenter).applyMatrix4(face.part.mesh.matrixWorld);
        faceHighlight.quaternion.copy(face.part.mesh.getWorldQuaternion(new THREE.Quaternion()).multiply(localQuaternion));
        faceHighlight.scale.set(Math.max(0.05, face.sizeU), Math.max(0.05, face.sizeV), 1);
        faceHighlight.visible = true;
      };

      const makeLine = (points: THREE.Vector3[], color: number, dashed: boolean): THREE.Line => {
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = dashed
          ? new THREE.LineDashedMaterial({ color, dashSize: 0.16, gapSize: 0.1, depthTest: false })
          : new THREE.LineBasicMaterial({ color, depthTest: false });
        const line = new THREE.Line(geometry, material);
        line.renderOrder = 7;
        if (dashed) line.computeLineDistances();
        return line;
      };

      const updateLinePreview = (point: THREE.Vector3): void => {
        if (!linePoints.length) return;
        if (!linePreview) {
          linePreview = makeLine([linePoints[0], linePoints[0]], 0x38bdf8, true);
          scene.add(linePreview);
        }
        const preview = [...linePoints, point];
        linePreview.geometry.dispose();
        linePreview.geometry = new THREE.BufferGeometry().setFromPoints(preview);
        linePreview.computeLineDistances();
      };

      const finishLine = (commit = true): void => {
        if (commit && linePoints.length >= 2) {
          const points = linePoints.map((point) => point.clone());
          const object = makeLine(points, 0xfbbf24, false);
          scene.add(object);
          lines.push({ id: nextLineId++, points, object, layerId: activeLayerId });
        }
        if (linePreview) {
          scene.remove(linePreview);
          linePreview.geometry.dispose();
          (linePreview.material as THREE.Material).dispose();
          linePreview = null;
        }
        linePoints = [];
        hideSnapMarker();
        renderTree();
      };

      const clearLines = (): void => {
        for (const line of lines) {
          scene.remove(line.object);
          line.object.geometry.dispose();
          (line.object.material as THREE.Material).dispose();
        }
        lines.length = 0;
        finishLine(false);
      };

      const startFaceDrag = (event: PointerEvent): boolean => {
        const hit = pickHit(event);
        if (!hit) return false;
        if (hit.part.kind === 'model') {
          setError(error, ctx.pick('Push/Pull works with boxes and cylinders.', 'Push/Pull работает с кубами и цилиндрами.'));
          return false;
        }
        const face = faceInfoFromHit(hit.part, hit.intersection);
        if (!face) return false;
        selectPart(hit.part.id);
        const quaternion = hit.part.mesh.getWorldQuaternion(new THREE.Quaternion());
        const normalWorld = face.normal.clone().applyQuaternion(quaternion).normalize();
        const centerWorld = face.localCenter.clone().applyMatrix4(hit.part.mesh.matrixWorld);
        const from = projectToScreen(centerWorld);
        const to = projectToScreen(centerWorld.clone().add(normalWorld));
        faceDrag = {
          part: hit.part,
          axis: face.axis,
          normalWorld,
          screenDir: to.sub(from),
          startX: event.clientX,
          startY: event.clientY,
          startPosition: hit.part.mesh.position.clone(),
          startDims: {
            width: hit.part.width,
            depth: hit.part.depth,
            height: hit.part.height,
            radius: hit.part.radius,
          },
        };
        updateFaceHighlight(null);
        hideSnapMarker();
        setError(error, null);
        return true;
      };

      const applyFaceDelta = (state: FaceDrag, delta: number): number => {
        const part = state.part;
        if (part.kind === 'box') {
          const start = state.axis === 'x' ? state.startDims.width : state.axis === 'y' ? state.startDims.height : state.startDims.depth;
          const next = Math.max(0.05, start + delta);
          const applied = next - start;
          if (state.axis === 'x') part.width = next;
          else if (state.axis === 'y') part.height = next;
          else part.depth = next;
          part.mesh.position.copy(state.startPosition).addScaledVector(state.normalWorld, applied / 2);
          rebuildGeometry(part);
          return next;
        }
        if (state.axis === 'y') {
          const start = state.startDims.height;
          const next = Math.max(0.05, start + delta);
          part.height = next;
          part.mesh.position.copy(state.startPosition).addScaledVector(state.normalWorld, (next - start) / 2);
          rebuildGeometry(part);
          return next;
        }
        const start = state.startDims.radius;
        const next = Math.max(0.05, start + delta / 2);
        part.radius = next;
        part.mesh.position.copy(state.startPosition).addScaledVector(state.normalWorld, next - start);
        rebuildGeometry(part);
        return next;
      };

      const commitFaceDrag = (): void => {
        if (!faceDrag) return;
        const part = faceDrag.part;
        if (part.componentId) {
          for (const target of parts) {
            if (target === part || target.componentId !== part.componentId) continue;
            target.width = part.width;
            target.depth = part.depth;
            target.height = part.height;
            target.radius = part.radius;
            refreshPart(target);
          }
        }
        faceDrag = null;
        hideLive();
        hideSnapMarker();
        syncUi();
      };

      const showLive = (text: string, event: PointerEvent | MouseEvent): void => {
        liveLabelText = text;
        liveLabel.textContent = text;
        const rect = stage.getBoundingClientRect();
        liveLabel.style.left = `${event.clientX - rect.left + 14}px`;
        liveLabel.style.top = `${event.clientY - rect.top - 12}px`;
        liveLabel.classList.add('is-visible');
      };
      const hideLive = (): void => {
        liveLabelText = '';
        liveLabel.classList.remove('is-visible');
      };

      const addMeasurement = (a: THREE.Vector3, b: THREE.Vector3): void => {
        const geometry = new THREE.BufferGeometry().setFromPoints([a, b]);
        const line = new THREE.Line(
          geometry,
          new THREE.LineDashedMaterial({ color: 0xf97316, dashSize: 0.18, gapSize: 0.12, depthTest: false }),
        );
        line.renderOrder = 7;
        line.computeLineDistances();
        scene.add(line);
        const label = h('span', { class: 'dt-cad-measure' });
        overlay.append(label);
        measurements.push({ id: nextMeasureId++, a: a.clone(), b: b.clone(), line, label });
        renderTree();
      };

      const clearMeasurements = (): void => {
        for (const measurement of measurements) {
          scene.remove(measurement.line);
          measurement.line.geometry.dispose();
          (measurement.line.material as THREE.Material).dispose();
          measurement.label.remove();
        }
        measurements.length = 0;
        if (previewLine) {
          scene.remove(previewLine);
          previewLine = null;
        }
        pendingMeasure = null;
        renderTree();
      };

      const canvas = renderer.domElement;
      canvas.style.touchAction = 'none';
      const pointLabel = (point: THREE.Vector3): string =>
        `X ${point.x.toFixed(2)} · Y ${point.y.toFixed(2)} · Z ${point.z.toFixed(2)}`;
      const snapName = (snap: SnapResult): string =>
        snap.type === 'vertex'
          ? ctx.pick('vertex', 'вершина')
          : snap.type === 'face'
            ? ctx.pick('face', 'грань')
            : ctx.pick('grid', 'сетка');
      canvas.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        if (controls.axis !== null || controls.dragging) {
          gizmoPointer = true;
          return;
        }
        if (tool === 'line') {
          const snap = snapPoint(event);
          if (!snap) return;
          linePoints.push(snap.point.clone());
          updateLinePreview(snap.point.clone());
          showSnapMarker(snap);
          showLive(`${snapName(snap)} · ${pointLabel(snap.point)}`, event);
          return;
        }
        if (tool === 'measure') {
          const snap = snapPoint(event);
          if (!snap) return;
          showSnapMarker(snap);
          if (!pendingMeasure) {
            pendingMeasure = snap.point.clone();
            const geometry = new THREE.BufferGeometry().setFromPoints([snap.point, snap.point]);
            previewLine = new THREE.Line(geometry, new THREE.LineDashedMaterial({ color: 0x38bdf8, dashSize: 0.2, gapSize: 0.1, depthTest: false }));
            previewLine.renderOrder = 7;
            scene.add(previewLine);
          } else {
            addMeasurement(pendingMeasure, snap.point);
            pendingMeasure = null;
            if (previewLine) {
              scene.remove(previewLine);
              previewLine.geometry.dispose();
              (previewLine.material as THREE.Material).dispose();
              previewLine = null;
            }
            hideSnapMarker();
            hideLive();
          }
          return;
        }
        if (tool === 'pushpull') {
          if (startFaceDrag(event)) {
            moved = false;
            canvas.setPointerCapture(event.pointerId);
            return;
          }
          orbiting = true;
          moved = false;
          lastPointer = { x: event.clientX, y: event.clientY };
          canvas.setPointerCapture(event.pointerId);
          return;
        }
        if (tool === 'rect' || tool === 'circle') {
          const point = groundPoint(event);
          if (!point) return;
          const part = addPart(tool === 'rect' ? 'box' : 'cylinder', point);
          refreshPart(part);
          drag = {
            mode: 'create',
            tool,
            startGround: point.clone(),
            startX: event.clientX,
            startY: event.clientY,
            part,
            startHeight: part.height,
            startPosition: part.mesh.position.clone(),
            startRotation: 0,
            startScale: 1,
            startDims: { width: 0.1, depth: 0.1, height: 1, radius: 0.1 },
          };
          moved = false;
          canvas.setPointerCapture(event.pointerId);
          syncUi();
          return;
        }
        const hit = pickPart(event);
        if (hit) {
          selectPart(hit.id);
          return;
        }
        orbiting = true;
        moved = false;
        lastPointer = { x: event.clientX, y: event.clientY };
        canvas.setPointerCapture(event.pointerId);
      });

      canvas.addEventListener('pointermove', (event) => {
        if (faceDrag) {
          const dx = event.clientX - faceDrag.startX;
          const dy = event.clientY - faceDrag.startY;
          if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
          const denominator = faceDrag.screenDir.lengthSq();
          const raw = denominator > 1e-4
            ? new THREE.Vector2(dx, dy).dot(faceDrag.screenDir) / denominator
            : 0;
          const delta = snap ? Math.round(raw / 0.25) * 0.25 : raw;
          const value = applyFaceDelta(faceDrag, delta);
          selection.setFromObject(faceDrag.part.mesh);
          showLive(`${faceDrag.axis.toUpperCase()} ${value.toFixed(2)} m`, event);
          return;
        }
        if (tool === 'measure' && pendingMeasure && previewLine) {
          const snap = snapPoint(event);
          if (snap) {
            previewLine.geometry.dispose();
            previewLine.geometry = new THREE.BufferGeometry().setFromPoints([pendingMeasure, snap.point]);
            previewLine.computeLineDistances();
            showSnapMarker(snap);
            showLive(`${pendingMeasure.distanceTo(snap.point).toFixed(2)} m · ${snapName(snap)}`, event);
          }
          return;
        }
        if (drag) {
          const dx = event.clientX - drag.startX;
          const dy = event.clientY - drag.startY;
          if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
          if (drag.mode === 'create' && drag.part && (drag.tool === 'rect' || drag.tool === 'circle')) {
            const point = groundPoint(event);
            if (!point) return;
            const part = drag.part;
            if (drag.tool === 'rect') {
              const minX = Math.min(drag.startGround.x, point.x);
              const maxX = Math.max(drag.startGround.x, point.x);
              const minZ = Math.min(drag.startGround.z, point.z);
              const maxZ = Math.max(drag.startGround.z, point.z);
              part.width = Math.max(0.05, snapValue(maxX - minX));
              part.depth = Math.max(0.05, snapValue(maxZ - minZ));
              part.mesh.position.x = snapValue((minX + maxX) / 2);
              part.mesh.position.z = snapValue((minZ + maxZ) / 2);
              showLive(`${part.width.toFixed(2)} × ${part.depth.toFixed(2)} m`, event);
            } else {
              part.radius = Math.max(0.05, snapValue(Math.hypot(point.x - drag.startGround.x, point.z - drag.startGround.z)));
              part.mesh.position.x = snapValue(drag.startGround.x);
              part.mesh.position.z = snapValue(drag.startGround.z);
              showLive(`r ${part.radius.toFixed(2)} m`, event);
            }
            refreshPart(part);
            renderTree();
            return;
          }
          return;
        }
        if (tool === 'line' && linePoints.length) {
          const snap = snapPoint(event);
          if (!snap) return;
          updateLinePreview(snap.point);
          showSnapMarker(snap);
          showLive(`${snapName(snap)} · ${pointLabel(snap.point)}`, event);
          return;
        }
        if (tool === 'pushpull' && !orbiting) {
          const hit = pickHit(event);
          const face = hit ? faceInfoFromHit(hit.part, hit.intersection) : null;
          updateFaceHighlight(face);
          if (face && hit) {
            showSnapMarker({ point: hit.intersection.point.clone(), type: 'face' });
            showLive(`${ctx.pick('Face', 'Грань')} ${face.sign > 0 ? '+' : '-'}${face.axis.toUpperCase()} · ${hit.part.name}`, event);
          } else {
            hideSnapMarker();
            hideLive();
          }
          return;
        }
        if (!orbiting) return;
        const dx = event.clientX - lastPointer.x;
        const dy = event.clientY - lastPointer.y;
        moved = true;
        lastPointer = { x: event.clientX, y: event.clientY };
        theta -= dx / 160;
        phi = clamp(phi - dy / 160, 0.12, Math.PI - 0.12);
        applyCamera();
      });

      const finishPendingLine = (): void => {
        if (tool !== 'line') return;
        if (linePoints.length >= 2 && linePoints[linePoints.length - 1].distanceTo(linePoints[linePoints.length - 2]) < 0.02) {
          linePoints.pop();
        }
        finishLine();
        hideLive();
      };
      canvas.addEventListener('dblclick', finishPendingLine);
      canvas.addEventListener('contextmenu', (event) => {
        if (tool !== 'line') return;
        event.preventDefault();
        finishPendingLine();
      });
      canvas.addEventListener('pointerleave', () => {
        if (faceDrag) return;
        updateFaceHighlight(null);
        hideSnapMarker();
        hideLive();
      });

      canvas.addEventListener('pointerup', (event) => {
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        if (gizmoPointer) {
          gizmoPointer = false;
          return;
        }
        if (faceDrag) {
          commitFaceDrag();
          return;
        }
        if (drag) {
          drag = null;
          hideLive();
          syncUi();
          return;
        }
        if (tool === 'measure' || tool === 'line') return;
        orbiting = false;
        if (moved) return;
        const hit = pickPart(event);
        if (hit) selectPart(hit.id);
      });

      canvas.addEventListener(
        'wheel',
        (event) => {
          event.preventDefault();
          radius = clamp(radius * (1 + Math.sign(event.deltaY) * 0.08), 3, 80);
          applyCamera();
        },
        { passive: false },
      );

      // ---------- import / export ----------
      const importModel = async (file: File): Promise<void> => {
        setError(error, null);
        const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
        try {
          let object: THREE.Object3D | null = null;
          if (extension === 'obj') object = new OBJLoader().parse(await file.text());
          else if (extension === 'stl') {
            const geometry = new STLLoader().parse(await file.arrayBuffer());
            object = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.3, roughness: 0.5 }));
          } else if (extension === 'glb' || extension === 'gltf') object = (await new GLTFLoader().parseAsync(await file.arrayBuffer(), '')).scene;
          else if (extension === 'fbx') object = new FBXLoader().parse(await file.arrayBuffer(), '');
          else if (extension === 'dae') {
            const collada = new ColladaLoader().parse(await file.text(), '');
            object = collada?.scene ?? null;
          }
          else if (extension === '3ds') object = new TDSLoader().parse(await file.arrayBuffer(), '');
          if (!object) {
            setError(error, ctx.pick('Supported: OBJ, STL, GLB, GLTF, FBX, DAE, 3DS.', 'Поддерживаются: OBJ, STL, GLB, GLTF, FBX, DAE, 3DS.'));
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
          object.scale.multiplyScalar(3.2 / maxSide);
          const fitted = new THREE.Box3().setFromObject(object);
          const center = fitted.getCenter(new THREE.Vector3());
          object.position.x -= center.x;
          object.position.z -= center.z;
          object.position.y -= fitted.min.y;
          scene.add(object);
          const part: CadPart = {
            id: nextId++,
            kind: 'model',
            name: file.name,
            mesh: object,
            width: 0,
            depth: 0,
            height: 0,
            radius: 0,
            layerId: activeLayerId,
            componentId: null,
            color: '#94a3b8',
            texture: null,
            visible: true,
            modelSource: extension,
          };
          parts.push(part);
          selectedId = part.id;
          applyVisibility();
          syncUi();
        } catch {
          setError(error, ctx.pick('Cannot read this 3D model.', 'Не удалось прочитать 3D-модель.'));
        }
      };

      const exportGroup = (): THREE.Group => {
        const group = new THREE.Group();
        for (const part of parts) {
          if (!part.mesh.visible) continue;
          const clone = part.mesh.clone(true);
          clone.position.copy(part.mesh.position);
          clone.rotation.copy(part.mesh.rotation);
          clone.scale.copy(part.mesh.scale);
          group.add(clone);
        }
        return group;
      };

      const exportPng = async (): Promise<void> => {
        const previousAspect = camera.aspect;
        const previousWidth = renderer.domElement.width;
        const previousHeight = renderer.domElement.height;
        const previousHighlight = faceHighlight.visible;
        const previousMarker = snapMarker.visible;
        const previousPreview = linePreview?.visible ?? false;
        selection.visible = false;
        gizmoHelper.visible = false;
        faceHighlight.visible = false;
        snapMarker.visible = false;
        if (linePreview) linePreview.visible = false;
        grid.visible = false;
        renderer.setSize(1920, 1080, false);
        camera.aspect = 1920 / 1080;
        camera.updateProjectionMatrix();
        renderer.render(scene, camera);
        const blob = await new Promise<Blob | null>((resolve) => renderer.domElement.toBlob((value) => resolve(value), 'image/png'));
        grid.visible = true;
        selection.visible = Boolean(selected());
        gizmoHelper.visible = Boolean(controls.object);
        faceHighlight.visible = previousHighlight;
        snapMarker.visible = previousMarker;
        if (linePreview) linePreview.visible = previousPreview;
        camera.aspect = previousAspect;
        camera.updateProjectionMatrix();
        renderer.setSize(previousWidth, previousHeight, false);
        resize();
        if (blob) downloadBlob('cad-scene.png', blob);
      };

      const exportObj = (): void => downloadBlob('cad-model.obj', new Blob([new OBJExporter().parse(exportGroup())], { type: 'text/plain' }));

      const exportStl = (): void => downloadBlob('cad-model.stl', new Blob([new STLExporter().parse(exportGroup(), { binary: false }) as string], { type: 'model/stl' }));

      const exportGlb = async (): Promise<void> => {
        try {
          const result = await new GLTFExporter().parseAsync(exportGroup(), { binary: true });
          downloadBlob('cad-model.glb', new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' }));
        } catch {
          setError(error, ctx.pick('GLB export failed.', 'Не удалось экспортировать GLB.'));
        }
      };

      const textureInput = h('input', { type: 'file', accept: 'image/*', class: 'dt-hidden' });
      const modelInput = h('input', { type: 'file', accept: '.obj,.stl,.glb,.gltf,.fbx,.dae,.3ds', class: 'dt-hidden' });

      textureInput.addEventListener('change', () => {
        const file = textureInput.files?.[0];
        const part = selected();
        if (!file || !part) return;
        const url = URL.createObjectURL(file);
        new THREE.TextureLoader().load(url, (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          part.texture = texture;
          if (styleMode !== 'blueprint') {
            for (const material of materialsOf(part)) {
              material.map = texture;
              material.needsUpdate = true;
            }
          }
          URL.revokeObjectURL(url);
        });
        textureInput.value = '';
      });
      modelInput.addEventListener('change', () => {
        const file = modelInput.files?.[0];
        if (file) void importModel(file);
        modelInput.value = '';
      });

      const resize = (): void => {
        const width = Math.max(1, stage.clientWidth);
        const height = Math.max(1, stage.clientHeight);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      const observer = new ResizeObserver(() => {
        if (!root.isConnected) {
          observer.disconnect();
          return;
        }
        resize();
      });
      observer.observe(stage);

      const toolSegment = segmented(
        [
          { value: 'select', label: ctx.pick('Select', 'Выбор') },
          { value: 'rect', label: ctx.pick('Rect', 'Прям.') },
          { value: 'circle', label: ctx.pick('Circle', 'Круг') },
          { value: 'line', label: ctx.pick('Line', 'Линия') },
          { value: 'pushpull', label: ctx.pick('Push/Pull', 'Тяни/толкай') },
          { value: 'measure', label: ctx.pick('Measure', 'Рулетка') },
        ],
        'rect',
        (value) => {
          tool = value as CadTool;
          stage.dataset.tool = value;
          gizmoPointer = false;
          if (value !== 'measure') clearPreview();
          if (value !== 'line') finishLine();
          updateFaceHighlight(null);
          hideSnapMarker();
          hideLive();
          syncGizmo();
        },
      );

      const clearPreview = (): void => {
        pendingMeasure = null;
        if (previewLine) {
          scene.remove(previewLine);
          previewLine = null;
        }
        hideSnapMarker();
        hideLive();
      };

      const modeSegment = segmented(
        [
          { value: 'move', label: ctx.pick('Move', 'Двигать') },
          { value: 'rotate', label: ctx.pick('Rotate', 'Вращать') },
          { value: 'scale', label: ctx.pick('Scale', 'Масштаб') },
        ],
        'move',
        (value) => {
          mode = value as CadMode;
          gizmoPointer = false;
          syncGizmo();
        },
      );

      const viewButtons = h(
        'div',
        { class: 'dt-toolbar' },
        btn(ctx.pick('Iso', 'Изо'), () => {
          theta = Math.PI / 4;
          phi = Math.PI / 3.4;
          applyCamera();
        }, { variant: 'ghost' }),
        btn(ctx.pick('Top', 'Сверху'), () => {
          theta = 0;
          phi = 0.14;
          applyCamera();
        }, { variant: 'ghost' }),
        btn(ctx.pick('Front', 'Спереди'), () => {
          theta = 0;
          phi = Math.PI / 2 - 0.05;
          applyCamera();
        }, { variant: 'ghost' }),
        checkbox(ctx.pick('Snap 0.25', 'Привязка 0.25'), snap, (value) => {
          snap = value;
          controls.translationSnap = value ? 0.25 : null;
          controls.rotationSnap = value ? Math.PI / 12 : null;
          controls.scaleSnap = value ? 0.1 : null;
        }),
      );

      const colorInput = h('input', { type: 'color', class: 'dt-color-input', value: color });
      colorInput.addEventListener('input', () => {
        color = colorInput.value;
      });

      const styleSelect = select(
        [
          { value: 'solid', label: ctx.pick('Solid', 'Сплошной') },
          { value: 'wireframe', label: ctx.pick('Wireframe', 'Каркас') },
          { value: 'blueprint', label: ctx.pick('Blueprint', 'Чертёж') },
        ],
        styleMode,
        (value) => {
          styleMode = value as StyleMode;
          applyStyle();
        },
      );

      const displayPane = pane(
        ctx.pick('Display', 'Отображение'),
        h(
          'div',
          { class: 'dt-stack' },
          field(ctx.pick('Style', 'Стиль'), styleSelect),
          checkbox(ctx.pick('Shadows', 'Тени'), shadows, (value) => {
            shadows = value;
            applyStyle();
          }),
          btn(ctx.pick('Clear measurements', 'Очистить замеры'), clearMeasurements, { variant: 'ghost' }),
          btn(ctx.pick('Clear lines', 'Очистить линии'), clearLines, { variant: 'ghost' }),
          h('div', { class: 'dt-hint' }, ctx.pick('Units: metres (m)', 'Единицы: метры (м)')),
        ),
      );

      const scenesPane = pane(
        ctx.pick('Scenes', 'Сцены'),
        h(
          'div',
          { class: 'dt-stack' },
          scenesHost,
          btn(
            ctx.pick('Save current view', 'Сохранить текущий вид'),
            () => {
              const visibility: Record<number, boolean> = {};
              for (const layer of layers) visibility[layer.id] = layer.visible;
              scenes.push({
                id: nextSceneId++,
                name: `Scene ${scenes.length + 1}`,
                theta,
                phi,
                radius,
                target: [target.x, target.y, target.z],
                layers: visibility,
              });
              renderScenes();
            },
            { variant: 'primary' },
          ),
        ),
        [],
        '',
        { collapsible: false },
      );

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          error,
          split(
            h(
              'div',
              { class: 'dt-col' },
              h('div', { class: 'dt-toolbar' }, toolSegment, h('span', { class: 'dt-grow' }), stats),
              h('div', { class: 'dt-toolbar' }, modeSegment, field(ctx.pick('Color', 'Цвет'), colorInput)),
              viewButtons,
              stage,
              h('div', { class: 'dt-hint' }, ctx.pick(
                'Sketch on the grid; Push/Pull drags the highlighted face (sides included); Line and Measure snap to vertices, faces and grid. Double-click or right-click to finish a line. In Select mode the gizmo moves, rotates and scales the selected solid.',
                'Чертите по сетке; Push/Pull тянет подсвеченную грань (включая боковые); Линия и Рулетка привязываются к вершинам, граням и сетке. Двойной или правый клик завершает линию. В режиме «Выбор» гизмо двигает, вращает и масштабирует тело.',
              )),
            ),
            h(
              'div',
              { class: 'dt-col' },
              pane(ctx.pick('Layers', 'Слои'), layersHost, [
                btn(ctx.pick('Import model', 'Импорт модели'), () => modelInput.click(), { variant: 'ghost' }),
              ]),
              pane(ctx.pick('Objects', 'Объекты'), list),
              pane(ctx.pick('Properties', 'Свойства'), inspector),
              scenesPane,
              displayPane,
              pane(
                ctx.pick('Export', 'Экспорт'),
                h(
                  'div',
                  { class: 'dt-stack' },
                  toolbar(
                    btn(ctx.pick('Render PNG', 'Рендер PNG'), () => void exportPng(), { variant: 'primary' }),
                    btn(ctx.pick('OBJ', 'OBJ'), exportObj, { variant: 'ghost' }),
                    btn(ctx.pick('STL', 'STL'), exportStl, { variant: 'ghost' }),
                    btn(ctx.pick('GLB', 'GLB'), () => void exportGlb(), { variant: 'ghost' }),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
      root.append(textureInput, modelInput);

      // ---------- boot ----------
      const initial = addPart('box', new THREE.Vector3(0, 0, 0), ctx.pick('Floor slab', 'Плита'));
      initial.width = 4;
      initial.depth = 3;
      initial.height = 0.3;
      initial.mesh.position.y = 0.15;
      refreshPart(initial);
      syncUi();
      resize();
      applyCamera();

      const loop = (): void => {
        if (!root.isConnected) return;
        selection.update();
        for (const measurement of measurements) {
          const midpoint = new THREE.Vector3().addVectors(measurement.a, measurement.b).multiplyScalar(0.5);
          const projected = midpoint.clone().project(camera);
          measurement.label.style.left = `${((projected.x * 0.5 + 0.5) * 100).toFixed(2)}%`;
          measurement.label.style.top = `${((-projected.y * 0.5 + 0.5) * 100).toFixed(2)}%`;
          measurement.label.textContent = `${measurement.a.distanceTo(measurement.b).toFixed(2)} m`;
        }
        renderer.render(scene, camera);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    },
  });
}

export const cadEditorTools = [cadEditorTool()];
