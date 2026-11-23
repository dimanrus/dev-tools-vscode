/**
 * Extension-host side of the FFmpeg tools: binary discovery, probing,
 * conversions with progress, ffplay sessions and stream snapshots.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import readline from 'node:readline';
import * as vscode from 'vscode';
import {
  buildConvertArgs,
  buildPlayArgs,
  buildProbeArgs,
  buildSnapshotArgs,
  formatCommand,
  type ConvertRequest,
  type PlayRequest,
  type ProbeRequest,
  type SnapshotRequest,
} from './media-args.ts';

export type MediaEmit = (event: string, payload: Record<string, unknown>) => void;

const CONFIG_SECTION = 'devTools';
const MAX_CAPTURE_BYTES = 4_000_000;
const MAX_IMAGE_BYTES = 24_000_000;
const MAX_STAGED_BYTES = 512 * 1024 * 1024;

function normalizeBinary(value: string): string {
  let result = value.trim().replace(/^"(.*)"$/, '$1');
  if (result === '~') return homedir();
  if (result.startsWith('~/') || result.startsWith('~\\')) result = path.join(homedir(), result.slice(2));
  return result;
}

function binaryPath(key: 'ffmpegPath' | 'ffprobePath' | 'ffplayPath', fallback: string): string {
  const configured = vscode.workspace.getConfiguration(CONFIG_SECTION).get<string>(key, '');
  return configured?.trim() ? normalizeBinary(configured) : fallback;
}

function assertTrusted(): void {
  if (!vscode.workspace.isTrusted) {
    throw new Error('FFmpeg tools run local processes and require a trusted workspace.');
  }
}

export const ffmpegBin = (): string => binaryPath('ffmpegPath', 'ffmpeg');
export const ffprobeBin = (): string => binaryPath('ffprobePath', 'ffprobe');
export const ffplayBin = (): string => binaryPath('ffplayPath', 'ffplay');

interface CaptureResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: Buffer;
  stderr: string;
  timedOut: boolean;
  overflow: boolean;
}

function runCapture(bin: string, args: string[], timeoutMs: number, maxBytes = MAX_CAPTURE_BYTES): Promise<CaptureResult> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let stderr = '';
    let timedOut = false;
    let overflow = false;
    let settled = false;

    const finish = (code: number | null, signal: NodeJS.Signals | null): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, signal, stdout: Buffer.concat(chunks), stderr, timedOut, overflow });
    };

    let child: ChildProcess;
    try {
      child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    } catch (error) {
      resolve({
        code: null,
        signal: null,
        stdout: Buffer.alloc(0),
        stderr: error instanceof Error ? error.message : String(error),
        timedOut: false,
        overflow: false,
      });
      return;
    }

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout?.on('data', (chunk: Buffer) => {
      if (size + chunk.length > maxBytes) {
        overflow = true;
        child.kill('SIGKILL');
        return;
      }
      size += chunk.length;
      chunks.push(chunk);
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString('utf8')).slice(-64_000);
    });
    child.on('error', (error) => {
      stderr = `${stderr}\n${error.message}`.trim();
      finish(null, null);
    });
    child.on('close', (code, signal) => finish(code, signal));
  });
}

function firstLine(value: string): string {
  return value.split(/\r?\n/).find((line) => line.trim())?.trim() ?? '';
}

interface BinaryInfo {
  path: string;
  available: boolean;
  version: string;
  line: string;
  error?: string;
}

async function inspectBinary(bin: string): Promise<BinaryInfo> {
  const result = await runCapture(bin, ['-version'], 6_000, 256 * 1024);
  const text = `${result.stdout.toString('utf8')}\n${result.stderr}`;
  const line = firstLine(text);
  const version = /version\s+(\S+)/i.exec(text)?.[1] ?? '';
  return {
    path: bin,
    available: result.code === 0,
    version,
    line,
    error: result.code === 0 ? undefined : result.timedOut ? 'Timed out' : firstLine(result.stderr) || 'Not found',
  };
}

export async function mediaInfo(): Promise<Record<string, unknown>> {
  assertTrusted();
  const [ffmpeg, ffprobe, ffplay] = await Promise.all([
    inspectBinary(ffmpegBin()),
    inspectBinary(ffprobeBin()),
    inspectBinary(ffplayBin()),
  ]);
  return { platform: process.platform, arch: process.arch, ffmpeg, ffprobe, ffplay };
}

function runTimeout(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(120_000, Math.max(1_000, Math.round(parsed)));
}

function asNetworkParams(params: Record<string, unknown>): ProbeRequest {
  return {
    target: String(params.target ?? params.url ?? '').trim(),
    rtspTransport: (params.rtspTransport as ProbeRequest['rtspTransport']) ?? 'auto',
    headers: typeof params.headers === 'string' ? params.headers : '',
    userAgent: typeof params.userAgent === 'string' ? params.userAgent : '',
    referer: typeof params.referer === 'string' ? params.referer : '',
    timeoutUs: Number(params.timeoutUs) || undefined,
  };
}

interface ProbeStreamSummary {
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
}

interface ProbeSummary {
  format: string;
  formatLong: string;
  duration: number;
  size: number;
  bitrate: number;
  streams: ProbeStreamSummary[];
}

function parseRate(value: unknown): number {
  const text = String(value ?? '');
  const match = /^(\d+)\/(\d+)$/.exec(text);
  if (match) {
    const numerator = Number(match[1]);
    const denominator = Number(match[2]);
    if (denominator > 0 && numerator > 0) return numerator / denominator;
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function summarizeProbe(value: unknown): ProbeSummary {
  const document = (value ?? {}) as {
    format?: Record<string, unknown>;
    streams?: Array<Record<string, unknown>>;
  };
  const format = document.format ?? {};
  const streams = Array.isArray(document.streams) ? document.streams : [];
  const duration = Number(format.duration ?? 0) || streams.reduce((max, stream) => Math.max(max, Number(stream.duration ?? 0)), 0);
  return {
    format: String(format.format_name ?? ''),
    formatLong: String(format.format_long_name ?? ''),
    duration,
    size: Number(format.size ?? 0),
    bitrate: Number(format.bit_rate ?? 0),
    streams: streams.map((stream, index) => ({
      index: Number(stream.index ?? index),
      type: String(stream.codec_type ?? ''),
      codec: String(stream.codec_long_name ?? stream.codec_name ?? ''),
      profile: String(stream.profile ?? ''),
      width: Number(stream.width ?? 0),
      height: Number(stream.height ?? 0),
      fps: parseRate(stream.avg_frame_rate ?? stream.r_frame_rate),
      bitrate: Number(stream.bit_rate ?? 0),
      sampleRate: Number(stream.sample_rate ?? 0),
      channels: Number(stream.channels ?? 0),
      channelLayout: String(stream.channel_layout ?? ''),
      pixelFormat: String(stream.pix_fmt ?? ''),
      language: String((stream.tags as Record<string, unknown> | undefined)?.language ?? ''),
    })),
  };
}

export async function probeMedia(params: Record<string, unknown>): Promise<Record<string, unknown>> {
  assertTrusted();
  const request = asNetworkParams(params);
  if (!request.target) throw new Error('Enter a file path or stream URL to probe.');
  const bin = ffprobeBin();
  const args = buildProbeArgs(request);
  const result = await runCapture(bin, args, runTimeout(params.timeoutMs, 25_000));
  if (result.overflow) throw new Error('ffprobe produced too much data.');
  if (result.code !== 0) {
    const reason = result.timedOut
      ? `ffprobe timed out after ${Math.round(runTimeout(params.timeoutMs, 25_000) / 1000)} s.`
      : firstLine(result.stderr) || `ffprobe exited with code ${result.code}.`;
    throw new Error(reason);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(result.stdout.toString('utf8'));
  } catch {
    throw new Error('ffprobe returned malformed JSON.');
  }
  return {
    command: formatCommand(bin, args),
    args,
    probe: parsed,
    summary: summarizeProbe(parsed),
  };
}

interface MediaJob {
  id: string;
  child: ChildProcess;
  canceled: boolean;
  emit: MediaEmit;
  startedAt: number;
}

const jobs = new Map<string, MediaJob>();

function normalizeConvert(raw: unknown): ConvertRequest {
  const value = (raw ?? {}) as Record<string, unknown>;
  return {
    input: String(value.input ?? '').trim(),
    output: String(value.output ?? '').trim(),
    container: (value.container as ConvertRequest['container']) ?? 'mp4',
    videoCodec: (value.videoCodec as ConvertRequest['videoCodec']) ?? 'h264',
    audioCodec: (value.audioCodec as ConvertRequest['audioCodec']) ?? 'aac',
    crf: Math.min(63, Math.max(0, Number(value.crf ?? 23))),
    preset: String(value.preset ?? 'medium'),
    width: Math.max(0, Number(value.width ?? 0)),
    height: Math.max(0, Number(value.height ?? 0)),
    fps: Math.max(0, Number(value.fps ?? 0)),
    start: Math.max(0, Number(value.start ?? 0)),
    duration: Math.max(0, Number(value.duration ?? 0)),
    hardware: (value.hardware as ConvertRequest['hardware']) ?? 'none',
    hardwareDevice: typeof value.hardwareDevice === 'string' ? value.hardwareDevice : '',
    fastStart: value.fastStart !== false,
    overwrite: value.overwrite !== false,
    extraArgs: typeof value.extraArgs === 'string' ? value.extraArgs : '',
  };
}

/** Starts an ffmpeg conversion and reports progress through `emit`. */
export async function runConvert(params: Record<string, unknown>, emit: MediaEmit): Promise<Record<string, unknown>> {
  assertTrusted();
  const request = normalizeConvert(params.request);
  if (!request.input) throw new Error('Choose an input file first.');
  if (!request.output) throw new Error('Choose an output file first.');
  if (path.resolve(request.input) === path.resolve(request.output)) throw new Error('Input and output must be different files.');

  const jobId = String(params.jobId ?? '').trim() || randomUUID();
  if (jobs.has(jobId)) throw new Error('A conversion with this identifier is already running.');
  const duration = Math.max(0, Number(params.duration ?? 0));
  const bin = ffmpegBin();
  const args = buildConvertArgs(request);

  let child: ChildProcess;
  try {
    child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  } catch (error) {
    throw new Error(`Cannot start ffmpeg: ${error instanceof Error ? error.message : String(error)}`);
  }

  const job: MediaJob = { id: jobId, child, canceled: false, emit, startedAt: Date.now() };
  jobs.set(jobId, job);

  const logTail: string[] = [];
  let pendingLog: string[] = [];
  let logTimer: ReturnType<typeof setTimeout> | undefined;
  let finished = false;

  const flushLog = (): void => {
    if (!pendingLog.length) return;
    const lines = pendingLog;
    pendingLog = [];
    emit('media-log', { jobId, lines });
  };

  const stdout = child.stdout;
  const stderr = child.stderr;
  if (stdout) {
    const progressReader = readline.createInterface({ input: stdout });
    const values: Record<string, string> = {};
    progressReader.on('line', (line) => {
      const separator = line.indexOf('=');
      if (separator < 0) return;
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim();
      values[key] = value;
      if (key !== 'progress') return;
      const outTimeUs = Number(values.out_time_us ?? 0);
      const percent = duration > 0 ? Math.min(100, (outTimeUs / (duration * 1_000_000)) * 100) : null;
      emit('media-progress', {
        jobId,
        percent,
        outTimeUs,
        speed: values.speed ?? '',
        totalSize: Number(values.total_size ?? 0),
        bitrate: values.bitrate ?? '',
        done: value === 'end',
      });
    });
  }
  if (stderr) {
    const logReader = readline.createInterface({ input: stderr });
    logReader.on('line', (line) => {
      logTail.push(line);
      if (logTail.length > 400) logTail.shift();
      pendingLog.push(line);
      if (pendingLog.length > 200) pendingLog.shift();
      if (!logTimer) {
        logTimer = setTimeout(() => {
          logTimer = undefined;
          flushLog();
        }, 250);
      }
    });
  }

  const finish = (code: number | null, signal: NodeJS.Signals | null, error?: string): void => {
    if (finished) return;
    finished = true;
    if (logTimer) clearTimeout(logTimer);
    flushLog();
    jobs.delete(jobId);
    let outputSize = 0;
    try {
      if (existsSync(request.output)) outputSize = statSync(request.output).size;
    } catch {
      /* ignore */
    }
    emit('media-job-done', {
      jobId,
      code,
      signal,
      canceled: job.canceled,
      error: error ?? '',
      elapsedMs: Date.now() - job.startedAt,
      output: request.output,
      outputSize,
      log: logTail.join('\n'),
      command: formatCommand(bin, args),
    });
  };

  child.once('error', (error) => finish(null, null, `Cannot start ffmpeg: ${error.message}`));
  child.once('close', (code, signal) => finish(code, signal));

  await new Promise<void>((resolve, reject) => {
    const onSpawn = (): void => {
      child.removeListener('error', onError);
      resolve();
    };
    const onError = (error: Error): void => {
      finish(null, null, `Cannot start ffmpeg (${bin}): ${error.message}`);
      reject(new Error(`Cannot start ffmpeg (${bin}): ${error.message}`));
    };
    child.once('spawn', onSpawn);
    child.once('error', onError);
  });

  return { jobId, pid: child.pid ?? null, command: formatCommand(bin, args), args };
}

