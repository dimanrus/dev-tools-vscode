/** FFmpeg converter: transcode, remux, trim, resize and extract audio via the local ffmpeg binary. */
import {
  area,
  badge,
  btn,
  checkbox,
  copyBtn,
  errorSlot,
  field,
  note,
  pane,
  rangeField,
  select,
  setError,
  split,
  stats,
  table,
  textInput,
  toolbar,
} from '../components.ts';
import { h } from '../dom.ts';
import { isInVsCode } from '../vscode-api.ts';
import { onHostEvent } from '../rpc.ts';
import {
  buildConvertArgs,
  formatCommand,
  type AudioCodec,
  type Container,
  type ConvertRequest,
  type HardwareAccel,
  type VideoCodec,
} from '../../media-args.ts';
import { defineTool } from '../tool-types.ts';

interface BinaryState {
  path: string;
  available: boolean;
  version: string;
  line: string;
  error?: string;
}

interface MediaInfoResult {
  platform: string;
  arch: string;
  ffmpeg: BinaryState;
  ffprobe: BinaryState;
  ffplay: BinaryState;
}

interface ProbeSummary {
  format: string;
  formatLong: string;
  duration: number;
  size: number;
  bitrate: number;
  streams: Array<{
    index: number;
    type: string;
    codec: string;
    profile: string;
    width: number;
    height: number;
    fps: number;
    bitrate: number;
    sampleRate: number;
    channels: number;
    channelLayout: string;
    pixelFormat: string;
    language: string;
  }>;
}

interface ProbeResult {
  summary: ProbeSummary;
  command: string;
}

interface JobDone {
  jobId: string;
  code: number | null;
  canceled: boolean;
  error: string;
  elapsedMs: number;
  output: string;
  outputSize: number;
  log: string;
}

const CONTAINER_EXTENSION: Record<Container, string> = {
  mp4: 'mp4',
  mkv: 'mkv',
  webm: 'webm',
  mov: 'mov',
  gif: 'gif',
  mp3: 'mp3',
  wav: 'wav',
  flac: 'flac',
  m4a: 'm4a',
  ogg: 'ogg',
};

