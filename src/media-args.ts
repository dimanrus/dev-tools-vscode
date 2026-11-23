/**
 * Pure helpers shared by the webview (command preview) and the extension host
 * (actual process spawning). No Node.js or VS Code imports here.
 */

export type Container = 'mp4' | 'mkv' | 'webm' | 'mov' | 'gif' | 'mp3' | 'wav' | 'flac' | 'm4a' | 'ogg';
export type VideoCodec = 'copy' | 'h264' | 'h265' | 'vp9' | 'av1' | 'none';
export type AudioCodec = 'copy' | 'aac' | 'opus' | 'mp3' | 'flac' | 'pcm' | 'none';
export type HardwareAccel = 'none' | 'nvenc' | 'qsv' | 'vaapi' | 'videotoolbox';
export type RtspTransport = 'auto' | 'tcp' | 'udp' | 'http';

export interface ConvertRequest {
  input: string;
  output: string;
  container: Container;
  videoCodec: VideoCodec;
  audioCodec: AudioCodec;
  /** Constant Rate Factor / quality (0–51, lower is better). */
  crf: number;
  preset: string;
  /** 0 keeps the source size. */
  width: number;
  /** 0 keeps the source size. */
  height: number;
  /** 0 keeps the source frame rate. */
  fps: number;
  /** Trim start in seconds. */
  start: number;
  /** Trim length in seconds (0 = until the end). */
  duration: number;
  hardware: HardwareAccel;
  hardwareDevice?: string;
  fastStart: boolean;
  overwrite: boolean;
  extraArgs: string;
}

export interface NetworkOptions {
  rtspTransport?: RtspTransport;
  /** Raw "Header: value" lines. */
  headers?: string;
  userAgent?: string;
  referer?: string;
  /** Read timeout in microseconds. */
  timeoutUs?: number;
}

export interface PlayRequest extends NetworkOptions {
  url: string;
  lowLatency: boolean;
  fullscreen: boolean;
  mute: boolean;
  /** 0–100. */
  volume: number;
  loop: boolean;
  windowTitle: string;
  extraArgs: string;
}

export interface ProbeRequest extends NetworkOptions {
  target: string;
}

export interface SnapshotRequest extends NetworkOptions {
  target: string;
  /** Seek position in seconds (0 = first available frame). */
  at: number;
  /** Downscale width; 0 keeps the source size. */
  width: number;
}

/** Splits a shell-ish argument string, honouring single and double quotes. */
export function splitArgs(input: string): string[] {
  const result: string[] = [];
  let current = '';
  let quote = '';
  let escaped = false;
  for (const character of input) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }
    if (character === '\\' && quote !== "'") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = '';
      else current += character;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (/\s/.test(character)) {
      if (current) {
        result.push(current);
        current = '';
      }
      continue;
    }
    current += character;
  }
  if (current) result.push(current);
  return result;
}

/** Quotes one argument for display/copy-paste in a POSIX shell. */
export function quoteArg(value: string): string {
  if (!value) return '""';
  if (!/[\s"'\\$`!*?()[\]{}|&;<>#~]/.test(value)) return value;
  return `"${value.replace(/(["\\$`])/g, '\\$1')}"`;
}

export function formatCommand(bin: string, args: string[]): string {
  return [bin, ...args].map(quoteArg).join(' ');
}

const even = (value: number): number => Math.max(2, Math.round(value / 2) * 2);

const USES_NO_VIDEO: Container[] = ['mp3', 'wav', 'flac', 'm4a'];
const USES_NO_AUDIO: Container[] = ['gif'];