export function cancelConvert(params: Record<string, unknown>): boolean {
  const job = jobs.get(String(params.jobId ?? '').trim());
  if (!job) return false;
  job.canceled = true;
  job.child.kill('SIGTERM');
  setTimeout(() => {
    if (job.child.exitCode === null && job.child.signalCode === null) job.child.kill('SIGKILL');
  }, 2_000).unref?.();
  return true;
}

interface PlayerProcess {
  id: string;
  child: ChildProcess;
  emit: MediaEmit;
}

const players = new Map<string, PlayerProcess>();

function normalizePlay(raw: unknown): PlayRequest {
  const value = (raw ?? {}) as Record<string, unknown>;
  return {
    url: String(value.url ?? '').trim(),
    rtspTransport: (value.rtspTransport as PlayRequest['rtspTransport']) ?? 'auto',
    headers: typeof value.headers === 'string' ? value.headers : '',
    userAgent: typeof value.userAgent === 'string' ? value.userAgent : '',
    referer: typeof value.referer === 'string' ? value.referer : '',
    lowLatency: value.lowLatency === true,
    fullscreen: value.fullscreen === true,
    mute: value.mute === true,
    volume: Math.min(100, Math.max(0, Number(value.volume ?? 100))),
    loop: value.loop === true,
    windowTitle: typeof value.windowTitle === 'string' ? value.windowTitle : '',
    extraArgs: typeof value.extraArgs === 'string' ? value.extraArgs : '',
  };
}