const INPUT_FILTERS = [
  { name: 'Media', extensions: ['mp4', 'mov', 'webm', 'mkv', 'avi', 'flv', 'ts', 'm4v', 'mpg', 'mpeg', 'mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'gif'] },
  { name: 'All files', extensions: ['*'] },
];

interface PresetValues {
  container: Container;
  videoCodec: VideoCodec;
  audioCodec: AudioCodec;
  crf: number;
  preset: string;
  width: number;
  height: number;
  fps: number;
  fastStart: boolean;
}

const PRESETS: Array<{ id: string; label: { en: string; ru: string }; values: PresetValues | null }> = [
  {
    id: 'mp4',
    label: { en: 'MP4 · H.264 / AAC', ru: 'MP4 · H.264 / AAC' },
    values: { container: 'mp4', videoCodec: 'h264', audioCodec: 'aac', crf: 23, preset: 'medium', width: 0, height: 0, fps: 0, fastStart: true },
  },
  {
    id: 'h265',
    label: { en: 'MP4 · H.265 / AAC (smaller)', ru: 'MP4 · H.265 / AAC (меньше)' },
    values: { container: 'mp4', videoCodec: 'h265', audioCodec: 'aac', crf: 28, preset: 'medium', width: 0, height: 0, fps: 0, fastStart: true },
  },
  {
    id: 'webm',
    label: { en: 'WebM · VP9 / Opus', ru: 'WebM · VP9 / Opus' },
    values: { container: 'webm', videoCodec: 'vp9', audioCodec: 'opus', crf: 32, preset: 'medium', width: 0, height: 0, fps: 0, fastStart: false },
  },
  {
    id: 'remux',
    label: { en: 'MKV · remux (no re-encode)', ru: 'MKV · ремукс (без перекодирования)' },
    values: { container: 'mkv', videoCodec: 'copy', audioCodec: 'copy', crf: 23, preset: 'medium', width: 0, height: 0, fps: 0, fastStart: false },
  },
  {
    id: 'web1080',
    label: { en: 'MP4 · web 1080p', ru: 'MP4 · веб 1080p' },
    values: { container: 'mp4', videoCodec: 'h264', audioCodec: 'aac', crf: 26, preset: 'slow', width: 1920, height: 0, fps: 0, fastStart: true },
  },
  {
    id: 'gif',
    label: { en: 'Animated GIF', ru: 'Анимированный GIF' },
    values: { container: 'gif', videoCodec: 'none', audioCodec: 'none', crf: 23, preset: 'medium', width: 480, height: 0, fps: 12, fastStart: false },
  },
  {
    id: 'mp3',
    label: { en: 'MP3 audio', ru: 'Аудио MP3' },
    values: { container: 'mp3', videoCodec: 'none', audioCodec: 'mp3', crf: 23, preset: 'medium', width: 0, height: 0, fps: 0, fastStart: false },
  },
  {
    id: 'wav',
    label: { en: 'WAV audio', ru: 'Аудио WAV' },
    values: { container: 'wav', videoCodec: 'none', audioCodec: 'pcm', crf: 23, preset: 'medium', width: 0, height: 0, fps: 0, fastStart: false },
  },
];

const VIDEO_CODECS: Array<{ value: VideoCodec; label: string }> = [
  { value: 'copy', label: 'copy' },
  { value: 'h264', label: 'H.264 (libx264)' },
  { value: 'h265', label: 'H.265 (libx265)' },
  { value: 'vp9', label: 'VP9 (libvpx-vp9)' },
  { value: 'av1', label: 'AV1 (libsvtav1)' },
  { value: 'none', label: 'None (drop video)' },
];

const AUDIO_CODECS: Array<{ value: AudioCodec; label: string }> = [
  { value: 'copy', label: 'copy' },
  { value: 'aac', label: 'AAC' },
  { value: 'opus', label: 'Opus' },
  { value: 'mp3', label: 'MP3 (LAME)' },
  { value: 'flac', label: 'FLAC' },
  { value: 'pcm', label: 'PCM 16-bit' },
  { value: 'none', label: 'None (drop audio)' },
];

const CONTAINERS: Array<{ value: Container; label: string }> = [
  { value: 'mp4', label: 'MP4' },
  { value: 'mkv', label: 'MKV' },
  { value: 'webm', label: 'WebM' },
  { value: 'mov', label: 'MOV' },
  { value: 'gif', label: 'GIF' },
  { value: 'mp3', label: 'MP3' },
  { value: 'wav', label: 'WAV' },
  { value: 'flac', label: 'FLAC' },
  { value: 'm4a', label: 'M4A' },
  { value: 'ogg', label: 'OGG' },
];

const HARDWARE: Array<{ value: HardwareAccel; label: string }> = [
  { value: 'none', label: 'Software (CPU)' },
  { value: 'nvenc', label: 'NVIDIA NVENC' },
  { value: 'qsv', label: 'Intel Quick Sync' },
  { value: 'vaapi', label: 'VA-API (Linux)' },
  { value: 'videotoolbox', label: 'VideoToolbox (macOS)' },
];

/** Keeps only the hardware encoders that make sense on the host OS. */
const hardwareForPlatform = (platform: string): Array<{ value: HardwareAccel; label: string }> => {
  if (platform === 'darwin') return HARDWARE.filter((item) => item.value === 'none' || item.value === 'videotoolbox');
  if (platform === 'win32') return HARDWARE.filter((item) => item.value === 'none' || item.value === 'nvenc' || item.value === 'qsv');
  return HARDWARE.filter((item) => item.value !== 'videotoolbox');
};

const ENCODERS = ['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow'];

const formatBytes = (bytes: number): string => {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
};

const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}` : `${minutes}:${String(rest).padStart(2, '0')}`;
};

const formatRate = (bits: number): string => (bits > 0 ? `${(bits / 1_000_000).toFixed(2)} Mb/s` : '—');

const newId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `job-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const setChecked = (wrapper: HTMLElement, checked: boolean): void => {
  const input = wrapper.querySelector('input');
  if (input) input.checked = checked;
};

const markCustom = (presetSelect: HTMLSelectElement): void => {
  presetSelect.value = 'custom';
};

const fitContainer = (request: ConvertRequest): void => {
  if (request.container === 'gif') {
    request.videoCodec = 'none';
    request.audioCodec = 'none';
  }
  if (request.container === 'mp3') {
    request.videoCodec = 'none';
    request.audioCodec = 'mp3';
  }
  if (request.container === 'wav') {
    request.videoCodec = 'none';
    request.audioCodec = 'pcm';
  }
  if (request.container === 'flac') {
    request.videoCodec = 'none';
    request.audioCodec = 'flac';
  }
  if (request.container === 'm4a') {
    request.videoCodec = 'none';
    request.audioCodec = 'aac';
  }
  if (request.container === 'webm') {
    if (request.videoCodec === 'h264' || request.videoCodec === 'h265') request.videoCodec = 'vp9';
    if (request.audioCodec === 'aac' || request.audioCodec === 'mp3' || request.audioCodec === 'pcm') request.audioCodec = 'opus';
  }
  if (request.container === 'ogg') {
    request.videoCodec = 'none';
    if (request.audioCodec === 'aac' || request.audioCodec === 'mp3' || request.audioCodec === 'pcm') request.audioCodec = 'opus';
  }
};

export const ffmpegTools = [
  defineTool({
    id: 'media-ffmpeg-convert',
    group: 'media',
    icon: '<path d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z"/><path d="M8 4l0 16"/><path d="M16 4l0 16"/><path d="M4 8l4 0"/><path d="M4 16l4 0"/><path d="M4 12l16 0"/><path d="M16 8l4 0"/><path d="M16 16l4 0"/>',
    name: { en: 'FFmpeg Converter', ru: 'Конвертер FFmpeg' },
    desc: {
      en: 'Transcode, remux, trim, resize and extract audio with the local ffmpeg binary, with live progress.',
      ru: 'Перекодирование, ремукс, обрезка, изменение размера и извлечение звука локальным ffmpeg с прогрессом.',
    },
    keywords: 'ffmpeg video convert transcode remux mp4 mkv webm gif mp3 extract audio h264 h265 vp9 av1 crf hardware',
    mount(root, ctx) {
      if (!isInVsCode) {
        root.append(note(ctx.t('notice.hostOnly'), 'warn'));
        return;
      }

      const request: ConvertRequest = {
        input: '',
        output: '',
        container: 'mp4',
        videoCodec: 'h264',
        audioCodec: 'aac',
        crf: 23,
        preset: 'medium',
        width: 0,
        height: 0,
        fps: 0,
        start: 0,
        duration: 0,
        hardware: 'none',
        hardwareDevice: '',
        fastStart: true,
        overwrite: true,
        extraArgs: '',
      };

      let ffmpegPath = 'ffmpeg';
      let ffmpegReady = false;
      let running = false;
      let activeJob: string | null = null;
      let sourceDuration = 0;
      let outputTouched = false;

      const infoSlot = h('div', { class: 'dt-media-status' });
      const error = errorSlot();

      const inputPath = textInput({
        placeholder: '/path/to/video.mp4',
        class: 'dt-mono',
        oninput: () => {
          sourceDuration = 0;
          probeSlot.replaceChildren();
          if (!outputTouched) suggestOutput();
          update();
        },
      });
      const outputPath = textInput({
        placeholder: '/path/to/output.mp4',
        class: 'dt-mono',
        oninput: () => {
          outputTouched = true;
          update();
        },
      });
      const probeSlot = h('div');

      const presetSelect = select(
        [
          ...PRESETS.map((preset) => ({ value: preset.id, label: ctx.pick(preset.label.en, preset.label.ru) })),
          { value: 'custom', label: ctx.pick('Custom', 'Свои настройки') },
        ],
        'mp4',
        (value) => applyPreset(value),
      );
      const containerSelect = select(
        CONTAINERS.map((container) => ({ value: container.value, label: container.label })),
        request.container,
        (value) => {
          request.container = value as Container;
          fitContainer(request);
          syncControls();
          suggestOutput();
          markCustom(presetSelect);
          update();
        },
      );
      const videoSelect = select(
        VIDEO_CODECS.map((codec) => ({ value: codec.value, label: codec.label })),
        request.videoCodec,
        (value) => {
          request.videoCodec = value as VideoCodec;
          update();
          markCustom(presetSelect);
        },
      );
      const audioSelect = select(
        AUDIO_CODECS.map((codec) => ({ value: codec.value, label: codec.label })),
        request.audioCodec,
        (value) => {
          request.audioCodec = value as AudioCodec;
          update();
          markCustom(presetSelect);
        },
      );
      const hardwareSelect = select(
        HARDWARE.map((item) => ({ value: item.value, label: item.label })),
        request.hardware,
        (value) => {
          request.hardware = value as HardwareAccel;
          update();
          markCustom(presetSelect);
        },
      );
      const encoderSelect = select(
        ENCODERS.map((item) => ({ value: item, label: item })),
        request.preset,
        (value) => {
          request.preset = value;
          update();
          markCustom(presetSelect);
        },
      );
      const crfRange = rangeField(
        'CRF / quality',
        0,
        51,
        request.crf,
        (value) => {
          request.crf = value;
          update();
          markCustom(presetSelect);
        },
      );
      const widthInput = textInput({
        type: 'number',
        min: 0,
        max: 8192,
        step: 2,
        value: 0,
        oninput: (value) => {
          request.width = Math.max(0, Number(value) || 0);
          update();
          markCustom(presetSelect);
        },
      });
      const heightInput = textInput({
        type: 'number',
        min: 0,
        max: 8192,
        step: 2,
        value: 0,
        oninput: (value) => {
          request.height = Math.max(0, Number(value) || 0);
          update();
          markCustom(presetSelect);
        },
      });
      const fpsInput = textInput({
        type: 'number',
        min: 0,
        max: 240,
        step: 1,
        value: 0,
        oninput: (value) => {
          request.fps = Math.max(0, Number(value) || 0);
          update();
          markCustom(presetSelect);
        },
      });
      const startInput = textInput({
        type: 'number',
        min: 0,
        step: 0.1,
        value: 0,
        oninput: (value) => {
          request.start = Math.max(0, Number(value) || 0);
          update();
        },
      });
      const durationInput = textInput({
        type: 'number',
        min: 0,
        step: 0.1,
        value: 0,
        oninput: (value) => {
          request.duration = Math.max(0, Number(value) || 0);
          update();
        },
      });
      const fastStartBox = checkbox(ctx.pick('MP4 fast start (web streaming)', 'MP4 fast start (для веба)'), true, (checked) => {
        request.fastStart = checked;
        update();
      });
      const overwriteBox = checkbox(ctx.pick('Overwrite output', 'Перезаписывать файл'), true, (checked) => {
        request.overwrite = checked;
        update();
      });
      const extraInput = textInput({
        placeholder: '-metadata title="Demo" -map 0:s?',
        class: 'dt-mono',
        oninput: (value) => {
          request.extraArgs = value;
          update();
        },
      });

      const commandArea = area({ readOnly: true, rows: 6 });
      const runBtn = btn(ctx.pick('Convert', 'Конвертировать'), () => void startJob(), { variant: 'primary', icon: '<path d="M7 4v16l13 -8z"/>' });
      const cancelBtn = btn(ctx.pick('Cancel', 'Отменить'), () => void cancelJob(), { variant: 'danger', disabled: true });
      const revealButton = btn(ctx.pick('Reveal output', 'Показать файл'), () => void revealOutput(), { variant: 'ghost', disabled: true });

      const progressBar = h('div', { class: 'dt-progress' }, h('span'));
      const progressLabel = h('div', { class: 'dt-progress-label' }, ctx.pick('Idle', 'Ожидание'));
      const progressWrap = h('div', { class: 'dt-progress-wrap', hidden: true }, progressBar, progressLabel);
      const runningBadge = badge(ctx.pick('Ready', 'Готово'), 'ok');
      const logArea = area({ readOnly: true, rows: 12, value: '' });

      const setProgress = (percent: number | null, text: string): void => {
        const bar = progressBar.firstElementChild as HTMLElement;
        bar.style.width = percent === null ? '35%' : `${Math.max(0, Math.min(100, percent))}%`;
        progressBar.classList.toggle('is-indeterminate', percent === null);
        progressLabel.textContent = text;
      };

      const suggestOutput = (): void => {
        const input = inputPath.value.trim();
        if (!input) {
          outputPath.value = '';
          return;
        }
        // A network URL has no filesystem extension to derive an output path from.
        if (/^[a-z][a-z0-9+.-]*:\/\//i.test(input)) {
          if (!outputTouched) outputPath.value = '';
          return;
        }
        const extension = CONTAINER_EXTENSION[request.container];
        const base = input.replace(/\.[^./\\]+$/, '');
        outputPath.value = `${base}-converted.${extension}`;
      };

      const syncControls = (): void => {
        containerSelect.value = request.container;
        videoSelect.value = request.videoCodec;
        audioSelect.value = request.audioCodec;
        hardwareSelect.value = request.hardware;
        encoderSelect.value = request.preset;
        widthInput.value = String(request.width);
        heightInput.value = String(request.height);
        fpsInput.value = String(request.fps);
        setChecked(fastStartBox, request.fastStart);
      };

      const applyPreset = (id: string): void => {
        const preset = PRESETS.find((item) => item.id === id);
        if (!preset?.values) {
          update();
          return;
        }
        Object.assign(request, preset.values);
        syncControls();
        const range = crfRange.querySelector('input[type=range]') as HTMLInputElement | null;
        if (range) range.value = String(request.crf);
        const rangeValue = crfRange.querySelector('.dt-range-value');
        if (rangeValue) rangeValue.textContent = String(request.crf);
        suggestOutput();
        update();
      };

      const update = (): void => {
        if (!outputTouched) suggestOutput();
        const args = buildConvertArgs(request);
        commandArea.value = formatCommand(ffmpegPath, args);
        runBtn.disabled = running || !ffmpegReady || !request.input.trim() || !request.output.trim();
        cancelBtn.disabled = !running;
        if (request.container === 'gif') fastStartBox.style.display = 'none';
        else fastStartBox.style.display = '';
      };

      const showInfo = (info: MediaInfoResult): void => {
        ffmpegPath = info.ffmpeg.path || 'ffmpeg';
        ffmpegReady = info.ffmpeg.available;
        const allowedHardware = hardwareForPlatform(info.platform);
        if (!allowedHardware.some((item) => item.value === request.hardware)) request.hardware = 'none';
        hardwareSelect.replaceChildren(...allowedHardware.map((item) => h('option', { value: item.value, text: item.label })));
        hardwareSelect.value = request.hardware;
        const items = [
          h(
            'span',
            { class: 'dt-media-bin' },
            badge(`ffmpeg ${info.ffmpeg.available ? info.ffmpeg.version || 'ok' : 'missing'}`, info.ffmpeg.available ? 'ok' : 'bad'),
            h('code', { class: 'dt-mono' }, info.ffmpeg.path),
          ),
          h(
            'span',
            { class: 'dt-media-bin' },
            badge(`ffprobe ${info.ffprobe.available ? 'ok' : 'missing'}`, info.ffprobe.available ? 'ok' : 'neutral'),
          ),
        ];
        infoSlot.replaceChildren(...items);
        if (ffmpegReady) {
          error.replaceChildren();
        } else {
          setError(
            error,
            ctx.pick(
              'ffmpeg was not found. Install it (apt install ffmpeg, brew install ffmpeg, winget install Gyan.FFmpeg) or set devTools.ffmpegPath.',
              'ffmpeg не найден. Установите его (apt install ffmpeg, brew install ffmpeg, winget install Gyan.FFmpeg) или задайте devTools.ffmpegPath.',
            ),
          );
        }
        update();
      };

      const refreshInfo = async (): Promise<void> => {
        infoSlot.replaceChildren(badge(ctx.pick('Checking…', 'Проверка…'), 'neutral'));
        try {
          showInfo(await ctx.rpc<MediaInfoResult>('mediaInfo'));
        } catch (cause) {
          infoSlot.replaceChildren();
          setError(error, cause instanceof Error ? cause.message : String(cause));
        }
      };

      const renderProbe = (result: ProbeResult): void => {
        const summary = result.summary;
        sourceDuration = summary.duration;
        const rows = summary.streams.map((stream) => {
          const isVideo = stream.type === 'video';
          const details = isVideo
            ? `${stream.width || '?'}×${stream.height || '?'} · ${stream.fps ? `${stream.fps.toFixed(2)} fps` : '—'} · ${formatRate(stream.bitrate)}`
            : `${stream.sampleRate ? `${stream.sampleRate} Hz` : '—'} · ${stream.channels || '?'} ch${stream.channelLayout ? ` (${stream.channelLayout})` : ''}`;
          return [
            String(stream.index),
            stream.type,
            h('span', {}, stream.codec, stream.profile ? h('span', { class: 'dt-hint' }, ` · ${stream.profile}`) : null),
            details,
            stream.language || '—',
          ];
        });
        probeSlot.replaceChildren(
          stats([
            [ctx.pick('Container', 'Контейнер'), summary.format || '—'],
            [ctx.pick('Duration', 'Длительность'), formatDuration(summary.duration)],
            [ctx.pick('Size', 'Размер'), formatBytes(summary.size)],
            [ctx.pick('Bitrate', 'Битрейт'), formatRate(summary.bitrate)],
          ]),
          rows.length
            ? table([ctx.pick('#', '#'), ctx.pick('Type', 'Тип'), ctx.pick('Codec', 'Кодек'), ctx.pick('Details', 'Детали'), ctx.pick('Lang', 'Язык')], rows)
            : note(ctx.pick('No streams reported.', 'Потоки не найдены.'), 'warn'),
          h('details', { class: 'dt-media-cmd' }, h('summary', {}, ctx.pick('ffprobe command', 'Команда ffprobe')), h('code', { class: 'dt-mono' }, result.command)),
        );
      };

      const probeSource = async (): Promise<void> => {
        const target = inputPath.value.trim();
        if (!target) {
          setError(error, ctx.pick('Choose an input file first.', 'Сначала выберите входной файл.'));
          return;
        }
        setError(error, null);
        probeSlot.replaceChildren(note(ctx.pick('Probing…', 'Анализ…'), 'info'));
        try {
          renderProbe(await ctx.rpc<ProbeResult>('mediaProbe', { target, timeoutMs: 20_000 }));
        } catch (cause) {
          probeSlot.replaceChildren();
          setError(error, cause instanceof Error ? cause.message : String(cause));
        }
      };

      const chooseInput = async (): Promise<void> => {
        try {
          const picked = await ctx.rpc<string | null>('mediaPick', {
            filters: INPUT_FILTERS,
            defaultPath: inputPath.value.trim() || undefined,
          });
          if (!picked) return;
          inputPath.value = picked;
          sourceDuration = 0;
          suggestOutput();
          update();
          void probeSource();
        } catch (cause) {
          setError(error, cause instanceof Error ? cause.message : String(cause));
        }
      };

      const chooseOutput = async (): Promise<void> => {
        const extension = CONTAINER_EXTENSION[request.container];
        try {
          const picked = await ctx.rpc<string | null>('mediaSave', {
            defaultPath: outputPath.value.trim() || undefined,
            filters: [
              { name: extension.toUpperCase(), extensions: [extension] },
              { name: ctx.pick('All files', 'Все файлы'), extensions: ['*'] },
            ],
          });
          if (!picked) return;
          outputPath.value = picked;
          outputTouched = true;
          update();
        } catch (cause) {
          setError(error, cause instanceof Error ? cause.message : String(cause));
        }
      };

      const startJob = async (): Promise<void> => {
        if (running) return;
        setError(error, null);
        logArea.value = '';
        request.input = inputPath.value.trim();
        request.output = outputPath.value.trim();
        if (!request.input || !request.output) {
          setError(error, ctx.pick('Pick both input and output files.', 'Укажите входной и выходной файлы.'));
          return;
        }
        const jobId = newId();
        activeJob = jobId;
        running = true;
        progressWrap.hidden = false;
        runningBadge.textContent = ctx.pick('Converting…', 'Конвертация…');
        runningBadge.className = 'dt-badge dt-badge-warn';
        revealButton.disabled = true;
        setProgress(0, ctx.pick('Starting ffmpeg…', 'Запуск ffmpeg…'));
        update();

        const unsubscribe = onHostEvent((event, payload) => {
          if (payload.jobId !== jobId) return;
          if (!root.isConnected) {
            unsubscribe();
            return;
          }
          if (event === 'media-progress') {
            const percent = typeof payload.percent === 'number' ? payload.percent : null;
            const speed = String(payload.speed ?? '');
            const size = Number(payload.totalSize ?? 0);
            setProgress(
              percent,
              `${percent === null ? ctx.pick('working…', 'обработка…') : `${percent.toFixed(1)}%`}${speed ? ` · ${speed}` : ''}${size ? ` · ${formatBytes(size)}` : ''}`,
            );
          } else if (event === 'media-log') {
            const lines = Array.isArray(payload.lines) ? (payload.lines as string[]) : [];
            if (lines.length) {
              logArea.value = `${logArea.value}${logArea.value ? '\n' : ''}${lines.join('\n')}`.slice(-24_000);
              logArea.scrollTop = logArea.scrollHeight;
            }
          } else if (event === 'media-job-done') {
            const done = payload as unknown as JobDone;
            unsubscribe();
            running = false;
            activeJob = null;
            setProgress(done.canceled ? null : 100, done.canceled ? ctx.pick('Cancelled', 'Отменено') : `${(done.elapsedMs / 1000).toFixed(1)} s`);
            progressBar.classList.remove('is-indeterminate');
            if (done.log) {
              logArea.value = done.log;
              logArea.scrollTop = logArea.scrollHeight;
            }
            if (done.canceled) {
              runningBadge.textContent = ctx.pick('Cancelled', 'Отменено');
              runningBadge.className = 'dt-badge dt-badge-warn';
            } else if (done.error || done.code !== 0 || !done.outputSize) {
              runningBadge.textContent = ctx.pick('Failed', 'Ошибка');
              runningBadge.className = 'dt-badge dt-badge-bad';
              setError(error, done.error || ctx.pick(`ffmpeg exited with code ${done.code}. See the log below.`, `ffmpeg завершился с кодом ${done.code}. Смотрите журнал ниже.`));
            } else {
              runningBadge.textContent = ctx.pick('Done', 'Готово');
              runningBadge.className = 'dt-badge dt-badge-ok';
              setProgress(100, `${ctx.pick('Saved', 'Сохранено')} · ${formatBytes(done.outputSize)}`);
              revealButton.disabled = false;
              probeSlot.replaceChildren();
              void probeSource();
            }
            update();
          }
        });

        try {
          const progressDuration =
            request.duration > 0 ? request.duration : Math.max(0, sourceDuration - request.start);
          await ctx.rpc('mediaRun', { jobId, request, duration: progressDuration });
          progressWrap.hidden = false;
        } catch (cause) {
          unsubscribe();
          running = false;
          activeJob = null;
          runningBadge.textContent = ctx.pick('Failed', 'Ошибка');
          runningBadge.className = 'dt-badge dt-badge-bad';
          progressWrap.hidden = true;
          setError(error, cause instanceof Error ? cause.message : String(cause));
          update();
        }
      };

      const cancelJob = async (): Promise<void> => {
        if (!activeJob) return;
        setProgress(null, ctx.pick('Stopping…', 'Остановка…'));
        try {
          await ctx.rpc('mediaCancel', { jobId: activeJob });
        } catch (cause) {
          setError(error, cause instanceof Error ? cause.message : String(cause));
        }
      };

      const revealOutput = async (): Promise<void> => {
        try {
          await ctx.rpc('mediaReveal', { path: outputPath.value.trim() });
        } catch (cause) {
          setError(error, cause instanceof Error ? cause.message : String(cause));
        }
      };

      const inputPane = pane(
        ctx.pick('Source', 'Источник'),
        h(
          'div',
          { class: 'dt-stack' },
          h(
            'div',
            { class: 'dt-inline-form' },
            field(ctx.pick('Input file', 'Входной файл'), inputPath),
            h('div', { class: 'dt-inline-actions' }, btn(ctx.pick('Choose…', 'Выбрать…'), () => void chooseInput()), btn(ctx.pick('Probe', 'Анализ'), () => void probeSource(), { variant: 'ghost' })),
          ),
          probeSlot,
        ),
        [],
        '',
        { collapsible: true },
      );

      const outputPane = pane(
        ctx.pick('Output', 'Результат'),
        h(
          'div',
          { class: 'dt-stack' },
          h(
            'div',
            { class: 'dt-inline-form' },
            field(ctx.pick('Output file', 'Выходной файл'), outputPath),
            h('div', { class: 'dt-inline-actions' }, btn(ctx.pick('Save as…', 'Сохранить как…'), () => void chooseOutput())),
          ),
          toolbar(runBtn, cancelBtn, revealButton, runningBadge),
          progressWrap,
          pane(ctx.pick('ffmpeg command', 'Команда ffmpeg'), commandArea, [copyBtn(() => commandArea.value)], 'dt-media-cmd-pane', { collapsible: true, defaultCollapsed: true }),
          pane(ctx.pick('Log', 'Журнал'), logArea, [copyBtn(() => logArea.value)], '', { collapsible: true, defaultCollapsed: true }),
        ),
      );

      const optionsPane = pane(
        ctx.pick('Encoding options', 'Параметры кодирования'),
        h(
          'div',
          { class: 'dt-stack' },
          h('div', { class: 'dt-grid-2' }, field(ctx.pick('Preset', 'Пресет'), presetSelect), field(ctx.pick('Container', 'Контейнер'), containerSelect)),
          h('div', { class: 'dt-grid-2' }, field(ctx.pick('Video codec', 'Видеокодек'), videoSelect), field(ctx.pick('Audio codec', 'Аудиокодек'), audioSelect)),
          h('div', { class: 'dt-grid-2' }, field(ctx.pick('Hardware acceleration', 'Аппаратное ускорение'), hardwareSelect, ctx.pick('Availability depends on the OS, GPU and ffmpeg build.', 'Доступность зависит от ОС, GPU и сборки ffmpeg.')), field(ctx.pick('x264/x265 speed', 'Скорость x264/x265'), encoderSelect)),
          h('div', { class: 'dt-grid-3' }, crfRange, field(ctx.pick('Width (0 = auto)', 'Ширина (0 = авто)'), widthInput), field(ctx.pick('Height (0 = auto)', 'Высота (0 = авто)'), heightInput)),
          h('div', { class: 'dt-grid-3' }, field(ctx.pick('FPS (0 = source)', 'FPS (0 = как в исходнике)'), fpsInput), field(ctx.pick('Trim from, s', 'Обрезка с, с'), startInput), field(ctx.pick('Duration, s (0 = all)', 'Длительность, с (0 = всё)'), durationInput)),
          h('div', { class: 'dt-inline-form' }, fastStartBox, overwriteBox),
          field(ctx.pick('Extra arguments', 'Дополнительные аргументы'), extraInput, ctx.pick('Appended right before the output path.', 'Добавляются прямо перед выходным файлом.')),
          note(
            ctx.pick(
              'Stream copy ignores filters (scale, FPS). Use a real codec if you need them.',
              'Копирование потока игнорирует фильтры (масштаб, FPS). Для них нужен реальный кодек.',
            ),
            'info',
          ),
        ),
      );

      const infoPane = pane(
        ctx.pick('Binaries', 'Исполняемые файлы'),
        h(
          'div',
          { class: 'dt-stack' },
          h('div', { class: 'dt-media-status-row' }, infoSlot, btn(ctx.pick('Refresh', 'Обновить'), () => void refreshInfo(), { variant: 'ghost', class: 'dt-btn-compact' })),
          note(
            ctx.pick(
              'Paths can be changed in Settings → Dev Tools → FFmpeg / ffprobe / ffplay path.',
              'Пути можно изменить в Настройках → Dev Tools → FFmpeg / ffprobe / ffplay path.',
            ),
            'info',
          ),
        ),
        [],
        '',
        { collapsible: true, defaultCollapsed: true },
      );

      root.append(error, split(h('div', { class: 'dt-stack' }, inputPane, optionsPane, infoPane), h('div', { class: 'dt-stack' }, outputPane)));

      const incoming = ctx.takeIncoming();
      if (incoming) {
        const apply = (filePath: string): void => {
          inputPath.value = filePath;
          sourceDuration = 0;
          suggestOutput();
          update();
          void probeSource();
        };
        if (incoming.path) apply(incoming.path);
        else {
          void (async () => {
            try {
              const staged = await ctx.rpc<{ path: string }>('mediaStage', { name: incoming.name, dataUrl: incoming.dataUrl });
              apply(staged.path);
            } catch (cause) {
              setError(error, cause instanceof Error ? cause.message : String(cause));
            }
          })();
        }
      }

      void refreshInfo();
      update();
    },
  }),
];
