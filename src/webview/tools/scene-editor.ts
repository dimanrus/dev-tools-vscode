/** 3D scene editor: primitives and imported models, visual transforms, lights and PNG render. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import type { TransformControlsMode } from 'three/examples/jsm/controls/TransformControls.js';
import {
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
  resizableSplit,
  segmented,
  select,
  setError,
  textInput,
  toolbar,
} from '../components.ts';
import { clamp, h } from '../dom.ts';
import { svgIcon } from '../dom.ts';
import { incomingToFile } from '../lib/incoming.ts';
import { defineTool } from '../tool-types.ts';

type ShapeKind = 'box' | 'sphere' | 'cylinder' | 'cone' | 'torus' | 'plane';
type ObjectKind = ShapeKind | 'model';
type TransformMode = 'select' | 'move' | 'rotate' | 'scale';

interface SceneObject {
  id: number;
  name: string;
  kind: ObjectKind;
  object: THREE.Object3D;
}

const DEFAULT_COLORS = ['#60a5fa', '#f472b6', '#34d399', '#fbbf24', '#a78bfa', '#f87171', '#22d3ee'];

const SHAPE_ICONS: Record<ShapeKind, string> = {
  box: '<path d="M12 3l8 4.4v9.2L12 21l-8-4.4V7.4z"/><path d="M12 12l8-4.6"/><path d="M12 12L4 7.4"/><path d="M12 12v9"/>',
  sphere: '<circle cx="12" cy="12" r="8"/><ellipse cx="12" cy="12" rx="8" ry="3"/>',
  cylinder: '<ellipse cx="12" cy="6.5" rx="7" ry="2.8"/><path d="M5 6.5v11a7 2.8 0 0 0 14 0v-11"/>',
  cone: '<path d="M12 3l7 14.5H5z"/><ellipse cx="12" cy="17.5" rx="7" ry="2.6"/>',
  torus: '<ellipse cx="12" cy="12" rx="8.5" ry="5"/><ellipse cx="12" cy="12" rx="3.4" ry="1.9"/>',
  plane: '<path d="M3 15l7-7h11l-7 7z"/><path d="M10 8v7"/>',
};

const MODE_ICONS: Record<TransformMode, string> = {
  select: '<path d="M6 3l5 17l2.6-6.6L20 10.8z"/>',
  move: '<path d="M12 3v18"/><path d="M3 12h18"/><path d="M12 3l-2.6 2.6"/><path d="M12 3l2.6 2.6"/><path d="M12 21l-2.6 -2.6"/><path d="M12 21l2.6 -2.6"/><path d="M3 12l2.6 -2.6"/><path d="M3 12l2.6 2.6"/><path d="M21 12l-2.6 -2.6"/><path d="M21 12l-2.6 2.6"/>',
  rotate: '<path d="M4.5 12a7.5 7.5 0 1 1 2.7 5.8"/><path d="M4 20v-5.5h5.5"/>',
  scale: '<rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.2"/><path d="M14 20.5h6.5V14"/><path d="M20.5 20.5L13.5 13.5"/>',
};

const VIEW_FACES: Array<{
  view: string;
  className: string;
  label: [string, string];
  title: [string, string];
}> = [
  { view: 'front', className: 'is-front', label: ['Front', 'Перед'], title: ['Front view', 'Вид спереди'] },
  { view: 'back', className: 'is-back', label: ['Back', 'Зад'], title: ['Back view', 'Вид сзади'] },
  { view: 'right', className: 'is-right', label: ['Right', 'Право'], title: ['Right view', 'Вид справа'] },
  { view: 'left', className: 'is-left', label: ['Left', 'Лево'], title: ['Left view', 'Вид слева'] },
  { view: 'top', className: 'is-top', label: ['Top', 'Верх'], title: ['Top view', 'Вид сверху'] },
  { view: 'bottom', className: 'is-bottom', label: ['Bottom', 'Низ'], title: ['Bottom view', 'Вид снизу'] },
];

function sceneEditorTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'media-scene-editor',
    group: 'media',
    icon: '<path d="M3 7l9 -4l9 4v10l-9 4l-9 -4z"/><path d="M3 7l9 4l9 -4"/><path d="M12 11l0 10"/>',
    name: { en: '3D Scene', ru: '3D-сцена' },
    desc: {
      en: 'Build a 3D scene from primitives or imported models, move/rotate/scale them visually and render a PNG.',
      ru: 'Соберите 3D-сцену из примитивов или импортированных моделей, двигайте/вращайте/масштабируйте их и рендерите в PNG.',
    },
    keywords: '3d scene three.js render model obj stl gltf import box sphere material light camera png transform gizmo',
    mount(root, ctx) {
      let nextId = 1;
      let selectedId = 0;
      let colorIndex = 0;
      let ambientIntensity = 0.55;
      let keyIntensity = 2.4;
      let background = '#0f172a';
      let exposure = 1.05;
      let groundVisible = true;
      let hideHelpers = true;
      let renderWidth = 1920;
      let renderHeight = 1080;
      let transparent = false;
      let transformMode: TransformMode = 'move';
      let orbiting = false;
      let middleOrbit = false;
      let moved = false;
      let gizmoPointer = false;
      let lastPointer = { x: 0, y: 0 };
      let theta = Math.PI / 5;
      let phi = Math.PI / 3.2;
      let radius = 8;
      const target = new THREE.Vector3(0, 0.8, 0);

      const error = errorSlot();
      const stage = h('div', { class: 'dt-scene-stage', dataset: { mode: 'move' } });
      const objectList = h('div', { class: 'dt-ie-layers' });
      const inspector = h('div', { class: 'dt-stack' });
      const stats = h('span', { class: 'dt-ie-stats dt-hint' });

      const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = exposure;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      stage.appendChild(renderer.domElement);

      const hud = h('div', { class: 'dt-scene-hud' });
      stage.append(hud);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(background);

      const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 500);

      const ambient = new THREE.AmbientLight(0xffffff, ambientIntensity);
      scene.add(ambient);

      const key = new THREE.DirectionalLight(0xffffff, keyIntensity);
      key.position.set(5, 9, 6);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.near = 1;
      key.shadow.camera.far = 40;
      key.shadow.camera.left = -10;
      key.shadow.camera.right = 10;
      key.shadow.camera.top = 10;
      key.shadow.camera.bottom = -10;
      scene.add(key);

      const rim = new THREE.DirectionalLight(0xbfdbfe, 0.8);
      rim.position.set(-6, 4, -7);
      scene.add(rim);

      const grid = new THREE.GridHelper(24, 24, 0x64748b, 0x334155);
      scene.add(grid);

      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(24, 24),
        new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.9, metalness: 0 }),
      );
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);

      const objects: SceneObject[] = [];
      const expandedNodes = new Set<string>();
      const selectionBox = new THREE.BoxHelper(new THREE.Object3D(), 0x38bdf8);
      selectionBox.visible = false;
      scene.add(selectionBox);

      const controls = new TransformControls(camera, renderer.domElement);
      controls.setSize(1.8);
      controls.translationSnap = 0.25;
      controls.rotationSnap = Math.PI / 12;
      controls.scaleSnap = 0.1;
      const gizmoHelper = controls.getHelper();
      scene.add(gizmoHelper);

      const selected = (): SceneObject | undefined => objects.find((item) => item.id === selectedId);

      const labels: Record<ObjectKind, [string, string]> = {
        box: ['Box', 'Куб'],
        sphere: ['Sphere', 'Сфера'],
        cylinder: ['Cylinder', 'Цилиндр'],
        cone: ['Cone', 'Конус'],
        torus: ['Torus', 'Тор'],
        plane: ['Slab', 'Плита'],
        model: ['Model', 'Модель'],
      };

      const geometryFor = (kind: ShapeKind): THREE.BufferGeometry => {
        if (kind === 'sphere') return new THREE.SphereGeometry(1, 48, 32);
        if (kind === 'cylinder') return new THREE.CylinderGeometry(0.8, 0.8, 1.8, 48);
        if (kind === 'cone') return new THREE.ConeGeometry(0.9, 1.8, 48);
        if (kind === 'torus') return new THREE.TorusGeometry(0.9, 0.32, 32, 96);
        if (kind === 'plane') return new THREE.BoxGeometry(2.4, 0.16, 2.4);
        return new THREE.BoxGeometry(1.4, 1.4, 1.4);
      };

      const firstMaterial = (object: THREE.Object3D): THREE.MeshStandardMaterial | null => {
        let found: THREE.MeshStandardMaterial | null = null;
        object.traverse((child) => {
          if (found || !(child instanceof THREE.Mesh)) return;
          const material = child.material;
          const list = Array.isArray(material) ? material : [material];
          const standard = list.find((item) => item instanceof THREE.MeshStandardMaterial);
          if (standard instanceof THREE.MeshStandardMaterial) found = standard;
        });
        return found;
      };

      const forEachMaterial = (object: THREE.Object3D, apply: (material: THREE.MeshStandardMaterial) => void): void => {
        object.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return;
          const material = child.material;
          const list = Array.isArray(material) ? material : [material];
          for (const item of list) {
            if (item instanceof THREE.MeshStandardMaterial) apply(item);
          }
        });
      };

      const addObject = (kind: ShapeKind): void => {
        const color = DEFAULT_COLORS[colorIndex++ % DEFAULT_COLORS.length];
        const material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(color),
          metalness: 0.35,
          roughness: 0.3,
        });
        const mesh = new THREE.Mesh(geometryFor(kind), material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const index = objects.length;
        mesh.position.set((index % 3 - 1) * 2.3, kind === 'plane' ? 0.08 : 1.1, -Math.floor(index / 3) * 2.3);
        scene.add(mesh);
        objects.push({ id: nextId++, name: `${ctx.pick(labels[kind][0], labels[kind][1])} ${objects.length + 1}`, kind, object: mesh });
        selectedId = objects[objects.length - 1].id;
        syncUi();
      };

      const duplicateObject = (): void => {
        const source = selected();
        if (!source) return;
        const object = source.object.clone(true);
        object.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = Array.isArray(child.material)
              ? child.material.map((item) => item.clone())
              : (child.material as THREE.Material).clone();
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        object.position.x += 1.6;
        scene.add(object);
        objects.push({ id: nextId++, name: `${source.name} ${ctx.pick('copy', 'копия')}`, kind: source.kind, object });
        selectedId = objects[objects.length - 1].id;
        syncUi();
      };

      const deleteObject = (): void => {
        const source = selected();
        if (!source) return;
        scene.remove(source.object);
        source.object.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            const material = child.material;
            if (Array.isArray(material)) material.forEach((item) => item.dispose());
            else material.dispose();
          }
        });
        const index = objects.indexOf(source);
        objects.splice(index, 1);
        selectedId = objects[Math.max(0, index - 1)]?.id ?? 0;
        syncUi();
      };

      const selectObject = (id: number): void => {
        selectedId = id;
        setError(error, null);
        renderObjectList();
        renderInspector();
        updateHelpers();
      };

      const transformToControls = (mode: TransformMode): TransformControlsMode =>
        mode === 'rotate' ? 'rotate' : mode === 'scale' ? 'scale' : 'translate';

      const updateHud = (): void => {
        const source = selected();
        if (!source || transformMode === 'select') {
          hud.classList.remove('is-visible');
          return;
        }
        const object = source.object;
        const axis = controls.axis ? ` · ${controls.axis}` : '';
        const toDeg = (radians: number): number => Math.round((radians * 180) / Math.PI);
        if (transformMode === 'move') {
          hud.textContent = `${ctx.pick('Move', 'Двигать')}${axis} · X ${object.position.x.toFixed(2)}  Y ${object.position.y.toFixed(2)}  Z ${object.position.z.toFixed(2)}`;
        } else if (transformMode === 'rotate') {
          hud.textContent = `${ctx.pick('Rotate', 'Вращать')}${axis} · X ${toDeg(object.rotation.x)}°  Y ${toDeg(object.rotation.y)}°  Z ${toDeg(object.rotation.z)}°`;
        } else {
          hud.textContent = `${ctx.pick('Scale', 'Масштаб')}${axis} · X ${object.scale.x.toFixed(2)}  Y ${object.scale.y.toFixed(2)}  Z ${object.scale.z.toFixed(2)}`;
        }
        hud.classList.add('is-visible');
      };

      const updateHelpers = (): void => {
        const source = selected();
        if (!source) {
          selectionBox.visible = false;
          controls.detach();
          updateHud();
          return;
        }
        selectionBox.setFromObject(source.object);
        selectionBox.visible = transformMode === 'select';
        if (transformMode === 'select') {
          controls.detach();
        } else {
          controls.setMode(transformToControls(transformMode));
          if (controls.object !== source.object) controls.attach(source.object);
        }
        updateHud();
      };

      controls.addEventListener('axis-changed', updateHud);
      controls.addEventListener('objectChange', () => {
        updateHud();
        const source = selected();
        if (source && selectionBox.visible) selectionBox.setFromObject(source.object);
      });
      controls.addEventListener('mouseUp', () => {
        renderInspector();
        updateHelpers();
      });

      const renderObjectList = (): void => {
        objectList.replaceChildren();
        const renderNode = (node: THREE.Object3D, root: SceneObject, depth: number): void => {
          const children = node.children;
          const expanded = expandedNodes.has(node.uuid);
          const label = node === root.object ? root.name : node.name || node.type;
          const row = h(
            'div',
            {
              class: `dt-tree-row ${node === root.object && root.id === selectedId ? 'is-active' : ''}`,
              style: { paddingLeft: `${depth * 12}px` },
            },
            children.length
              ? h(
                  'button',
                  {
                    class: 'dt-tree-toggle',
                    type: 'button',
                    title: ctx.pick('Expand/collapse', 'Развернуть/свернуть'),
                    onclick: (event: MouseEvent) => {
                      event.stopPropagation();
                      if (expanded) expandedNodes.delete(node.uuid);
                      else expandedNodes.add(node.uuid);
                      renderObjectList();
                    },
                  },
                  svgIcon(expanded ? '<path d="M6 9l6 6l6 -6"/>' : '<path d="M9 6l6 6l-6 6"/>', 12),
                )
              : h('span', { class: 'dt-tree-spacer' }),
            h(
              'button',
              {
                class: 'dt-tree-eye',
                type: 'button',
                title: node.visible ? ctx.pick('Hide', 'Скрыть') : ctx.pick('Show', 'Показать'),
                onclick: (event: MouseEvent) => {
                  event.stopPropagation();
                  node.visible = !node.visible;
                  renderObjectList();
                },
              },
              svgIcon(
                node.visible
                  ? '<path d="M2 12s3.5 -6 10 -6s10 6 10 6s-3.5 6 -10 6s-10 -6 -10 -6z"/><path d="M12 15a3 3 0 1 0 0 -6a3 3 0 0 0 0 6z"/>'
                  : '<path d="M10.6 10.6a3 3 0 0 0 4.2 4.2"/><path d="M4 4l16 16"/><path d="M6.7 6.7c-2.3 1.6 -3.9 3.5 -4.7 5.3c1.7 3.6 5.3 6 10 6c1.4 0 2.7 -.3 3.9 -.7"/><path d="M9.9 5.2c.7 -.1 1.4 -.2 2.1 -.2c4.7 0 8.3 2.4 10 6c-.4 .9 -1 1.8 -1.7 2.6"/>',
                13,
              ),
            ),
            h(
              'button',
              { class: 'dt-ie-layer', type: 'button', onclick: () => selectObject(root.id) },
              h('span', { class: 'dt-ie-layer-name' }, label),
              h('span', { class: 'dt-ie-layer-kind' }, node === root.object ? ctx.pick(labels[root.kind][0], labels[root.kind][1]) : node.type),
            ),
          );
          objectList.appendChild(row);
          if (children.length && expanded) {
            for (const child of Array.from(children)) renderNode(child, root, depth + 1);
          }
        };
        for (let index = objects.length - 1; index >= 0; index--) {
          renderNode(objects[index].object, objects[index], 0);
        }
        if (!objects.length) {
          objectList.appendChild(note(ctx.pick('Add a primitive to start.', 'Добавьте примитив, чтобы начать.'), 'info'));
        }
        stats.textContent = `${objects.length} ${ctx.pick('objects', 'объектов')}`;
      };

      const numberField = (
        label: string,
        value: number,
        onChange: (value: number) => void,
        step = 0.1,
      ): HTMLElement =>
        field(
          label,
          textInput({
            type: 'number',
            value: Number(value.toFixed(2)),
            step,
            oninput: (raw) => {
              const parsed = Number(raw);
              if (Number.isFinite(parsed)) onChange(parsed);
            },
          }),
        );

      const renderInspector = (): void => {
        inspector.replaceChildren();
        const item = selected();
        if (!item) {
          inspector.appendChild(
            note(ctx.pick('Select an object in the scene to edit it.', 'Выберите объект в сцене для редактирования.'), 'info'),
          );
          return;
        }
        const material = firstMaterial(item.object);
        inspector.appendChild(
          h(
            'div',
            { class: 'dt-row dt-ie-inspector-head' },
            badge(ctx.pick(labels[item.kind][0], labels[item.kind][1])),
            h('span', { class: 'dt-ie-layer-title' }, item.name),
          ),
        );

        if (material) {
          const color = h('input', {
            type: 'color',
            class: 'dt-color-input',
            value: `#${material.color.getHexString()}`,
          });
          color.addEventListener('input', () => {
            forEachMaterial(item.object, (targetMaterial) => targetMaterial.color.set(color.value));
          });
          inspector.appendChild(field(ctx.pick('Color', 'Цвет'), color));
          inspector.appendChild(
            knobGrid(
              knobField(ctx.pick('Metalness', 'Металличность'), 0, 100, Math.round(material.metalness * 100), (value) => {
                forEachMaterial(item.object, (targetMaterial) => (targetMaterial.metalness = value / 100));
              }),
              knobField(ctx.pick('Roughness', 'Шероховатость'), 0, 100, Math.round(material.roughness * 100), (value) => {
                forEachMaterial(item.object, (targetMaterial) => (targetMaterial.roughness = value / 100));
              }),
              knobField(ctx.pick('Opacity', 'Прозрачность'), 5, 100, Math.round(material.opacity * 100), (value) => {
                forEachMaterial(item.object, (targetMaterial) => {
                  targetMaterial.opacity = value / 100;
                  targetMaterial.transparent = targetMaterial.opacity < 1;
                });
              }),
            ),
          );
          inspector.appendChild(
            checkbox(ctx.pick('Wireframe', 'Сетка'), material.wireframe, (value) => {
              forEachMaterial(item.object, (targetMaterial) => (targetMaterial.wireframe = value));
            }),
          );
        }

        const materialKnobs = Array.from(inspector.children).filter((child) => child.classList.contains('dt-knob'));
        if (materialKnobs.length) {
          const grid = h('div', { class: 'dt-knob-grid' });
          for (const item of materialKnobs) grid.appendChild(item);
          inspector.appendChild(grid);
        }
        inspector.appendChild(
          h(
            'div',
            { class: 'dt-inline-form' },
            numberField('X', item.object.position.x, (value) => (item.object.position.x = value)),
            numberField('Y', item.object.position.y, (value) => (item.object.position.y = value)),
            numberField('Z', item.object.position.z, (value) => (item.object.position.z = value)),
          ),
        );
        inspector.appendChild(
          h(
            'div',
            { class: 'dt-inline-form' },
            field(
              ctx.pick('Rotate X', 'Поворот X'),
              textInput({
                type: 'number',
                value: Math.round((item.object.rotation.x * 180) / Math.PI),
                oninput: (raw) => (item.object.rotation.x = (Number(raw) * Math.PI) / 180 || 0),
              }),
            ),
            field(
              ctx.pick('Rotate Y', 'Поворот Y'),
              textInput({
                type: 'number',
                value: Math.round((item.object.rotation.y * 180) / Math.PI),
                oninput: (raw) => (item.object.rotation.y = (Number(raw) * Math.PI) / 180 || 0),
              }),
            ),
            field(
              ctx.pick('Rotate Z', 'Поворот Z'),
              textInput({
                type: 'number',
                value: Math.round((item.object.rotation.z * 180) / Math.PI),
                oninput: (raw) => (item.object.rotation.z = (Number(raw) * Math.PI) / 180 || 0),
              }),
            ),
          ),
        );
        inspector.appendChild(
          h(
            'div',
            { class: 'dt-inline-form' },
            numberField('Scale X', item.object.scale.x, (value) => (item.object.scale.x = Math.max(0.05, value))),
            numberField('Scale Y', item.object.scale.y, (value) => (item.object.scale.y = Math.max(0.05, value))),
            numberField('Scale Z', item.object.scale.z, (value) => (item.object.scale.z = Math.max(0.05, value))),
          ),
        );
        inspector.appendChild(
          toolbar(
            iconBtn(
              '<path d="M7 7m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z"/><path d="M5 15v-8a2 2 0 0 1 2 -2h8"/>',
              ctx.pick('Duplicate object', 'Дублировать объект'),
              duplicateObject,
              { variant: 'subtle' },
            ),
            iconBtn(
              '<path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"/><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3"/>',
              ctx.pick('Delete object', 'Удалить объект'),
              deleteObject,
              { variant: 'danger' },
            ),
          ),
        );
      };

      // ---------- camera & interaction ----------
      const applyCamera = (): void => {
        const sin = Math.sin(phi);
        camera.position.set(
          target.x + radius * sin * Math.sin(theta),
          target.y + radius * Math.cos(phi),
          target.z + radius * sin * Math.cos(theta),
        );
        camera.lookAt(target);
        // Keep the view cube aligned with the camera orientation (CSS pitch grows downward).
        viewCubeCube.style.transform =
          `rotateX(${((phi * 180) / Math.PI - 90).toFixed(2)}deg) rotateY(${(-(theta * 180) / Math.PI).toFixed(2)}deg)`;
      };

      const setView = (view: string): void => {
        const presets: Record<string, [number, number]> = {
          iso: [Math.PI / 5, Math.PI / 3.2],
          front: [0, Math.PI / 2],
          back: [Math.PI, Math.PI / 2],
          right: [Math.PI / 2, Math.PI / 2],
          left: [-Math.PI / 2, Math.PI / 2],
          top: [0, 0.02],
          bottom: [0, Math.PI - 0.02],
        };
        const preset = presets[view];
        if (!preset) return;
        theta = preset[0];
        phi = preset[1];
        applyCamera();
      };

      const viewCubeCube = h('div', { class: 'dt-viewcube-cube' });
      for (const face of VIEW_FACES) {
        viewCubeCube.appendChild(
          h('button', {
            class: `dt-viewcube-face ${face.className}`,
            type: 'button',
            title: ctx.pick(face.title[0], face.title[1]),
            text: ctx.pick(face.label[0], face.label[1]),
            onclick: (event: MouseEvent) => {
              event.stopPropagation();
              setView(face.view);
            },
          }),
        );
      }
      const viewCube = h(
        'div',
        { class: 'dt-viewcube', title: ctx.pick('Click a face to snap the camera', 'Клик по грани — фиксированный вид') },
        h('div', { class: 'dt-viewcube-stage' }, viewCubeCube),
        iconBtn(
          '<path d="M12 3l8 4.4v9.2L12 21l-8 -4.4V7.4z"/><path d="M12 12l8 -4.6"/><path d="M12 12L4 7.4"/><path d="M12 12v9"/>',
          ctx.pick('Isometric view', 'Изометрический вид'),
          () => setView('iso'),
          { variant: 'subtle', class: 'dt-viewcube-home' },
        ),
      );
      stage.append(viewCube);

      const pointerNdc = (event: PointerEvent | MouseEvent): THREE.Vector2 => {
        const rect = renderer.domElement.getBoundingClientRect();
        return new THREE.Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -((event.clientY - rect.top) / rect.height) * 2 + 1,
        );
      };

      const pickObject = (event: PointerEvent | MouseEvent): SceneObject | undefined => {
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(pointerNdc(event), camera);
        const hits = raycaster.intersectObjects(
          objects.map((item) => item.object),
          true,
        );
        if (!hits.length) return undefined;
        let node: THREE.Object3D | null = hits[0].object;
        while (node) {
          const found = objects.find((item) => item.object === node);
          if (found) return found;
          node = node.parent;
        }
        return undefined;
      };

      const canvas = renderer.domElement;
      canvas.style.touchAction = 'none';
      canvas.addEventListener('pointerdown', (event) => {
        if (event.button === 1) {
          // Middle button always orbits, whatever is selected underneath.
          event.preventDefault();
          middleOrbit = true;
          orbiting = true;
          moved = false;
          lastPointer = { x: event.clientX, y: event.clientY };
          canvas.setPointerCapture(event.pointerId);
          return;
        }
        if (event.button !== 0) return;
        if (controls.axis !== null || controls.dragging) {
          gizmoPointer = true;
          return;
        }
        gizmoPointer = false;
        orbiting = true;
        moved = false;
        lastPointer = { x: event.clientX, y: event.clientY };
        canvas.setPointerCapture(event.pointerId);
      });
      canvas.addEventListener('pointermove', (event) => {
        if (!orbiting) return;
        const dx = event.clientX - lastPointer.x;
        const dy = event.clientY - lastPointer.y;
        if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
        lastPointer = { x: event.clientX, y: event.clientY };
        if (event.shiftKey) {
          const right = new THREE.Vector3();
          const up = new THREE.Vector3();
          camera.matrix.extractBasis(right, up, new THREE.Vector3());
          target.addScaledVector(right, (-dx * radius) / 400);
          target.addScaledVector(up, (dy * radius) / 400);
        } else {
          theta -= dx / 160;
          phi = clamp(phi - dy / 160, 0.02, Math.PI - 0.02);
        }
        applyCamera();
      });
      canvas.addEventListener('pointerup', (event) => {
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        if (middleOrbit) {
          middleOrbit = false;
          orbiting = false;
          return;
        }
        if (gizmoPointer) {
          gizmoPointer = false;
          return;
        }
        orbiting = false;
        if (moved) return;
        const hit = pickObject(event);
        if (hit) {
          selectObject(hit.id);
        } else {
          selectedId = 0;
          updateHelpers();
          renderObjectList();
          renderInspector();
        }
      });
      canvas.addEventListener(
        'wheel',
        (event) => {
          event.preventDefault();
          radius = clamp(radius * (1 + Math.sign(event.deltaY) * 0.08), 2.5, 40);
          applyCamera();
        },
        { passive: false },
      );

      // ---------- model import ----------
      const importModel = async (file: File): Promise<void> => {
        setError(error, null);
        try {
          const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
          let object: THREE.Object3D | null = null;
          if (extension === 'obj') {
            object = new OBJLoader().parse(await file.text());
          } else if (extension === 'stl') {
            const geometry = new STLLoader().parse(await file.arrayBuffer());
            object = new THREE.Mesh(
              geometry,
              new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.4, roughness: 0.35 }),
            );
          } else if (extension === 'glb' || extension === 'gltf') {
            const gltf = await new GLTFLoader().parseAsync(await file.arrayBuffer(), '');
            object = gltf.scene;
          }
          if (!object) {
            setError(
              error,
              ctx.pick('Supported model formats: OBJ, STL, GLB, GLTF.', 'Поддерживаемые форматы: OBJ, STL, GLB, GLTF.'),
            );
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
          objects.push({ id: nextId++, name: file.name, kind: 'model', object });
          selectedId = objects[objects.length - 1].id;
          syncUi();
        } catch {
          setError(error, ctx.pick('Cannot read this 3D model.', 'Не удалось прочитать 3D-модель.'));
        }
      };

      const modelInput = h('input', {
        type: 'file',
        accept: '.obj,.stl,.glb,.gltf',
        class: 'dt-hidden',
      });
      modelInput.addEventListener('change', () => {
        const file = modelInput.files?.[0];
        if (file) void importModel(file);
        modelInput.value = '';
      });

      // ---------- layout ----------
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

      const syncUi = (): void => {
        renderObjectList();
        renderInspector();
        updateHelpers();
      };

      const renderToBlob = async (): Promise<Blob | null> => {
        const previousAspect = camera.aspect;
        const previousWidth = renderer.domElement.width;
        const previousHeight = renderer.domElement.height;
        const previousBox = selectionBox.visible;
        const previousGizmo = gizmoHelper.visible;
        const previousGrid = grid.visible;
        const previousGround = ground.visible;
        const previousBackground = scene.background;
        if (hideHelpers) {
          selectionBox.visible = false;
          grid.visible = false;
        }
        gizmoHelper.visible = false;
        if (transparent) scene.background = null;
        renderer.setSize(renderWidth, renderHeight, false);
        camera.aspect = renderWidth / renderHeight;
        camera.updateProjectionMatrix();
        renderer.render(scene, camera);
        const blob = await new Promise<Blob | null>((resolve) => {
          renderer.domElement.toBlob((value) => resolve(value), 'image/png');
        });
        selectionBox.visible = previousBox;
        gizmoHelper.visible = previousGizmo;
        grid.visible = previousGrid;
        ground.visible = previousGround;
        scene.background = previousBackground;
        camera.aspect = previousAspect;
        camera.updateProjectionMatrix();
        renderer.setSize(previousWidth, previousHeight, false);
        resize();
        return blob;
      };

      const renderImage = async (): Promise<void> => {
        const blob = await renderToBlob();
        if (!blob) {
          setError(error, ctx.pick('Render failed.', 'Не удалось отрендерить изображение.'));
          return;
        }
        downloadBlob('scene.png', blob);
      };

      const backgroundInput = h('input', { type: 'color', class: 'dt-color-input', value: background });
      backgroundInput.addEventListener('input', () => {
        background = backgroundInput.value;
        scene.background = new THREE.Color(background);
      });

      const lightsPane = pane(
        ctx.pick('Scene', 'Сцена'),
        h(
          'div',
          { class: 'dt-stack' },
          field(ctx.pick('Background', 'Фон'), backgroundInput),
          knobGrid(
            knobField(ctx.pick('Ambient light', 'Общий свет'), 0, 200, Math.round(ambientIntensity * 100), (value) => {
              ambientIntensity = value / 100;
              ambient.intensity = ambientIntensity;
            }),
            knobField(ctx.pick('Key light', 'Основной свет'), 0, 600, Math.round(keyIntensity * 100), (value) => {
              keyIntensity = value / 100;
              key.intensity = keyIntensity;
            }),
            knobField(ctx.pick('Exposure', 'Экспозиция'), 50, 200, Math.round(exposure * 100), (value) => {
              exposure = value / 100;
              renderer.toneMappingExposure = exposure;
            }),
          ),
          checkbox(ctx.pick('Ground plane', 'Плоскость пола'), groundVisible, (value) => {
            groundVisible = value;
            ground.visible = value;
          }),
          checkbox(ctx.pick('Hide grid in render', 'Скрывать сетку при рендере'), hideHelpers, (value) => {
            hideHelpers = value;
          }),
        ),
        [],
        '',
        { collapsible: false },
      );

      const renderPane = pane(
        ctx.pick('Render', 'Рендер'),
        h(
          'div',
          { class: 'dt-stack' },
          field(
            ctx.pick('Resolution', 'Разрешение'),
            select(
              [
                { value: '1280x720', label: '1280 × 720' },
                { value: '1920x1080', label: '1920 × 1080' },
                { value: '2560x1440', label: '2560 × 1440' },
                { value: '1080x1080', label: '1080 × 1080' },
                { value: '3840x2160', label: '3840 × 2160' },
              ],
              `${renderWidth}x${renderHeight}`,
              (value) => {
                const [width, height] = value.split('x').map(Number);
                renderWidth = width;
                renderHeight = height;
              },
            ),
          ),
          checkbox(ctx.pick('Transparent background', 'Прозрачный фон'), transparent, (value) => {
            transparent = value;
          }),
          btn(ctx.pick('Render PNG', 'Отрендерить PNG'), () => void renderImage(), {
            variant: 'primary',
            icon: '<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2"/><path d="M7 11l5 5l5 -5"/><path d="M12 4l0 12"/>',
          }),
          note(
            ctx.pick(
              'Pick Move/Rotate/Scale to show the gizmo, then drag a colored arrow, ring or cube. Drag empty space to orbit, Shift+drag to pan, wheel zooms.',
              'Выберите Перемещение/Поворот/Масштаб — появится гизмо; тяните цветную стрелку, кольцо или куб. Тяните пустое место для вращения камеры, Shift+тяните — сдвиг, колесо — зум.',
            ),
            'info',
          ),
        ),
      );

      const shapeToolbar = h('div', { class: 'dt-toolbar dt-scene-shapes' });
      for (const kind of ['box', 'sphere', 'cylinder', 'cone', 'torus', 'plane'] as ShapeKind[]) {
        const label = ctx.pick(labels[kind][0], labels[kind][1]);
        shapeToolbar.appendChild(
          iconBtn(SHAPE_ICONS[kind], label, () => addObject(kind), { variant: 'subtle' }),
        );
      }

      const modeSegment = segmented(
        [
          { value: 'select', label: ctx.pick('Select', 'Выбор'), icon: MODE_ICONS.select },
          { value: 'move', label: ctx.pick('Move', 'Двигать'), icon: MODE_ICONS.move },
          { value: 'rotate', label: ctx.pick('Rotate', 'Вращать'), icon: MODE_ICONS.rotate },
          { value: 'scale', label: ctx.pick('Scale', 'Масштаб'), icon: MODE_ICONS.scale },
        ],
        'move',
        (value) => {
          transformMode = value as TransformMode;
          stage.dataset.mode = value;
          gizmoPointer = false;
          updateHelpers();
        },
      );

      const spaceSegment = segmented(
        [
          {
            value: 'world',
            label: ctx.pick('World axes', 'Мировые оси'),
            title: ctx.pick(
              'Gizmo arrows stay aligned with the scene axes',
              'Стрелки гизмо направлены по осям сцены',
            ),
            icon: '<path d="M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0 -18z"/><path d="M3 12h18"/><path d="M12 3c2.4 2.7 2.4 15.3 0 18"/><path d="M12 3c-2.4 2.7 -2.4 15.3 0 18"/>',
          },
          {
            value: 'local',
            label: ctx.pick('Object axes', 'Оси объекта'),
            title: ctx.pick(
              'Gizmo rotates with the selected object',
              'Гизмо поворачивается вместе с выбранным объектом',
            ),
            icon: '<path d="M12 3l8 4.4v9.2L12 21l-8 -4.4V7.4z"/><path d="M12 12l8 -4.6"/><path d="M12 12L4 7.4"/><path d="M12 12v9"/>',
          },
        ],
        'world',
        (value) => controls.setSpace(value === 'local' ? 'local' : 'world'),
      );

      const snapToggle = checkbox(ctx.pick('Snap 0.25', 'Привязка 0.25'), true, (value) => {
        controls.translationSnap = value ? 0.25 : null;
        controls.rotationSnap = value ? Math.PI / 12 : null;
        controls.scaleSnap = value ? 0.1 : null;
      });

      const modelDrop = fileDrop({
        accept: '.obj,.stl,.glb,.gltf',
        hint: ctx.pick('Drop a 3D model (OBJ, STL, GLB, GLTF)', 'Перетащите 3D-модель (OBJ, STL, GLB, GLTF)'),
        onFiles: (files) => {
          if (files[0]) void importModel(files[0]);
        },
      });

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          error,
          resizableSplit(
            h(
              'div',
              { class: 'dt-col' },
              h(
                'div',
                { class: 'dt-toolbar dt-scene-toolbar' },
                modeSegment,
                spaceSegment,
                snapToggle,
                shapeToolbar,
                btn(ctx.pick('Import model', 'Импорт модели'), () => modelInput.click(), { variant: 'ghost' }),
                h('span', { class: 'dt-grow' }),
                stats,
              ),
              stage,
              modelDrop,
              h(
                'div',
                { class: 'dt-hint' },
                ctx.pick(
                  'Click a face of the view cube to snap the camera, drag empty space or the middle mouse button to orbit, Shift+drag to pan, wheel zooms. World axes keep the gizmo aligned with the scene, object axes follow the rotation of the selected object.',
                  'Кликните по грани куба вида, чтобы зафиксировать камеру; тяните пустое место или среднюю кнопку мыши — орбита, Shift+тяните — сдвиг, колесо — зум. Мировые оси держат гизмо по осям сцены, оси объекта поворачиваются вместе с выбранным объектом.',
                ),
              ),
            ),
            h(
              'div',
              { class: 'dt-col' },
              pane(ctx.pick('Objects', 'Объекты'), objectList),
              pane(ctx.pick('Properties', 'Свойства'), inspector),
              lightsPane,
              renderPane,
            ),
            {
              ratio: 0.72,
              minSide: 320,
              title: ctx.pick('Drag to resize the viewport', 'Потяните, чтобы изменить ширину сцены'),
              onResize: () => resize(),
            },
          ),
        ),
      );
      root.append(modelInput);

      // ---------- boot ----------
      addObject('torus');
      syncUi();
      resize();
      applyCamera();
      const incoming = ctx.takeIncoming();
      if (incoming) void importModel(incomingToFile(incoming));

      const loop = (): void => {
        if (!root.isConnected) return;
        selectionBox.update();
        renderer.render(scene, camera);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    },
  });
}

export const sceneEditorTools = [sceneEditorTool()];
