/** Stream viewer: probe and play RTSP, RTMP, HLS, DASH, SRT, MPEG-TS and HTTP sources with ffprobe/ffplay/ffmpeg. */
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
  buildPlayArgs,
  buildSnapshotArgs,
  detectProtocol,
  formatCommand,
  STREAM_PROTOCOLS,
  type PlayRequest,
  type ProtocolId,
  type RtspTransport,
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

interface SnapshotResult {
  dataUrl: string;
  bytes: number;
  command: string;
}

const formatBytes = (bytes: number): string => {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
};

const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'live / unknown';
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
    : `play-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const streamViewerTools = [
  defineTool({
    id: 'media-stream-viewer',
    group: 'media',
    icon: '<path d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z"/><path d="M10 9l5 3l-5 3z"/><path d="M7 4v2"/><path d="M17 4v2"/><path d="M7 18v2"/><path d="M17 18v2"/>',
    name: { en: 'Stream Viewer', ru: 'Просмотр потоков' },
    desc: {
      en: 'Probe and play RTSP, RTMP, HLS, DASH, SRT, MPEG-TS and HTTP streams with ffprobe and ffplay.',
      ru: 'Анализ и воспроизведение потоков RTSP, RTMP, HLS, DASH, SRT, MPEG-TS и HTTP через ffprobe и ffplay.',
    },
    keywords: 'ffplay ffprobe stream rtsp rtmp hls m3u8 dash mpd srt udp tcp mpegts iptv camera ip camera rtsp player live',
    mount(root, ctx) {
      if (!isInVsCode) {
        root.append(note(ctx.t('notice.hostOnly'), 'warn'));
        return;
      }

      const playRequest: PlayRequest = {
        url: '',
        rtspTransport: 'auto',
        headers: '',
        userAgent: '',
        referer: '',
        lowLatency: false,
        fullscreen: false,
        mute: false,
        volume: 100,
        loop: false,
        windowTitle: '',
        extraArgs: '',
      };

      let ffplayPath = 'ffplay';
      let ffmpegPath = 'ffmpeg';
      let ffplayReady = false;
      let ffmpegReady = false;
      let ffprobeReady = false;
      let playing = false;
      let activePlay: string | null = null;
      let manualProtocol: ProtocolId | 'auto' = 'auto';
      let probeSequence = 0;
      let probeTimer: number | undefined;

      const error = errorSlot();
      const probeError = errorSlot();
      const infoSlot = h('div', { class: 'dt-media-status' });
      const urlInput = textInput({
        placeholder: 'rtsp://…, https://…/index.m3u8, udp://@239.0.0.1:1234',
        class: 'dt-mono',
        oninput: () => {
          if (probeTimer !== undefined) {
            window.clearTimeout(probeTimer);
            probeTimer = undefined;
          }
          if (activePlay) void stopPlay();
          syncProtocol();
          probeSlot.replaceChildren();
          scheduleProbe();
          update();
        },
      });
      const protocolBadge = badge('auto', 'neutral');
      const protocolSelect = select(
        [
          { value: 'auto', label: ctx.pick('Auto-detect', 'Автоопределение') },
          ...STREAM_PROTOCOLS.map((protocol) => ({ value: protocol.id, label: ctx.pick(protocol.label.en, protocol.label.ru) })),
        ],
        'auto',
        (value) => {
          manualProtocol = value as ProtocolId | 'auto';
          const example = STREAM_PROTOCOLS.find((protocol) => protocol.id === manualProtocol);
          if (example && !urlInput.value.trim()) {
            urlInput.value = example.example;
            scheduleProbe();
          }
          if (manualProtocol === 'rtsp' && playRequest.rtspTransport === 'auto') {
            playRequest.rtspTransport = 'tcp';
            transportSelect.value = 'tcp';
          }
          update();
        },
      );
      const transportSelect = select(
        [
          { value: 'auto', label: ctx.pick('Auto', 'Авто') },
          { value: 'tcp', label: 'TCP (RTSP)' },
          { value: 'udp', label: 'UDP (RTSP)' },
          { value: 'http', label: 'HTTP tunnel (RTSP)' },
        ],
        playRequest.rtspTransport ?? 'auto',
        (value) => {
          playRequest.rtspTransport = value as RtspTransport;
          update();
        },
      );

      /** Mirrors the URL scheme into the protocol selector as the user types or pastes. */
      const syncProtocol = (): void => {
        const value = urlInput.value.trim();
        if (!value) {
          manualProtocol = 'auto';
          protocolSelect.value = 'auto';
          return;
        }
        const looksLikeTarget =
          /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ||
          value.startsWith('/') ||
          /^[a-zA-Z]:[\\/]/.test(value) ||
          /\.(m3u8|mpd|mp4|mkv|mov|webm|ts|avi|mp3|wav)(?:[?#]|$)/i.test(value);
        if (!looksLikeTarget) return;
        const detected = detectProtocol(value);
        manualProtocol = detected;
        if (protocolSelect.value !== detected) protocolSelect.value = detected;
        if (detected === 'rtsp' && playRequest.rtspTransport === 'auto') {
          playRequest.rtspTransport = 'tcp';
          transportSelect.value = 'tcp';
        }
      };

      /** Probes a pasted network URL after the user stops typing. */
      const scheduleProbe = (): void => {
        if (probeTimer !== undefined) {
          window.clearTimeout(probeTimer);
          probeTimer = undefined;
        }
        if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(urlInput.value.trim())) return;
        probeTimer = window.setTimeout(() => {
          probeTimer = undefined;
          void probeStream();
        }, 1_200);
      };
      const lowLatencyBox = checkbox(ctx.pick('Low latency (nobuffer, framedrop)', 'Низкая задержка (nobuffer, framedrop)'), false, (checked) => {
        playRequest.lowLatency = checked;
        update();
      });
      const fullscreenBox = checkbox(ctx.pick('Fullscreen window', 'Полноэкранное окно'), false, (checked) => {
        playRequest.fullscreen = checked;
        update();
      });
      const muteBox = checkbox(ctx.pick('Mute audio', 'Без звука'), false, (checked) => {
        playRequest.mute = checked;
        update();
      });
      const loopBox = checkbox(ctx.pick('Loop (files)', 'Повтор (для файлов)'), false, (checked) => {
        playRequest.loop = checked;
        update();
      });
      const volumeRange = rangeField(
        ctx.pick('Volume', 'Громкость'),
        0,
        100,
        playRequest.volume,
        (value) => {
          playRequest.volume = value;
          update();
        },
      );
      const windowInput = textInput({
        placeholder: ctx.pick('Stream Viewer', 'Просмотр потока'),
        oninput: (value) => {
          playRequest.windowTitle = value;
          update();
        },
      });
      const headersInput = area({
        rows: 3,
        placeholder: 'Authorization: Bearer …\nCookie: session=…\nOrigin: https://example.com',
        oninput: (value) => {
          playRequest.headers = value;
          update();
        },
      });
      const userAgentInput = textInput({
        class: 'dt-mono',
        placeholder: 'VLC/3.0.20 LibVLC/3.0.20',
        oninput: (value) => {
          playRequest.userAgent = value;
          update();
        },
      });
      const refererInput = textInput({
        class: 'dt-mono',
        placeholder: 'https://example.com/',
        oninput: (value) => {
          playRequest.referer = value;
          update();
        },
      });
      const extraInput = textInput({
        class: 'dt-mono',
        placeholder: '-vf transpose=1 -sync ext',
        oninput: (value) => {
          playRequest.extraArgs = value;
          update();
        },
      });
      const snapshotAtInput = textInput({
        type: 'number',
        min: 0,
        step: 0.5,
        value: 0,
        oninput: () => update(),
      });
      const snapshotWidthInput = textInput({
        type: 'number',
        min: 0,
        max: 4096,
        step: 2,
        value: 1280,
        oninput: () => update(),
      });

      const preview = h('img', { class: 'dt-media-preview', alt: ctx.pick('Stream frame', 'Кадр потока') });
      const previewSlot = h('div', { class: 'dt-media-preview-slot' }, h('span', { class: 'dt-hint' }, ctx.pick('Capture a frame to preview the stream without opening a window.', 'Сделайте снимок кадра, чтобы посмотреть поток без отдельного окна.')));
      const probeSlot = h('div');
      const logArea = area({ readOnly: true, rows: 8 });
      const commandArea = area({ readOnly: true, rows: 5 });
      const snapshotCommand = h('code', { class: 'dt-mono dt-hint' });

      const playBtn = btn(ctx.pick('Watch', 'Смотреть'), () => void startPlay(), {
        variant: 'primary',
        icon: '<path d="M7 4v16l13 -8z"/>',
      });
      const stopBtn = btn(ctx.pick('Stop player', 'Остановить'), () => void stopPlay(), { variant: 'danger', disabled: true });
      const probeBtn = btn(ctx.pick('Probe streams', 'Анализ потоков'), () => void probeStream(), { variant: 'ghost' });
      const snapshotBtn = btn(ctx.pick('Capture frame', 'Снимок кадра'), () => void captureFrame(), { variant: 'ghost' });
      const chooseFileBtn = btn(ctx.pick('Local file…', 'Локальный файл…'), () => void chooseLocalFile(), { variant: 'ghost' });
      const playBadge = badge(ctx.pick('Idle', 'Ожидание'), 'neutral');

      const currentUrl = (): string => urlInput.value.trim();

      const networkParams = (): Record<string, unknown> => ({
        rtspTransport: playRequest.rtspTransport,
        headers: playRequest.headers,
        userAgent: playRequest.userAgent,
        referer: playRequest.referer,
      });

      const update = (): void => {
        const url = currentUrl();
        const detected = detectProtocol(url || '');
        const effective = manualProtocol === 'auto' ? detected : manualProtocol;
        const protocolInfo = STREAM_PROTOCOLS.find((protocol) => protocol.id === effective);
        protocolBadge.textContent = url && protocolInfo ? ctx.pick(protocolInfo.label.en, protocolInfo.label.ru) : 'auto';
        commandArea.value = formatCommand(ffplayPath, buildPlayArgs({ ...playRequest, url }));
        snapshotCommand.textContent = formatCommand(ffmpegPath, buildSnapshotArgs({
          ...networkParams(),
          target: url,
          at: Math.max(0, Number(snapshotAtInput.value) || 0),
          width: Math.max(0, Number(snapshotWidthInput.value) || 0),
        }));
        playBtn.disabled = playing || !ffplayReady || !url;
        stopBtn.disabled = !playing;
        probeBtn.disabled = !ffprobeReady || !url;
        snapshotBtn.disabled = !ffmpegReady || !url;
      };

      const showInfo = (info: MediaInfoResult): void => {
        ffplayPath = info.ffplay.path || 'ffplay';
        ffmpegPath = info.ffmpeg.path || 'ffmpeg';
        ffplayReady = info.ffplay.available;
        ffmpegReady = info.ffmpeg.available;
        ffprobeReady = info.ffprobe.available;
        infoSlot.replaceChildren(
          badge(`ffplay ${info.ffplay.available ? info.ffplay.version || 'ok' : 'missing'}`, info.ffplay.available ? 'ok' : 'bad'),
          badge(`ffprobe ${info.ffprobe.available ? 'ok' : 'missing'}`, info.ffprobe.available ? 'ok' : 'neutral'),
          badge(`ffmpeg ${info.ffmpeg.available ? 'ok' : 'missing'}`, info.ffmpeg.available ? 'ok' : 'neutral'),
        );
        if (!ffplayReady) {
          setError(
            error,
            ctx.pick(
              'ffplay was not found. Install the full FFmpeg package (it ships ffplay) or set devTools.ffplayPath. Frame capture and probing still work with ffmpeg/ffprobe.',
              'ffplay не найден. Установите полный пакет FFmpeg (в нём есть ffplay) или задайте devTools.ffplayPath. Снимок кадра и анализ работают через ffmpeg/ffprobe.',
            ),
          );
        } else if (!error.textContent) {
          setError(error, null);
        }
        update();
      };

      const refreshInfo = async (): Promise<void> => {
        try {
          showInfo(await ctx.rpc<MediaInfoResult>('mediaInfo'));
        } catch (cause) {
          setError(error, cause instanceof Error ? cause.message : String(cause));
        }
      };

      const renderProbe = (result: ProbeResult): void => {
        const summary = result.summary;
        const rows = summary.streams.map((stream) => {
          const details =
            stream.type === 'video'
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
            [ctx.pick('Bitrate', 'Битрейт'), formatRate(summary.bitrate)],
            [ctx.pick('Streams', 'Потоков'), summary.streams.length],
          ]),
          rows.length
            ? table([ctx.pick('#', '#'), ctx.pick('Type', 'Тип'), ctx.pick('Codec', 'Кодек'), ctx.pick('Details', 'Детали'), ctx.pick('Lang', 'Язык')], rows)
            : note(ctx.pick('No streams reported.', 'Потоки не найдены.'), 'warn'),
          h('details', { class: 'dt-media-cmd' }, h('summary', {}, ctx.pick('ffprobe command', 'Команда ffprobe')), h('code', { class: 'dt-mono' }, result.command)),
        );
      };

      const probeStream = async (): Promise<void> => {
        const target = currentUrl();
        if (!target || !root.isConnected) return;
        const sequence = ++probeSequence;
        setError(probeError, null);
        probeSlot.replaceChildren(note(ctx.pick('Probing…', 'Анализ…'), 'info'));
        try {
          const result = await ctx.rpc<ProbeResult>('mediaProbe', { target, ...networkParams(), timeoutMs: 25_000 });
          if (sequence !== probeSequence || !root.isConnected) return;
          renderProbe(result);
        } catch (cause) {
          if (sequence !== probeSequence) return;
          probeSlot.replaceChildren();
          setError(probeError, cause instanceof Error ? cause.message : String(cause));
        }
      };

      const captureFrame = async (): Promise<void> => {
        const target = currentUrl();
        if (!target) return;
        setError(probeError, null);
        snapshotBtn.disabled = true;
        previewSlot.replaceChildren(note(ctx.pick('Capturing a frame…', 'Захват кадра…'), 'info'));
        try {
          const result = await ctx.rpc<SnapshotResult>('mediaSnapshot', {
            target,
            ...networkParams(),
            at: Math.max(0, Number(snapshotAtInput.value) || 0),
            width: Math.max(0, Number(snapshotWidthInput.value) || 0),
            timeoutMs: 30_000,
          });
          preview.src = result.dataUrl;
          snapshotCommand.textContent = result.command;
          previewSlot.replaceChildren(
            preview,
            h('div', { class: 'dt-media-preview-meta' }, badge(`${formatBytes(result.bytes)} PNG`, 'ok'), copyBtn(() => result.dataUrl, ctx.pick('Copy data URL', 'Копировать data URL'))),
          );
        } catch (cause) {
          previewSlot.replaceChildren();
          setError(probeError, cause instanceof Error ? cause.message : String(cause));
        } finally {
          snapshotBtn.disabled = false;
          update();
        }
      };

      const startPlay = async (): Promise<void> => {
        const url = currentUrl();
        if (!url || playing) return;
        if (!ffplayReady) {
          setError(
            error,
            ctx.pick(
              'ffplay was not found. Install the full FFmpeg package or set devTools.ffplayPath. Frame capture and probing still work with ffmpeg/ffprobe.',
              'ffplay не найден. Установите полный пакет FFmpeg или задайте devTools.ffplayPath. Снимок кадра и анализ работают через ffmpeg/ffprobe.',
            ),
          );
          return;
        }
        if (probeTimer !== undefined) {
          window.clearTimeout(probeTimer);
          probeTimer = undefined;
        }
        setError(error, null);
        logArea.value = '';
        const playId = newId();
        activePlay = playId;
        playing = true;
        playBadge.textContent = ctx.pick('Starting…', 'Запуск…');
        playBadge.className = 'dt-badge dt-badge-warn';
        update();

        const unsubscribe = onHostEvent((event, payload) => {
          if (payload.playId !== playId) return;
          if (!root.isConnected || activePlay !== playId) {
            unsubscribe();
            return;
          }
          if (event === 'media-play-log') {
            logArea.value = `${logArea.value}${logArea.value ? '\n' : ''}${String(payload.line ?? '')}`.slice(-16_000);
            logArea.scrollTop = logArea.scrollHeight;
          } else if (event === 'media-play-done') {
            unsubscribe();
            playing = false;
            activePlay = null;
            const code = payload.code as number | null;
            const failure = String(payload.error ?? '');
            if (failure || (code !== 0 && code !== null)) {
              playBadge.textContent = ctx.pick('Player stopped', 'Плеер остановлен');
              playBadge.className = 'dt-badge dt-badge-bad';
              if (failure) setError(error, failure);
            } else {
              playBadge.textContent = ctx.pick('Finished', 'Завершено');
              playBadge.className = 'dt-badge dt-badge-ok';
            }
            update();
          }
        });

        try {
          const result = await ctx.rpc<{ playId: string; pid: number | null }>('mediaPlay', {
            playId,
            request: { ...playRequest, url },
          });
          if (activePlay === playId) {
            playBadge.textContent = `ffplay · PID ${result.pid ?? '?'}`;
            playBadge.className = 'dt-badge dt-badge-ok';
          }
        } catch (cause) {
          unsubscribe();
          if (activePlay !== playId) {
            update();
            return;
          }
          playing = false;
          activePlay = null;
          playBadge.textContent = ctx.pick('Failed', 'Ошибка');
          playBadge.className = 'dt-badge dt-badge-bad';
          setError(error, cause instanceof Error ? cause.message : String(cause));
        }
        update();
      };

      const stopPlay = async (): Promise<void> => {
        const playId = activePlay;
        if (!playId) return;
        activePlay = null;
        playing = false;
        playBadge.textContent = ctx.pick('Stopped', 'Остановлено');
        playBadge.className = 'dt-badge dt-badge-neutral';
        update();
        try {
          await ctx.rpc('mediaStop', { playId });
        } catch (cause) {
          setError(error, cause instanceof Error ? cause.message : String(cause));
        }
      };

      const chooseLocalFile = async (): Promise<void> => {
        try {
          const picked = await ctx.rpc<string | null>('mediaPick', {
            filters: [{ name: ctx.pick('Media', 'Медиа'), extensions: ['mp4', 'mkv', 'mov', 'webm', 'ts', 'm3u8', 'mpd'] }, { name: ctx.pick('All files', 'Все файлы'), extensions: ['*'] }],
            defaultPath: currentUrl() || undefined,
          });
          if (!picked) return;
          urlInput.value = picked;
          manualProtocol = 'file';
          protocolSelect.value = 'file';
          update();
          void probeStream();
        } catch (cause) {
          setError(error, cause instanceof Error ? cause.message : String(cause));
        }
      };

      let advancedOpen = false;
      const advancedLabel = (open: boolean): string =>
        ctx.pick(open ? 'Hide settings' : 'More settings', open ? 'Скрыть настройки' : 'Дополнительно');
      const advancedSection = h(
        'div',
        { class: 'dt-stack', hidden: true },
        h(
          'div',
          { class: 'dt-chips' },
          ...STREAM_PROTOCOLS.filter((protocol) => ['rtsp', 'rtmp', 'hls', 'dash', 'udp', 'http'].includes(protocol.id)).map((protocol) =>
            btn(protocol.label.en, () => {
              urlInput.value = protocol.example;
              manualProtocol = protocol.id;
              protocolSelect.value = protocol.id;
              if (protocol.id === 'rtsp' && playRequest.rtspTransport === 'auto') {
                playRequest.rtspTransport = 'tcp';
                transportSelect.value = 'tcp';
              }
              probeSlot.replaceChildren();
              update();
              void probeStream();
            }, { variant: 'subtle', class: 'dt-chip' }),
          ),
        ),
        h(
          'div',
          { class: 'dt-grid-2' },
          field(ctx.pick('Protocol', 'Протокол'), protocolSelect),
          field(ctx.pick('RTSP transport', 'Транспорт RTSP'), transportSelect, ctx.pick('Only used for rtsp:// URLs.', 'Используется только для rtsp:// URL.')),
        ),
        h('div', { class: 'dt-grid-2' }, field(ctx.pick('User-Agent', 'User-Agent'), userAgentInput), field(ctx.pick('Referer', 'Referer'), refererInput)),
        field(ctx.pick('HTTP headers', 'HTTP-заголовки'), headersInput, ctx.pick('One header per line; sent as CRLF.', 'По одному заголовку в строке; отправляются через CRLF.')),
        field(ctx.pick('Extra ffplay arguments', 'Доп. аргументы ffplay'), extraInput),
      );
      const advancedBtn = btn(advancedLabel(false), () => {
        advancedOpen = !advancedOpen;
        advancedSection.hidden = !advancedOpen;
        advancedBtn.setAttribute('aria-expanded', String(advancedOpen));
        const labelNode = advancedBtn.querySelector('.dt-btn-label');
        if (labelNode) labelNode.textContent = advancedLabel(advancedOpen);
      }, { variant: 'ghost', class: 'dt-btn-compact', icon: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>' });
      advancedBtn.setAttribute('aria-expanded', 'false');

      const sourcePane = pane(
        ctx.pick('Stream source', 'Источник потока'),
        h(
          'div',
          { class: 'dt-stack' },
          h(
            'div',
            { class: 'dt-inline-form' },
            field(
              ctx.pick('URL or file path', 'URL или путь к файлу'),
              urlInput,
              ctx.pick(
                'Paste a link and press Enter to watch. ffplay opens a separate window; Capture frame shows a still here.',
                'Вставьте ссылку и нажмите Enter, чтобы смотреть. ffplay открывает отдельное окно; «Снимок кадра» покажет стоп-кадр здесь.',
              ),
            ),
            h('div', { class: 'dt-inline-actions' }, playBtn, stopBtn),
          ),
          h('div', { class: 'dt-media-status-row' }, protocolBadge, playBadge, chooseFileBtn, advancedBtn),
          advancedSection,
        ),
      );

      const controlsPane = pane(
        ctx.pick('Player options', 'Параметры плеера'),
        h(
          'div',
          { class: 'dt-stack' },
          h('div', { class: 'dt-inline-form' }, lowLatencyBox, fullscreenBox, muteBox, loopBox),
          h('div', { class: 'dt-grid-2' }, volumeRange, field(ctx.pick('Window title', 'Заголовок окна'), windowInput)),
          note(
            ctx.pick(
              'Low-latency flags help live RTSP/RTP/SRT/UDP sources but can break HLS/DASH startup, so they are off by default. Enable them only for low-latency live streams.',
              'Флаги низкой задержки помогают живым RTSP/RTP/SRT/UDP источникам, но могут ломать запуск HLS/DASH, поэтому по умолчанию они выключены. Включайте их только для живых потоков.',
            ),
            'warn',
          ),
          note(
            ctx.pick(
              'ffplay opens a separate native window. On headless servers use frame capture and probing instead; Windows/macOS/Linux desktops show the video directly.',
              'ffplay открывает отдельное нативное окно. На серверах без графики используйте снимок кадра и анализ; на десктопах Windows/macOS/Linux видео показывается сразу.',
            ),
            'info',
          ),
        ),
        [],
        '',
        { defaultCollapsed: true },
      );

      const previewPane = pane(
        ctx.pick('Preview & probe', 'Предпросмотр и анализ'),
        h(
          'div',
          { class: 'dt-stack' },
          probeError,
          h('div', { class: 'dt-grid-3' }, field(ctx.pick('Capture at, s', 'Снимок на, с'), snapshotAtInput), field(ctx.pick('Preview width, px (0 = native)', 'Ширина превью, px (0 = как есть)'), snapshotWidthInput), h('div', { class: 'dt-inline-actions' }, snapshotBtn)),
          h('details', { class: 'dt-media-cmd' }, h('summary', {}, ctx.pick('ffmpeg snapshot command', 'Команда снимка ffmpeg')), snapshotCommand),
          previewSlot,
          toolbar(probeBtn),
          probeSlot,
        ),
      );

      const commandPane = pane(
        ctx.pick('ffplay command', 'Команда ffplay'),
        commandArea,
        [copyBtn(() => commandArea.value)],
        'dt-media-cmd-pane',
        { collapsible: true, defaultCollapsed: true },
      );

      const logPane = pane(ctx.pick('ffplay log', 'Журнал ffplay'), logArea, [copyBtn(() => logArea.value)], '', {
        collapsible: true,
        defaultCollapsed: true,
      });

      const referenceRows = STREAM_PROTOCOLS.map((protocol) => [
        h('strong', {}, protocol.label.en),
        h('code', { class: 'dt-mono' }, protocol.example),
        h('span', { class: 'dt-hint' }, ctx.pick(protocol.hint.en, protocol.hint.ru)),
      ]);
      const referencePane = pane(
        ctx.pick('What ffplay can open', 'Что умеет открывать ffplay'),
        h(
          'div',
          { class: 'dt-stack' },
          note(
            ctx.pick(
              'ffplay is a bare FFmpeg player: it accepts every protocol and container ffmpeg demuxes. RTSP, RTMP(S), HLS, DASH, SRT, RTP, MPEG-TS, HTTP(S), FTP/SFTP, local files, image sequences, concat lists and capture devices are all supported.',
              'ffplay — минималистичный плеер FFmpeg: он принимает все протоколы и контейнеры, которые читает ffmpeg. Поддерживаются RTSP, RTMP(S), HLS, DASH, SRT, RTP, MPEG-TS, HTTP(S), FTP/SFTP, локальные файлы, последовательности кадров, concat-списки и устройства захвата.',
            ),
            'info',
          ),
          table([ctx.pick('Protocol', 'Протокол'), ctx.pick('Example', 'Пример'), ctx.pick('Notes', 'Заметки')], referenceRows),
        ),
        [],
        '',
        { collapsible: true, defaultCollapsed: true },
      );

      const infoPane = pane(
        ctx.pick('Binaries', 'Исполняемые файлы'),
        h(
          'div',
          { class: 'dt-stack' },
          h('div', { class: 'dt-media-status-row' }, infoSlot, btn(ctx.pick('Refresh', 'Обновить'), () => void refreshInfo(), { variant: 'ghost', class: 'dt-btn-compact' })),
        ),
        [],
        '',
        { collapsible: true, defaultCollapsed: true },
      );

      root.append(
        error,
        split(
          h('div', { class: 'dt-stack' }, sourcePane, controlsPane, referencePane, infoPane),
          h('div', { class: 'dt-stack' }, previewPane, commandPane, logPane),
        ),
      );

      const incoming = ctx.takeIncoming();
      if (incoming) {
        const apply = (filePath: string): void => {
          urlInput.value = filePath;
          manualProtocol = 'file';
          protocolSelect.value = 'file';
          update();
          void probeStream();
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
      urlInput.focus();

      urlInput.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        void startPlay();
      });    },
  }),
];
