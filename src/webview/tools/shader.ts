/** Shader playground: edit GLSL or HLSL pixel shaders and preview them live in WebGL. */
import {
  area,
  btn,
  downloadBlob,
  errorSlot,
  iconBtn,
  note,
  pane,
  resizableSplit,
  segmented,
  selectField,
  setError,
} from '../components.ts';
import { clamp, h } from '../dom.ts';
import { defineTool } from '../tool-types.ts';

type ShaderLang = 'glsl' | 'hlsl';

interface ShaderPreset {
  id: string;
  lang: ShaderLang;
  label: [string, string];
}

const GLSL_HEADER = `precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;
`;

const VERTEX_ES1 = `attribute vec2 a_pos;
varying vec2 uv;
void main() {
  uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const VERTEX_ES3 = `#version 300 es
in vec2 a_pos;
out vec2 uv;
void main() {
  uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

/** Constants that glsl.app/lygia provide out of the box; injected with #ifndef guards. */
const GLSL_PRELUDE = `#ifndef PI
#define PI 3.141592653589793
#endif
#ifndef TAU
#define TAU 6.283185307179586
#endif
#ifndef E
#define E 2.718281828459045
#endif
`;

export interface PreparedSource {
  code: string;
  includes: string[];
  es3: boolean;
}

/**
 * Prepares user GLSL for WebGL: detects `#version 300 es`, drops leftover
 * `#include` lines that could not be resolved and adds PI/TAU/E.
 */
export function prepareGlslSource(source: string): PreparedSource {
  const includes: string[] = [];
  let es3 = false;
  const kept: string[] = [];
  for (const line of source.replace(/\r\n?/g, '\n').split('\n')) {
    const include = line.match(/^\s*#include\s+[<"]((?:[^>"]|\\.)+)[>"]/);
    if (include) {
      includes.push(include[1]);
      continue;
    }
    if (/^\s*#version\s+300\s+es\b/i.test(line)) es3 = true;
    kept.push(line);
  }
  const versionIndex = kept.findIndex((line) => /^\s*#version\b/.test(line));
  const code =
    versionIndex >= 0
      ? [...kept.slice(0, versionIndex + 1), GLSL_PRELUDE, ...kept.slice(versionIndex + 1)].join('\n')
      : `${GLSL_PRELUDE}${kept.join('\n')}`;
  return { code, includes, es3 };
}

const FETCH_MAX_INCLUDES = 24;
const FETCH_MAX_DEPTH = 6;

/** Resolves one `#include` specifier to a URL (lygia/<path> uses the unpkg CDN). */
export function resolveIncludeUrl(specifier: string, base: string | null): string | null {
  if (/^https?:\/\//i.test(specifier)) return specifier;
  if (specifier.startsWith('lygia/')) {
    const path = specifier.slice('lygia/'.length).replace(/\.glsl$/i, '');
    return `https://unpkg.com/lygia@latest/${path}.glsl`;
  }
  if (base) {
    try {
      return new URL(specifier, base).toString();
    } catch {
      return null;
    }
  }
  return null;
}

/** Overloads used by the HLSL → GLSL converter. */
const HLSL_HELPERS = `float dtSaturate(float v) { return clamp(v, 0.0, 1.0); }
vec2 dtSaturate(vec2 v) { return clamp(v, vec2(0.0), vec2(1.0)); }
vec3 dtSaturate(vec3 v) { return clamp(v, vec3(0.0), vec3(1.0)); }
vec4 dtSaturate(vec4 v) { return clamp(v, vec4(0.0), vec4(1.0)); }
float dtMul(float a, float b) { return a * b; }
vec2 dtMul(vec2 a, vec2 b) { return a * b; }
vec3 dtMul(vec3 a, vec3 b) { return a * b; }
vec4 dtMul(vec4 a, vec4 b) { return a * b; }
vec2 dtMul(mat2 m, vec2 v) { return m * v; }
vec3 dtMul(mat3 m, vec3 v) { return m * v; }
vec4 dtMul(mat4 m, vec4 v) { return m * v; }
vec2 dtMul(vec2 v, mat2 m) { return v * m; }
vec3 dtMul(vec3 v, mat3 m) { return v * m; }
vec4 dtMul(vec4 v, mat4 m) { return v * m; }
`;

const PRESETS: ShaderPreset[] = [
  {
    id: 'plasma',
    lang: 'glsl',
    label: ['Plasma', 'Плазма'],
  },
  {
    id: 'mandelbrot',
    lang: 'glsl',
    label: ['Mandelbrot', 'Мандельброт'],
  },
  {
    id: 'grid',
    lang: 'glsl',
    label: ['Grid pulse', 'Пульс сетки'],
  },
  {
    id: 'es3-rings',
    lang: 'glsl',
    label: ['ES 3.00 rings', 'ES 3.00 кольца'],
  },
  {
    id: 'hlsl-circle',
    lang: 'hlsl',
    label: ['HLSL circle', 'HLSL круг'],
  },
  {
    id: 'hlsl-waves',
    lang: 'hlsl',
    label: ['HLSL waves', 'HLSL волны'],
  },
];

const PRESET_CODE: Record<string, string> = {
  plasma: `${GLSL_HEADER}
void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution) / u_resolution.y;
  float v = sin(uv.x * 4.0 + u_time) + sin(uv.y * 3.0 - u_time * 1.3);
  v += sin((uv.x + uv.y) * 5.0 + u_time * 0.7);
  vec3 color = 0.5 + 0.5 * cos(u_time + v + vec3(0.0, 2.0, 4.0));
  gl_FragColor = vec4(color, 1.0);
}`,
  mandelbrot: `${GLSL_HEADER}
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y * 2.6;
  vec2 c = uv + vec2(-0.5, 0.0);
  vec2 z = vec2(0.0);
  float iter = 0.0;
  for (int n = 0; n < 120; n++) {
    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
    if (dot(z, z) > 4.0) { break; }
    iter += 1.0;
  }
  float t = iter / 120.0;
  vec3 color = vec3(t * 1.4, t * 0.8, 0.35 + 0.45 * sin(u_time * 0.6 + t * 7.0));
  gl_FragColor = vec4(color, 1.0);
}`,
  grid: `${GLSL_HEADER}
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;
  vec2 cell = abs(fract(uv * 8.0 + vec2(0.0, u_time * 0.4)) - 0.5);
  float line = smoothstep(0.46, 0.5, max(cell.x, cell.y));
  float wave = 0.5 + 0.5 * sin(length(uv) * 12.0 - u_time * 3.0);
  vec3 color = vec3(0.06, 0.09, 0.16) + wave * vec3(0.15, 0.45, 0.9) * (1.0 - line);
  gl_FragColor = vec4(color, 1.0);
}`,
  'es3-rings': `#version 300 es
precision highp float;

in vec2 uv;
out vec4 out_color;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec4 u_mouse;

void main() {
  vec2 st = uv * vec2(u_resolution.x / u_resolution.y, 1.0);
  vec2 mouse = u_mouse.xy / u_resolution;
  float d = length(st - mouse * vec2(u_resolution.x / u_resolution.y, 1.0));
  float rings = 0.5 + 0.5 * cos(d * 28.0 - u_time * 3.0);
  out_color = vec4(
    mix(vec3(0.06, 0.09, 0.16), vec3(0.36, 0.62, 0.96), rings),
    1.0
  );
}`,
  'hlsl-circle': `float4 PSMain(float2 uv : TEXCOORD0) : SV_Target
{
    float2 p = uv * 2.0 - 1.0;
    float d = length(p) - 0.5 * (0.8 + 0.2 * sin(_Time.y * 2.0));
    float3 color = lerp(float3(0.10, 0.30, 0.90), float3(1.00, 0.62, 0.20), saturate(-d * 4.0));
    return float4(color, 1.0);
}`,
  'hlsl-waves': `float4 PSMain(float2 uv : TEXCOORD0) : SV_Target
{
    float2 p = uv * 6.0;
    float w = sin(p.x + _Time.y) * 0.5 + sin(p.y * 1.7 - _Time.y * 0.8) * 0.5;
    float bands = frac(p.y + w) * 0.9 + 0.1;
    float3 color = lerp(float3(0.05, 0.10, 0.25), float3(0.30, 0.85, 0.95), bands);
    return float4(color, 1.0);
}`,
};

const RESOLUTIONS: Array<[number, number]> = [
  [640, 360],
  [960, 540],
  [1280, 720],
  [512, 512],
];

/** Best-effort HLSL pixel shader → GLSL ES 1.0 conversion for simple shaders. */
export function hlslToGlsl(source: string): string {
  let code = source.replace(/\r\n?/g, '\n');
  code = code.replace(/\/\*[\s\S]*?\*\//g, '');
  code = code.replace(/cbuffer[^{]*\{[^}]*\}/g, '');
  code = code.replace(/\b_[Tt]ime\.y\b/g, 'u_time');
  code = code.replace(/\b_[Tt]ime\.x\b/g, 'u_time');
  code = code.replace(/\b_ScreenParams\.xy\b/g, 'u_resolution');
  code = code.replace(/\bhalf([234]?)\b/g, 'float$1');
  code = code.replace(/\bfloat2x2\b/g, 'mat2');
  code = code.replace(/\bfloat3x3\b/g, 'mat3');
  code = code.replace(/\bfloat4x4\b/g, 'mat4');
  code = code.replace(/\bfloat([234])\b/g, 'vec$1');
  code = code.replace(/\buint([234])\b/g, 'ivec$1');
  code = code.replace(/\bint([234])\b/g, 'ivec$1');
  code = code.replace(/\bfrac\s*\(/g, 'fract(');
  code = code.replace(/\blerp\s*\(/g, 'mix(');
  code = code.replace(/\bsaturate\s*\(/g, 'dtSaturate(');
  code = code.replace(/\bmul\s*\(/g, 'dtMul(');
  code = code.replace(/\batan2\s*\(/g, 'atan(');
  code = code.replace(/\brsqrt\s*\(/g, 'inversesqrt(');
  code = code.replace(/\bfmod\s*\(/g, 'mod(');
  code = code.replace(/\bddx\s*\(/g, 'dFdx(');
  code = code.replace(/\bddy\s*\(/g, 'dFdy(');
  code = code.replace(/\btex2D\s*\(/g, 'texture2D(');

  const entry = code.match(/vec4\s+\w+\s*\(\s*(?:in\s+)?vec2\s+(\w+)\s*:\s*[\w]+\s*\)\s*:\s*SV_?Target\s*\{([\s\S]*)\}\s*$/i);
  if (!entry) {
    throw new Error('No `float4 name(float2 uv : TEXCOORD0) : SV_Target { … }` entry point found.');
  }
  const param = entry[1];
  const body = entry[2].replace(/\breturn\s+/g, 'gl_FragColor = ');
  const head = code.slice(0, entry.index ?? 0);
  const helpers = head
    .split('\n')
    .filter((line) => line.trim() && !/^(float|int|uint|vec|ivec|mat|sampler|Texture|Sampler|struct|#)/i.test(line.trim()))
    .join('\n');
  return `${GLSL_HEADER}${HLSL_HELPERS}${helpers}\nvoid main() {\n  vec2 ${param} = gl_FragCoord.xy / u_resolution;\n  gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);\n${body}\n}`;
}

function shaderTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'media-shader',
    group: 'media',
    icon: '<path d="M4 4h16v16H4z"/><path d="M8 9l-2 3l2 3"/><path d="M16 9l2 3l-2 3"/><path d="M13 8l-2 8"/>',
    name: { en: 'Shader Playground', ru: 'Шейдеры' },
    desc: {
      en: 'Write and preview GLSL or HLSL fragment shaders live in WebGL with presets, uniforms and PNG export.',
      ru: 'Пишите и смотрите фрагментные шейдеры GLSL и HLSL прямо в WebGL: пресеты, юниформы и экспорт PNG.',
    },
    keywords: 'shader glsl hlsl webgl fragment pixel playground gpu effect',
    mount(root, ctx) {
      let lang: ShaderLang = 'glsl';
      let resolution: [number, number] = [960, 540];
      let timer = 0;
      let program: WebGLProgram | null = null;
      let startedAt = performance.now();
      let mouse = { x: 0.5, y: 0.5 };

      const error = errorSlot();
      const canvas = h('canvas', { class: 'dt-shader-canvas', width: resolution[0], height: resolution[1] });
      const contextAttributes: WebGLContextAttributes = { antialias: true, preserveDrawingBuffer: true, alpha: false };
      const gl = (canvas.getContext('webgl2', contextAttributes) ?? canvas.getContext('webgl', contextAttributes)) as
        | WebGL2RenderingContext
        | WebGLRenderingContext
        | null;
      const isWebGL2 = typeof (gl as WebGL2RenderingContext | null)?.createVertexArray === 'function';
      const status = h('span', { class: 'dt-hint' }, '');
      const includeNote = h('div', { class: 'dt-hint' }, '');
      const editor = area({ rows: 22, value: PRESET_CODE.plasma, class: 'dt-shader-code', oninput: () => schedule() });

      const buffer = gl?.createBuffer() ?? null;
      let activeUniforms = new Map<string, { location: WebGLUniformLocation | null; type: number; size: number }>();
      let mousePressed = false;

      const compile = (type: number, source: string): WebGLShader | null => {
        if (!gl) return null;
        const shader = gl.createShader(type);
        if (!shader) return null;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          const log = (gl.getShaderInfoLog(shader) ?? 'compile error').replace(/\u0000/g, '').trim();
          gl.deleteShader(shader);
          throw new Error(log);
        }
        return shader;
      };

      const build = (fragmentSource: string, warnings: string[] = []): void => {
        if (!gl) {
          setError(error, ctx.pick('WebGL is not available in this view.', 'WebGL недоступен в этом окне.'));
          return;
        }
        let skippedIncludes: string[] = [];
        try {
          const prepared =
            lang === 'hlsl'
              ? { code: fragmentSource, includes: [] as string[], es3: false }
              : prepareGlslSource(fragmentSource);
          skippedIncludes = prepared.includes;
          if (prepared.es3 && !isWebGL2) {
            throw new Error(
              ctx.pick(
                '`#version 300 es` needs WebGL2, which is not available in this view.',
                '`#version 300 es` требует WebGL2, а он недоступен в этом окне.',
              ),
            );
          }
          const vertex = compile(gl.VERTEX_SHADER, prepared.es3 ? VERTEX_ES3 : VERTEX_ES1);
          const fragment = compile(gl.FRAGMENT_SHADER, prepared.code);
          if (!vertex || !fragment) throw new Error('shader allocation failed');
          const next = gl.createProgram();
          if (!next) throw new Error('program allocation failed');
          gl.attachShader(next, vertex);
          gl.attachShader(next, fragment);
          gl.bindAttribLocation(next, 0, 'a_pos');
          gl.linkProgram(next);
          if (!gl.getProgramParameter(next, gl.LINK_STATUS)) {
            const log = gl.getProgramInfoLog(next) ?? 'link error';
            gl.deleteProgram(next);
            throw new Error(log);
          }
          gl.deleteShader(vertex);
          gl.deleteShader(fragment);
          if (program) gl.deleteProgram(program);
          program = next;
          activeUniforms = new Map();
          const total = gl.getProgramParameter(next, gl.ACTIVE_UNIFORMS) as number;
          for (let index = 0; index < total; index++) {
            const info = gl.getActiveUniform(next, index);
            if (!info) continue;
            const name = info.name.replace(/\[0\]$/, '');
            activeUniforms.set(name, { location: gl.getUniformLocation(next, info.name), type: info.type, size: info.size });
          }
          setError(error, null);
          const version = lang === 'hlsl' ? 'HLSL → GLSL' : prepared.es3 ? 'GLSL ES 3.00' : 'GLSL ES 1.00';
          status.textContent = prepared.includes.length
            ? `${version} · OK · #include: ${prepared.includes.length}`
            : `${version} · OK`;
        } catch (failure) {
          program = null;
          activeUniforms = new Map();
          setError(error, failure instanceof Error ? failure.message : String(failure));
          status.textContent = lang.toUpperCase();
        }
        includeNote.textContent = warnings.length
          ? ctx.pick(`#include: ${warnings.join(' · ')}`, `#include: ${warnings.join(' · ')}`)
          : skippedIncludes.length
            ? ctx.pick(
                `Skipped #include: ${skippedIncludes.join(', ')} — could not be resolved.`,
                `Пропущены #include: ${skippedIncludes.join(', ')} — не удалось разрешить.`,
              )
            : '';
      };

      const sourceToGlsl = (source: string): string => (lang === 'hlsl' ? hlslToGlsl(source) : source);

      const includeCache = new Map<string, string>();
      let runToken = 0;

      const fetchInclude = async (url: string): Promise<string> => {
        const cached = includeCache.get(url);
        if (cached !== undefined) return cached;
        let text = '';
        try {
          const result = await ctx.rpc<{ text?: string }>('fetchText', { url });
          text = String(result?.text ?? '');
        } catch {
          // Standalone preview (no extension host): fall back to a direct fetch.
          const response = await fetch(url, { headers: { accept: 'text/plain, */*' } });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          text = await response.text();
        }
        includeCache.set(url, text);
        return text;
      };

      const expandIncludes = async (
        source: string,
        base: string | null,
        depth: number,
        seen: Set<string>,
        warnings: string[],
      ): Promise<string> => {
        const output: string[] = [];
        for (const line of source.replace(/\r\n?/g, '\n').split('\n')) {
          const match = line.match(/^\s*#include\s+([<"])((?:[^>"]|\\.)+)[>"]/);
          if (!match) {
            output.push(line);
            continue;
          }
          const specifier = match[2];
          const url = resolveIncludeUrl(specifier, base);
          if (!url) {
            warnings.push(`${specifier}: unsupported path`);
            output.push(`// #include "${specifier}" skipped (unsupported path)`);
            continue;
          }
          if (depth >= FETCH_MAX_DEPTH || seen.size >= FETCH_MAX_INCLUDES || seen.has(url)) {
            warnings.push(`${url}: skipped (recursion or limit)`);
            output.push(`// #include ${url} skipped (recursion or limit)`);
            continue;
          }
          seen.add(url);
          try {
            const text = await fetchInclude(url);
            const nested = await expandIncludes(text, url, depth + 1, seen, warnings);
            output.push(`// >>> #include ${url}`, nested, `// <<< ${url}`);
          } catch (failure) {
            warnings.push(`${url}: ${failure instanceof Error ? failure.message : String(failure)}`);
            output.push(`// #include ${url} failed`);
          }
        }
        return output.join('\n');
      };

      const run = async (): Promise<void> => {
        const token = ++runToken;
        const source = editor.value;
        try {
          if (lang === 'hlsl' || !/#include\b/.test(source)) {
            build(sourceToGlsl(source));
            return;
          }
          status.textContent = ctx.pick('Loading #include…', 'Загружаю #include…');
          const warnings: string[] = [];
          const expanded = await expandIncludes(source, null, 0, new Set(), warnings);
          if (token !== runToken) return;
          build(expanded, warnings);
        } catch (failure) {
          setError(error, failure instanceof Error ? failure.message : String(failure));
        }
      };

      const schedule = (): void => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => void run(), 350);
      };

      const draw = (now: number): void => {
        if (!root.isConnected) return;
        if (!gl || !program) {
          requestAnimationFrame(draw);
          return;
        }
        const width = canvas.width;
        const height = canvas.height;
        gl.viewport(0, 0, width, height);
        gl.useProgram(program);
        if (!buffer) return;
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const location = gl.getAttribLocation(program, 'a_pos');
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
        const time = (now - startedAt) / 1000;
        const mouseX = mouse.x * width;
        const mouseY = mouse.y * height;
        for (const name of ['u_time', 'iTime']) {
          const uniform = activeUniforms.get(name);
          if (uniform?.location && uniform.type === gl.FLOAT) gl.uniform1f(uniform.location, time);
        }
        for (const name of ['u_resolution', 'iResolution']) {
          const uniform = activeUniforms.get(name);
          if (!uniform?.location) continue;
          if (uniform.type === gl.FLOAT_VEC2) gl.uniform2f(uniform.location, width, height);
          else if (uniform.type === gl.FLOAT_VEC3) gl.uniform3f(uniform.location, width, height, 1);
        }
        for (const name of ['u_mouse', 'iMouse']) {
          const uniform = activeUniforms.get(name);
          if (!uniform?.location) continue;
          if (uniform.type === gl.FLOAT_VEC4) gl.uniform4f(uniform.location, mouseX, mouseY, mousePressed ? 1 : 0, 0);
          else if (uniform.type === gl.FLOAT_VEC3) gl.uniform3f(uniform.location, mouseX, mouseY, mousePressed ? 1 : 0);
          else if (uniform.type === gl.FLOAT_VEC2) gl.uniform2f(uniform.location, mouseX, mouseY);
        }
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        requestAnimationFrame(draw);
      };

      const applyResolution = (width: number, height: number): void => {
        resolution = [width, height];
        canvas.width = width;
        canvas.height = height;
      };

      let activePreset = 'plasma';

      const syncLangSegment = (): void => {
        for (const button of Array.from(langSegment.querySelectorAll<HTMLElement>('.dt-segment'))) {
          const active = button.dataset.value === lang;
          button.classList.toggle('is-active', active);
          button.setAttribute('aria-checked', String(active));
        }
      };

      const pickPreset = (id: string): void => {
        const preset = PRESETS.find((item) => item.id === id);
        if (!preset) return;
        activePreset = preset.id;
        lang = preset.lang;
        editor.value = PRESET_CODE[preset.id] ?? '';
        syncLangSegment();
        void run();
      };

      const langSegment = segmented(
        [
          { value: 'glsl', label: 'GLSL' },
          { value: 'hlsl', label: 'HLSL' },
        ],
        'glsl',
        (value) => {
          lang = value === 'hlsl' ? 'hlsl' : 'glsl';
          void run();
        },
      );

      canvas.addEventListener('pointermove', (event) => {
        const rect = canvas.getBoundingClientRect();
        mouse = {
          x: clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1),
          y: clamp(1 - (event.clientY - rect.top) / Math.max(1, rect.height), 0, 1),
        };
      });
      canvas.addEventListener('pointerleave', () => {
        mouse = { x: 0.5, y: 0.5 };
        mousePressed = false;
      });
      canvas.addEventListener('pointerdown', () => {
        mousePressed = true;
      });
      canvas.addEventListener('pointerup', () => {
        mousePressed = false;
      });

      const exportPng = (): void => {
        canvas.toBlob((blob) => {
          if (blob) downloadBlob('shader.png', blob);
        }, 'image/png');
      };

      const codePane = pane(
        ctx.pick('Shader source', 'Код шейдера'),
        h(
          'div',
          { class: 'dt-stack' },
          editor,
          note(
            ctx.pick(
              'GLSL ES 1.00 and ES 3.00 (`#version 300 es`) are both supported: the vertex stage provides `uv` and the playground exposes `u_time`, `u_resolution` and `u_mouse` (vec2 or vec4) plus `iTime`/`iResolution`/`iMouse` aliases. `PI`, `TAU` and `E` are predefined. `#include "https://…"` is downloaded through the extension host and inlined (nested includes and relative paths work); `<lygia/…>` is resolved from the unpkg CDN. HLSL is transpiled to GLSL — a simple converter handles types, frac/lerp/saturate/mul and one `float4 Name(float2 uv : TEXCOORD0) : SV_Target` function.',
              'Поддерживаются и GLSL ES 1.00, и ES 3.00 (`#version 300 es`): вершинная стадия передаёт `uv`, доступны `u_time`, `u_resolution`, `u_mouse` (vec2 или vec4) и алиасы `iTime`/`iResolution`/`iMouse`. `PI`, `TAU`, `E` предопределены. `#include "https://…"` скачивается через хост расширения и подставляется в код (работают вложенные include и относительные пути); `<lygia/…>` берётся из CDN unpkg. HLSL транслируется в GLSL: простой конвертер понимает типы, frac/lerp/saturate/mul и одну функцию `float4 Name(float2 uv : TEXCOORD0) : SV_Target`.',
            ),
            'info',
          ),
        ),
        [
          btn(ctx.pick('Run', 'Запустить'), run, { variant: 'primary', icon: '<path d="M7 4v16l13 -8z"/>' }),
          btn(ctx.pick('Reset current preset', 'Сбросить к пресету'), () => {
            editor.value = PRESET_CODE[activePreset] ?? '';
            void run();
          }, { variant: 'ghost' }),
          iconBtn(
            '<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2"/><path d="M7 11l5 5l5 -5"/><path d="M12 4l0 12"/>',
            ctx.pick('Download shader', 'Скачать шейдер'),
            () => {
              const name = lang === 'hlsl' ? 'shader.hlsl' : 'shader.glsl';
              downloadBlob(name, new Blob([editor.value], { type: 'text/plain;charset=utf-8' }));
            },
            { variant: 'ghost' },
          ),
          iconBtn(
            '<path d="M4 16l6 -6l4 4l6 -6"/><path d="M4 20h16"/>',
            ctx.pick('Download PNG', 'Скачать PNG'),
            exportPng,
            { variant: 'subtle' },
          ),
        ],
        '',
        { collapsible: false },
      );

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          error,
          h('div', { class: 'dt-toolbar' }, langSegment, selectField(ctx.pick('Preset', 'Пресет'), PRESETS.map((preset) => ({
            value: preset.id,
            label: `${ctx.pick(preset.label[0], preset.label[1])} · ${preset.lang.toUpperCase()}`,
          })), 'plasma', (value) => pickPreset(value)), selectField(ctx.pick('Resolution', 'Разрешение'), RESOLUTIONS.map(([width, height]) => ({
            value: `${width}x${height}`,
            label: `${width} × ${height}`,
          })), '960x540', (value) => {
            const [width, height] = value.split('x').map(Number);
            applyResolution(width, height);
          }), h('span', { class: 'dt-grow' }), status),
          includeNote,
          resizableSplit(
            h('div', { class: 'dt-col' }, pane(ctx.pick('Preview', 'Просмотр'), canvas, [], '', { collapsible: false })),
            h('div', { class: 'dt-col' }, codePane),
            {
              ratio: 0.52,
              minSide: 380,
              className: 'dt-shader-split',
              title: ctx.pick('Drag to resize the preview', 'Потяните, чтобы изменить ширину просмотра'),
            },
          ),
        ),
      );

      startedAt = performance.now();
      void run();
      requestAnimationFrame(draw);
    },
  });
}

export const shaderTools = [shaderTool()];