export function networkArgs(options: NetworkOptions, target = ''): string[] {
  const scheme = /^([a-z][a-z0-9+.-]*):\/\//i.exec(target)?.[1]?.toLowerCase() ?? '';
  const isRtsp = scheme === 'rtsp' || scheme === 'rtsps';
  const isHttp = scheme === 'http' || scheme === 'https';
  const args: string[] = [];
  if (isRtsp && options.rtspTransport && options.rtspTransport !== 'auto') {
    args.push('-rtsp_transport', options.rtspTransport);
  }
  if (isRtsp || isHttp) {
    const headers = (options.headers ?? '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (headers.length) args.push('-headers', `${headers.join('\r\n')}\r\n`);
    if (options.userAgent?.trim()) args.push('-user_agent', options.userAgent.trim());
  }
  if (isHttp && options.referer?.trim()) args.push('-referer', options.referer.trim());
  if (options.timeoutUs && options.timeoutUs > 0) args.push('-rw_timeout', String(Math.round(options.timeoutUs)));
  return args;
}

function videoCodecArgs(request: ConvertRequest): string[] {
  if (USES_NO_VIDEO.includes(request.container) || request.videoCodec === 'none') return ['-vn'];
  if (request.container === 'gif') return [];
  if (request.videoCodec === 'copy') return ['-c:v', 'copy'];

  const hevc = request.videoCodec === 'h265';
  switch (request.hardware) {
    case 'nvenc':
      return ['-c:v', hevc ? 'hevc_nvenc' : 'h264_nvenc', '-preset', 'p5', '-cq', String(request.crf), '-b:v', '0'];
    case 'qsv':
      return ['-c:v', hevc ? 'hevc_qsv' : 'h264_qsv', '-global_quality', String(request.crf), '-preset', request.preset];
    case 'vaapi':
      return ['-c:v', hevc ? 'hevc_vaapi' : 'h264_vaapi', '-qp', String(request.crf)];
    case 'videotoolbox':
      return ['-c:v', hevc ? 'hevc_videotoolbox' : 'h264_videotoolbox', '-q:v', String(Math.max(1, Math.min(100, 100 - request.crf * 2)))];
    default:
      break;
  }

  switch (request.videoCodec) {
    case 'h264':
      return ['-c:v', 'libx264', '-preset', request.preset, '-crf', String(request.crf), '-pix_fmt', 'yuv420p'];
    case 'h265':
      return ['-c:v', 'libx265', '-preset', request.preset, '-crf', String(request.crf), '-pix_fmt', 'yuv420p'];
    case 'vp9':
      return ['-c:v', 'libvpx-vp9', '-crf', String(request.crf), '-b:v', '0', '-row-mt', '1'];
    case 'av1':
      return ['-c:v', 'libsvtav1', '-crf', String(request.crf), '-preset', '8'];
    default:
      return [];
  }
}

function gifArgs(request: ConvertRequest): string[] {
  const fps = request.fps > 0 ? request.fps : 12;
  const width = request.width > 0 ? even(request.width) : 480;
  const filter =
    `fps=${fps},scale=${width}:-1:flags=lanczos,split[s0][s1];` +
    '[s0]palettegen[p];[s1][p]paletteuse';
  return ['-an', '-vf', filter, '-loop', '0'];
}

function videoFilterArgs(request: ConvertRequest): string[] {
  if (request.container === 'gif' || request.videoCodec === 'copy' || request.videoCodec === 'none') return [];
  if (USES_NO_VIDEO.includes(request.container)) return [];
  const filters: string[] = [];
  if (request.fps > 0) filters.push(`fps=${request.fps}`);
  if (request.width > 0 || request.height > 0) {
    const width = request.width > 0 ? even(request.width) : -2;
    const height = request.height > 0 ? even(request.height) : -2;
    filters.push(`scale=${width}:${height}`);
  }
  if (request.hardware === 'vaapi') filters.push('format=nv12', 'hwupload');
  return filters.length ? ['-vf', filters.join(',')] : [];
}

function audioCodecArgs(request: ConvertRequest): string[] {
  if (USES_NO_AUDIO.includes(request.container) || request.audioCodec === 'none') return ['-an'];
  if (request.audioCodec === 'copy') return ['-c:a', 'copy'];
  switch (request.audioCodec) {
    case 'aac':
      return ['-c:a', 'aac', '-b:a', '192k'];
    case 'opus':
      return ['-c:a', 'libopus', '-b:a', '128k', '-vbr', 'on'];
    case 'mp3':
      return ['-c:a', 'libmp3lame', '-q:a', '2'];
    case 'flac':
      return ['-c:a', 'flac'];
    case 'pcm':
      return ['-c:a', 'pcm_s16le'];
    default:
      return [];
  }
}

/** Builds the complete `ffmpeg` argument list (without the binary name). */
export function buildConvertArgs(request: ConvertRequest): string[] {
  const args: string[] = ['-hide_banner', request.overwrite ? '-y' : '-n', '-nostdin'];
  if (request.hardware === 'vaapi') {
    args.push('-vaapi_device', request.hardwareDevice?.trim() || '/dev/dri/renderD128');
  }
  if (request.start > 0) args.push('-ss', String(request.start));
  args.push('-i', request.input);

  if (request.container === 'gif') args.push(...gifArgs(request));
  else {
    args.push(...videoCodecArgs(request), ...videoFilterArgs(request), ...audioCodecArgs(request));
  }

  if ((request.container === 'mp4' || request.container === 'mov' || request.container === 'm4a') && request.fastStart) {
    args.push('-movflags', '+faststart');
  }
  if (request.container === 'mp4' && request.videoCodec === 'h265') {
    args.push('-tag:v', 'hvc1');
  }
  if (request.duration > 0) args.push('-t', String(request.duration));
  args.push(...splitArgs(request.extraArgs));
  args.push('-progress', 'pipe:1', '-nostats', '-stats_period', '0.5', request.output);
  return args;
}

export function buildProbeArgs(request: ProbeRequest): string[] {
  return [
    '-hide_banner',
    '-v',
    'error',
    ...networkArgs(request, request.target),
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    '-show_programs',
    '-show_chapters',
    request.target,
  ];
}

export function buildSnapshotArgs(request: SnapshotRequest): string[] {
  const args = ['-hide_banner', '-nostdin', '-loglevel', 'error', ...networkArgs(request, request.target)];
  if (request.at > 0) args.push('-ss', String(request.at));
  args.push('-i', request.target, '-frames:v', '1');
  if (request.width > 0) args.push('-vf', `scale=${even(request.width)}:-2`);
  args.push('-f', 'image2pipe', '-vcodec', 'png', '-');
  return args;
}

export function buildPlayArgs(request: PlayRequest): string[] {
  const args = ['-hide_banner', '-loglevel', 'warning', ...networkArgs(request, request.url)];
  if (request.lowLatency) args.push('-fflags', 'nobuffer', '-flags', 'low_delay', '-framedrop');
  if (request.fullscreen) args.push('-fs');
  if (request.mute) args.push('-an');
  else if (request.volume >= 0 && request.volume !== 100) args.push('-volume', String(Math.round(request.volume)));
  if (request.loop) args.push('-loop', '0');
  if (request.windowTitle.trim()) args.push('-window_title', request.windowTitle.trim());
  args.push(...splitArgs(request.extraArgs), request.url);
  return args;
}

export type ProtocolId = 'rtsp' | 'rtp' | 'rtmp' | 'hls' | 'dash' | 'srt' | 'udp' | 'tcp' | 'http' | 'ftp' | 'file' | 'device' | 'concat';

export interface ProtocolInfo {
  id: ProtocolId;
  label: { en: string; ru: string };
  example: string;
  hint: { en: string; ru: string };
}

/** What ffplay/ffmpeg can open, with real-world examples. */
export const STREAM_PROTOCOLS: ProtocolInfo[] = [
  {
    id: 'rtsp',
    label: { en: 'RTSP', ru: 'RTSP' },
    example: 'rtsp://user:pass@192.168.1.64:554/Streaming/Channels/101',
    hint: {
      en: 'IP cameras and NVRs. Prefer TCP for lossy networks, HTTP tunnel through proxies.',
      ru: 'IP-камеры и видеорегистраторы. Для нестабильных сетей выбирайте TCP, HTTP-туннель — для прокси.',
    },
  },
  {
    id: 'rtp',
    label: { en: 'RTP / SDP', ru: 'RTP / SDP' },
    example: 'rtp://239.0.0.1:5004',
    hint: {
      en: 'Raw RTP, usually described by an SDP file: pass the .sdp file as the input.',
      ru: 'Чистый RTP, обычно с описанием в SDP-файле: укажите .sdp как вход.',
    },
  },
  {
    id: 'rtmp',
    label: { en: 'RTMP / RTMPS', ru: 'RTMP / RTMPS' },
    example: 'rtmp://localhost:1935/live/stream',
    hint: {
      en: 'OBS and RTMP ingest servers. Playback works, but HLS is more common for viewers.',
      ru: 'OBS и серверы приёма RTMP. Воспроизведение работает, но для зрителей чаще используют HLS.',
    },
  },
  {
    id: 'hls',
    label: { en: 'HLS (.m3u8)', ru: 'HLS (.m3u8)' },
    example: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    hint: {
      en: 'Apple HLS live and VOD playlists, AES-128 and fMP4 segments.',
      ru: 'Живые и VOD-плейлисты Apple HLS, сегменты AES-128 и fMP4.',
    },
  },
  {
    id: 'dash',
    label: { en: 'DASH (.mpd)', ru: 'DASH (.mpd)' },
    example: 'https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd',
    hint: {
      en: 'MPEG-DASH manifests with adaptive bitrate sets.',
      ru: 'Манифесты MPEG-DASH с наборами адаптивного битрейта.',
    },
  },
  {
    id: 'srt',
    label: { en: 'SRT', ru: 'SRT' },
    example: 'srt://host:9000?mode=caller',
    hint: {
      en: 'Secure Reliable Transport; passphrase and latency go through extra arguments.',
      ru: 'Secure Reliable Transport; пароль и задержка задаются дополнительными аргументами.',
    },
  },
  {
    id: 'udp',
    label: { en: 'MPEG-TS over UDP', ru: 'MPEG-TS по UDP' },
    example: 'udp://@239.0.0.1:1234',
    hint: {
      en: 'IPTV multicast/unicast. The @ prefix joins the multicast group.',
      ru: 'IPTV multicast/unicast. Префикс @ включает приём multicast-группы.',
    },
  },
  {
    id: 'tcp',
    label: { en: 'MPEG-TS over TCP', ru: 'MPEG-TS по TCP' },
    example: 'tcp://127.0.0.1:1234',
    hint: {
      en: 'Raw transport streams served over TCP.',
      ru: 'Транспортные потоки, отдаваемые по TCP.',
    },
  },
  {
    id: 'http',
    label: { en: 'HTTP(S) file', ru: 'HTTP(S)-файл' },
    example: 'https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4',
    hint: {
      en: 'Progressive MP4/WebM/TS with redirects, cookies and custom headers.',
      ru: 'Прогрессивный MP4/WebM/TS с редиректами, cookies и своими заголовками.',
    },
  },
  {
    id: 'ftp',
    label: { en: 'FTP / SFTP', ru: 'FTP / SFTP' },
    example: 'sftp://user:pass@host/path/movie.mp4',
    hint: { en: 'Remote files over FTP, FTPS and SFTP.', ru: 'Удалённые файлы по FTP, FTPS и SFTP.' },
  },
  {
    id: 'file',
    label: { en: 'Local file', ru: 'Локальный файл' },
    example: '/home/user/Videos/movie.mkv',
    hint: {
      en: 'Any container ffmpeg reads, plus image sequences and subtitles.',
      ru: 'Любой контейнер, который читает ffmpeg, а также последовательности кадров и субтитры.',
    },
  },
  {
    id: 'device',
    label: { en: 'Capture device', ru: 'Устройство захвата' },
    example: 'v4l2:///dev/video0',
    hint: {
      en: 'Webcams and capture cards: v4l2/x11grab (Linux), dshow/gdigrab (Windows), avfoundation (macOS).',
      ru: 'Веб-камеры и платы захвата: v4l2/x11grab (Linux), dshow/gdigrab (Windows), avfoundation (macOS).',
    },
  },
  {
    id: 'concat',
    label: { en: 'Concat list', ru: 'Список concat' },
    example: '/path/to/list.txt',
    hint: {
      en: "A text file of `file '...'` lines played as one stream.",
      ru: "Текстовый файл со строками `file '...'`, воспроизводимый как один поток.",
    },
  },
];

const PROTOCOL_SCHEMES: Record<string, ProtocolId> = {
  rtsp: 'rtsp',
  rtsps: 'rtsp',
  rtp: 'rtp',
  rtmp: 'rtmp',
  rtmps: 'rtmp',
  srt: 'srt',
  udp: 'udp',
  tcp: 'tcp',
  http: 'http',
  https: 'http',
  ftp: 'ftp',
  ftps: 'ftp',
  sftp: 'ftp',
};

/** Best-effort protocol detection from the URL itself. */
export function detectProtocol(url: string): ProtocolId {
  const value = url.trim();
  if (!value) return 'http';
  if (/\.m3u8(?:$|[?#])/i.test(value)) return 'hls';
  if (/\.mpd(?:$|[?#])/i.test(value)) return 'dash';
  const match = /^([a-z][a-z0-9+.-]*):\/\//i.exec(value);
  if (match) return PROTOCOL_SCHEMES[match[1].toLowerCase()] ?? 'http';
  return 'file';
}