/** Launches ffplay in its own window and keeps it controllable from the panel. */
export async function playMedia(params: Record<string, unknown>, emit: MediaEmit): Promise<Record<string, unknown>> {
  assertTrusted();
  const request = normalizePlay(params.request);
  if (!request.url) throw new Error('Enter a stream URL or file path.');
  const playId = String(params.playId ?? '').trim() || randomUUID();
  if (players.has(playId)) throw new Error('This player is already running.');
  const bin = ffplayBin();
  const args = buildPlayArgs(request);

  let child: ChildProcess;
  try {
    child = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: false });
  } catch (error) {
    throw new Error(`Cannot start ffplay: ${error instanceof Error ? error.message : String(error)}`);
  }
  const player: PlayerProcess = { id: playId, child, emit };
  players.set(playId, player);

  const logTail: string[] = [];
  let finished = false;
  const finish = (code: number | null, signal: NodeJS.Signals | null, error?: string): void => {
    if (finished) return;
    finished = true;
    players.delete(playId);
    emit('media-play-done', {
      playId,
      code,
      signal,
      error: error ?? '',
      log: logTail.join('\n'),
      command: formatCommand(bin, args),
    });
  };

  if (child.stderr) {
    const reader = readline.createInterface({ input: child.stderr });
    reader.on('line', (line) => {
      logTail.push(line);
      if (logTail.length > 200) logTail.shift();
      emit('media-play-log', { playId, line });
    });
  }
  child.once('error', (error) => finish(null, null, `Cannot start ffplay (${bin}): ${error.message}`));
  child.once('close', (code, signal) => finish(code, signal));

  await new Promise<void>((resolve, reject) => {
    const onSpawn = (): void => {
      child.removeListener('error', onError);
      resolve();
    };
    const onError = (error: Error): void => {
      finish(null, null, `Cannot start ffplay (${bin}): ${error.message}`);
      reject(new Error(`Cannot start ffplay (${bin}): ${error.message}`));
    };
    child.once('spawn', onSpawn);
    child.once('error', onError);
  });

  return { playId, pid: child.pid ?? null, command: formatCommand(bin, args), args };
}

export function stopPlay(params: Record<string, unknown>): boolean {
  const playId = String(params.playId ?? '').trim();
  const targets = playId ? [players.get(playId)].filter((entry): entry is PlayerProcess => Boolean(entry)) : Array.from(players.values());
  for (const player of targets) player.child.kill('SIGTERM');
  return targets.length > 0;
}

export async function snapshotMedia(params: Record<string, unknown>): Promise<Record<string, unknown>> {
  assertTrusted();
  const request: SnapshotRequest = {
    ...asNetworkParams(params),
    at: Math.max(0, Number(params.at ?? 0)),
    width: Math.max(0, Number(params.width ?? 0)),
  };
  if (!request.target) throw new Error('Enter a stream URL or file path first.');
  const bin = ffmpegBin();
  const args = buildSnapshotArgs(request);
  const timeoutMs = runTimeout(params.timeoutMs, 25_000);
  const result = await runCapture(bin, args, timeoutMs, MAX_IMAGE_BYTES);
  if (result.overflow) throw new Error('The captured frame is too large.');
  const png = result.stdout;
  const valid = png.length > 8 && png[0] === 0x89 && png.toString('latin1', 1, 4) === 'PNG' && png.includes(Buffer.from('IEND'));
  if (!valid) {
    const reason = result.timedOut
      ? `No frame was decoded within ${Math.round(timeoutMs / 1000)} s.`
      : firstLine(result.stderr) || 'ffmpeg returned no image data.';
    throw new Error(reason);
  }
  return {
    dataUrl: `data:image/png;base64,${png.toString('base64')}`,
    bytes: png.length,
    command: formatCommand(bin, args),
  };
}

interface FileFilter {
  name: string;
  extensions: string[];
}

function normalizeFilters(value: unknown): Record<string, string[]> | undefined {
  if (!Array.isArray(value)) return undefined;
  const filters: Record<string, string[]> = {};
  for (const entry of value as FileFilter[]) {
    if (!entry || typeof entry.name !== 'string' || !Array.isArray(entry.extensions)) continue;
    const extensions = entry.extensions.filter((extension): extension is string => typeof extension === 'string' && /^[\w*]+$/.test(extension));
    if (extensions.length) filters[entry.name] = extensions;
  }
  return Object.keys(filters).length ? filters : undefined;
}

export async function pickMediaFile(params: Record<string, unknown>): Promise<string | null> {
  const defaultPath = String(params.defaultPath ?? '').trim();
  const picked = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    openLabel: 'Use this file',
    filters: normalizeFilters(params.filters),
    defaultUri: defaultPath ? vscode.Uri.file(defaultPath) : undefined,
  });
  return picked?.[0]?.fsPath ?? null;
}

export async function saveMediaFile(params: Record<string, unknown>): Promise<string | null> {
  const defaultPath = String(params.defaultPath ?? '').trim();
  const picked = await vscode.window.showSaveDialog({
    saveLabel: 'Save as',
    filters: normalizeFilters(params.filters),
    defaultUri: defaultPath ? vscode.Uri.file(defaultPath) : undefined,
  });
  return picked?.fsPath ?? null;
}

export async function revealMediaFile(params: Record<string, unknown>): Promise<boolean> {
  const target = String(params.path ?? '').trim();
  if (!target || !existsSync(target)) return false;
  await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(target));
  return true;
}

/** Writes webview-provided bytes to a temporary file (drag & drop fallback). */
export async function stageMediaFile(params: Record<string, unknown>): Promise<Record<string, unknown>> {
  const name = path.basename(String(params.name ?? 'media.bin')).replace(/[^\w.-]+/g, '_') || 'media.bin';
  const dataUrl = String(params.dataUrl ?? '');
  const comma = dataUrl.indexOf(',');
  if (comma < 0) throw new Error('Unsupported file payload.');
  const header = dataUrl.slice(0, comma);
  const body = dataUrl.slice(comma + 1);
  const buffer = header.includes(';base64') ? Buffer.from(body, 'base64') : Buffer.from(decodeURIComponent(body), 'utf8');
  if (buffer.length > MAX_STAGED_BYTES) throw new Error('The file is too large to stage on disk.');
  const directory = path.join(tmpdir(), 'dev-tools-media');
  mkdirSync(directory, { recursive: true });
  const target = path.join(directory, `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${name}`);
  writeFileSync(target, buffer);
  return { path: target, name };
}

/** Kills every conversion and player owned by the panel. */
export function disposeMedia(): void {
  for (const job of jobs.values()) job.child.kill('SIGKILL');
  jobs.clear();
  for (const player of players.values()) player.child.kill('SIGTERM');
  players.clear();
}
