/** Audio editor: trim, equalizer, filters, fades/normalize and WAV/MP3 export. */
import {
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
  readArrayBuffer,
  select,
  setError,
  split,
  tabs,
  textInput,
  toolbar,
} from '../components.ts';
import { clamp, h } from '../dom.ts';
import { incomingToFile, bytesToArrayBuffer } from '../lib/incoming.ts';
import { buildId3, emptyTags, hasTags, parseId3, type Id3Tags } from '../lib/id3.ts';
import { defineTool } from '../tool-types.ts';

const EQ_FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const EQ_LABELS = ['31', '62', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'];
const WAVE_COLUMNS = 1200;

type EqFilterType = 'none' | 'lowpass' | 'highpass';

interface AudioTrack {
  id: number;
  name: string;
  buffer: AudioBuffer;
  peaks: Array<{ min: number; max: number; rms?: number }>;
  volume: number;
  muted: boolean;
  solo: boolean;
  color: string;
}

const formatTime = (seconds: number): string => {
  const value = Math.max(0, seconds);
  const minutes = Math.floor(value / 60);
  const rest = value - minutes * 60;
  return `${String(minutes).padStart(2, '0')}:${rest.toFixed(2).padStart(5, '0')}`;
};

const toInt16 = (samples: Float32Array): Int16Array => {
  const output = new Int16Array(samples.length);
  for (let index = 0; index < samples.length; index++) {
    const sample = clamp(samples[index], -1, 1);
    output[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return output;
};

const encodeWav = (channels: Float32Array[], sampleRate: number): Blob => {
  const channelCount = channels.length;
  const frameCount = channels[0].length;
  const buffer = new ArrayBuffer(44 + frameCount * channelCount * 2);
  const view = new DataView(buffer);
  const writeText = (offset: number, text: string): void => {
    for (let index = 0; index < text.length; index++) view.setUint8(offset + index, text.charCodeAt(index));
  };
  writeText(0, 'RIFF');
  view.setUint32(4, 36 + frameCount * channelCount * 2, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channelCount * 2, true);
  view.setUint16(32, channelCount * 2, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, frameCount * channelCount * 2, true);
  let offset = 44;
  for (let frame = 0; frame < frameCount; frame++) {
    for (let channel = 0; channel < channelCount; channel++) {
      const sample = clamp(channels[channel][frame], -1, 1);
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([buffer], { type: 'audio/wav' });
};

const encodeMp3 = (channels: Float32Array[], sampleRate: number, kbps: number): Blob => {
  const lamejs = (globalThis as { lamejs?: LamejsGlobal }).lamejs;
  if (!lamejs?.Mp3Encoder) {
    throw new Error('The MP3 encoder (media/vendor/lamejs.iife.js) is not loaded, so only WAV export is available.');
  }
  const left = toInt16(channels[0]);
  const right = channels.length > 1 ? toInt16(channels[1]) : null;
  const encoder = new lamejs.Mp3Encoder(channels.length > 1 ? 2 : 1, sampleRate, kbps);
  const chunks: Uint8Array[] = [];
  const block = 1152;
  for (let offset = 0; offset < left.length; offset += block) {
    const leftChunk = left.subarray(offset, offset + block);
    const encoded = right
      ? encoder.encodeBuffer(leftChunk, right.subarray(offset, offset + block))
      : encoder.encodeBuffer(leftChunk);
    if (encoded.length) chunks.push(new Uint8Array(encoded));
  }
  const tail = encoder.flush();
  if (tail.length) chunks.push(new Uint8Array(tail));
  const parts: BlobPart[] = chunks.map(
    (chunk) => chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength) as ArrayBuffer,
  );
  return new Blob(parts, { type: 'audio/mpeg' });
};

function audioEditorTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'media-audio-editor',
    group: 'media',
    icon: '<path d="M3 12v-2a2 2 0 0 1 2 -2h2l3 -4v16l-3 -4h-2a2 2 0 0 1 -2 -2z"/><path d="M14 8a4 4 0 0 1 0 8"/><path d="M17 5a9 9 0 0 1 0 14"/>',
    name: { en: 'Audio Editor', ru: 'Редактор звука' },
    desc: {
      en: 'Multi-track audio editing with waveform lanes, shared selection, 10-band equalizer, filters and WAV/MP3 mixdown.',
      ru: 'Многодорожечный редактор звука: волновые дорожки, общее выделение, 10-полосный эквалайзер, фильтры и экспорт микса в WAV/MP3.',
    },
    keywords: 'audio sound mp3 wav multitrack tracks mix equalizer eq filter trim fade normalize volume music',
    mount(root, ctx) {
      const error = errorSlot();
      let buffer: AudioBuffer | null = null;
      let baseName = 'audio';
      let start = 0;
      let end = 0;
      const tracks: AudioTrack[] = [];
      let activeTrackId = 0;
      let nextTrackId = 1;
      const trackColors = ['#60a5fa', '#34d399', '#f472b6', '#fbbf24', '#a78bfa', '#22d3ee'];
      let eq = new Array<number>(10).fill(0);
      let filterType: EqFilterType = 'none';
      let cutoff = 8000;
      let resonance = 1;
      let gainDb = 0;
      let fadeIn = 0;
      let fadeOut = 0;
      let normalize = false;
      let playing = false;
      let playStartedAt = 0;
      let activeSource: AudioBufferSourceNode | null = null;
      let activeSources: AudioBufferSourceNode[] = [];
      let animation = 0;
      let peaks: Array<{ min: number; max: number; rms?: number }> = [];
      let dragging = false;
      let dragAnchor = 0;
      let dragTrackId = 0;
      let handleDrag: 'start' | 'end' | null = null;
      let viewFrom = 0;
      let viewTo = 1;
      let exportFormat: 'wav' | 'mp3' = 'wav';
      let mp3Bitrate = 192;
      let tags: Id3Tags = emptyTags();
      let coverUrl = '';

      const audioContext = new AudioContext();
      const waveCanvas = h('canvas', { class: 'dt-audio-wave', width: WAVE_COLUMNS, height: 190 });
      const waveZoomLabel = h('span', { class: 'dt-timeline-zoom-label' }, '100%');
      const position = h('span', { class: 'dt-audio-time' }, '00:00.00');
      const durationLabel = h('span', { class: 'dt-audio-time' }, '00:00.00');
      const selectionStart = textInput({ type: 'number', value: 0, min: 0, step: 0.01, oninput: (value) => updateSelection(Number(value), end) });
      const selectionEnd = textInput({ type: 'number', value: 0, min: 0, step: 0.01, oninput: (value) => updateSelection(start, Number(value)) });
      const selectionInfo = h('div', { class: 'dt-hint' });
      const stats = h('div', { class: 'dt-stats' });
      const trackList = h('div', { class: 'dt-stack' });
      const eqControls = h('div', { class: 'dt-knob-grid' });
      const metadataHost = h('div', { class: 'dt-stack' });
      const coverInput = h('input', { type: 'file', accept: 'image/*', class: 'dt-hidden' });

      const timelineDuration = (): number => tracks.reduce((max, track) => Math.max(max, track.buffer.duration), 0);
      const activeTrack = (): AudioTrack | undefined => tracks.find((track) => track.id === activeTrackId);

      const computePeaksFor = (source: AudioBuffer): Array<{ min: number; max: number; rms: number }> => {
        const result: Array<{ min: number; max: number; rms: number }> = [];
        const channel = source.getChannelData(0);
        const block = Math.max(1, Math.floor(channel.length / WAVE_COLUMNS));
        for (let column = 0; column < WAVE_COLUMNS; column++) {
          let min = 0;
          let max = 0;
          let sum = 0;
          const from = column * block;
          const to = Math.min(channel.length, from + block);
          for (let index = from; index < to; index += 1) {
            const value = channel[index];
            if (value < min) min = value;
            if (value > max) max = value;
            sum += value * value;
          }
          result.push({ min, max, rms: to > from ? Math.sqrt(sum / (to - from)) : 0 });
        }
        return result;
      };

      const focusTrack = (id: number): void => {
        const track = tracks.find((item) => item.id === id);
        if (!track) return;
        activeTrackId = id;
        buffer = track.buffer;
        peaks = track.peaks;
        baseName = track.name;
        renderTracks();
        updateStats();
      };

      const selectTrack = (id: number): void => {
        const track = tracks.find((item) => item.id === id);
        if (!track) return;
        focusTrack(id);
        const total = timelineDuration();
        start = 0;
        end = total;
        selectionStart.value = '0';
        selectionEnd.value = total.toFixed(2);
        selectionInfo.textContent = `${ctx.pick('Selection', 'Выделение')}: ${total.toFixed(2)} ${ctx.pick('sec', 'сек')}`;
        position.textContent = formatTime(0);
        durationLabel.textContent = formatTime(total);
        drawWave();
        renderTracks();
      };

      const currentTimeInSelection = (): number => {
        if (!tracks.length) return 0;
        if (!playing) return start;
        return clamp(start + (audioContext.currentTime - playStartedAt), start, end);
      };

      const drawWave = (): void => {
        const context = waveCanvas.getContext('2d');
        if (!context) return;
        const width = waveCanvas.width;
        const laneHeight = tracks.length ? Math.max(64, Math.round(190 / tracks.length)) : 64;
        const height = Math.max(190, tracks.length * laneHeight);
        if (waveCanvas.height !== height) waveCanvas.height = height;
        context.clearRect(0, 0, width, height);
        context.fillStyle = '#d5d8dc';
        context.fillRect(0, 0, width, height);

        if (tracks.length) {
          const total = timelineDuration() || 1;
          const span = Math.max(0.0001, viewTo - viewFrom);
          const xOf = (seconds: number): number => ((seconds / total - viewFrom) / span) * width;
          const amplitude = laneHeight / 2 - 6;
          const levels = new Float32Array(width * 3);

          tracks.forEach((track, index) => {
            const top = index * laneHeight;
            const middle = top + laneHeight / 2;
            const active = track.id === activeTrackId;
            context.fillStyle = active ? '#e5e9ef' : index % 2 ? '#d0d4d9' : '#d9dcdf';
            context.fillRect(0, top, width, laneHeight);
            context.strokeStyle = 'rgba(139,145,156,0.65)';
            context.lineWidth = 1;
            context.beginPath();
            context.moveTo(0, top + laneHeight - 0.5);
            context.lineTo(width, top + laneHeight - 0.5);
            context.stroke();
            // Zero line.
            context.strokeStyle = 'rgba(30,58,138,0.28)';
            context.beginPath();
            context.moveTo(0, middle + 0.5);
            context.lineTo(width, middle + 0.5);
            context.stroke();

            const columns = track.peaks.length;
            const trackDuration = Math.max(0.0001, track.buffer.duration);
            const secondsPerColumn = (span * total) / width;
            // When zoomed in far enough, draw the real samples instead of the coarse peak table.
            const rawSamples =
              span * total * track.buffer.sampleRate <= 240_000 ? track.buffer.getChannelData(0) : null;
            const rawLength = track.buffer.length;
            levels.fill(0);
            for (let column = 0; column < width; column++) {
              const from = (viewFrom + (column / width) * span) * total;
              if (from >= trackDuration) break;
              const to = from + secondsPerColumn;
              if (to <= 0) continue;
              let min = 0;
              let max = 0;
              let rms = 0;
              if (rawSamples) {
                const firstSample = clamp(Math.round(Math.max(0, from) * track.buffer.sampleRate), 0, rawLength - 1);
                const lastSample = clamp(Math.round(Math.min(trackDuration, to) * track.buffer.sampleRate), firstSample + 1, rawLength);
                let sum = 0;
                for (let sample = firstSample; sample < lastSample; sample++) {
                  const value = rawSamples[sample];
                  if (value < min) min = value;
                  if (value > max) max = value;
                  sum += value * value;
                }
                rms = Math.sqrt(sum / Math.max(1, lastSample - firstSample));
              } else {
                const first = clamp(Math.floor((Math.max(0, from) / trackDuration) * columns), 0, columns - 1);
                const last = clamp(Math.ceil((Math.min(trackDuration, to) / trackDuration) * columns), first + 1, columns);
                for (let peakIndex = first; peakIndex < last; peakIndex++) {
                  const peak = track.peaks[peakIndex];
                  if (!peak) continue;
                  if (peak.min < min) min = peak.min;
                  if (peak.max > max) max = peak.max;
                  rms = Math.max(rms, peak.rms ?? (Math.abs(peak.min) + peak.max) / 4);
                }
              }
              levels[column * 3] = min * amplitude;
              levels[column * 3 + 1] = max * amplitude;
              levels[column * 3 + 2] = rms * amplitude;
            }

            // Peak envelope.
            context.strokeStyle = active ? '#1e3fa8' : '#3a549c';
            context.lineWidth = 1;
            context.beginPath();
            for (let column = 0; column < width; column++) {
              const min = levels[column * 3];
              const max = levels[column * 3 + 1];
              if (!min && !max) continue;
              context.moveTo(column + 0.5, middle - max);
              context.lineTo(column + 0.5, middle - min);
            }
            context.stroke();

            // Lighter RMS core in the middle of the waveform.
            context.strokeStyle = active ? 'rgba(86,132,250,0.9)' : 'rgba(86,132,250,0.7)';
            context.beginPath();
            for (let column = 0; column < width; column++) {
              const rms = levels[column * 3 + 2];
              if (!rms) continue;
              context.moveTo(column + 0.5, middle - rms);
              context.lineTo(column + 0.5, middle + rms);
            }
            context.stroke();

            context.fillStyle = active ? '#0f172a' : 'rgba(30,41,59,0.65)';
            context.font = '10px system-ui, sans-serif';
            context.textAlign = 'left';
            context.fillText(`${track.muted ? 'M ' : ''}${track.name}`, 6, top + 12);
          });

          const selFrom = xOf(start);
          const selTo = xOf(end);
          const shadedFrom = Math.max(0, selFrom);
          const shadedTo = Math.min(width, selTo);
          if (shadedTo > shadedFrom) {
            context.fillStyle = 'rgba(37,99,235,0.16)';
            context.fillRect(shadedFrom, 0, shadedTo - shadedFrom, height);
          }
          context.strokeStyle = '#1d4ed8';
          context.lineWidth = 2;
          for (const x of [selFrom, selTo]) {
            if (x < -8 || x > width + 8) continue;
            context.beginPath();
            context.moveTo(x, 0);
            context.lineTo(x, height);
            context.stroke();
          }
          context.fillStyle = '#1d4ed8';
          for (const x of [selFrom, selTo]) {
            if (x < -8 || x > width + 8) continue;
            context.fillRect(x - 3, 0, 6, 12);
            context.fillRect(x - 3, height - 12, 6, 12);
          }
          const playhead = xOf(currentTimeInSelection());
          if (playhead >= -8 && playhead <= width + 8) {
            context.strokeStyle = '#f97316';
            context.lineWidth = 1.5;
            context.beginPath();
            context.moveTo(playhead, 0);
            context.lineTo(playhead, height);
            context.stroke();
          }
        } else {
          context.fillStyle = 'rgba(30,41,59,0.55)';
          context.font = '13px system-ui, sans-serif';
          context.textAlign = 'center';
          context.fillText(ctx.pick('Load an audio file to begin', 'Загрузите аудиофайл, чтобы начать'), width / 2, height / 2);
        }
      };

      /** Zooms the waveform view around `anchor` (0..1 of the visible range). */
      const applyWaveZoom = (factor: number, anchor = 0.5): void => {
        const span = Math.max(0.0001, viewTo - viewFrom);
        const nextSpan = clamp(span / factor, 1 / 12, 1);
        if (Math.abs(nextSpan - span) < 0.0001) return;
        const anchorTime = viewFrom + anchor * span;
        viewFrom = clamp(anchorTime - anchor * nextSpan, 0, 1 - nextSpan);
        viewTo = viewFrom + nextSpan;
        waveZoomLabel.textContent = `${Math.round((1 / nextSpan) * 100)}%`;
        drawWave();
      };

      const resetWaveZoom = (): void => {
        viewFrom = 0;
        viewTo = 1;
        waveZoomLabel.textContent = '100%';
        drawWave();
      };

      // Ctrl+wheel zooms the waveform around the pointer.
      waveCanvas.addEventListener(
        'wheel',
        (event) => {
          if (!event.ctrlKey || !tracks.length) return;
          event.preventDefault();
          const rect = waveCanvas.getBoundingClientRect();
          const anchor = clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
          applyWaveZoom(event.deltaY < 0 ? 1.25 : 1 / 1.25, anchor);
        },
        { passive: false },
      );

      const updateSelection = (nextStart: number, nextEnd: number): void => {
        if (!tracks.length) return;
        const total = timelineDuration();
        const low = clamp(Math.min(nextStart, nextEnd), 0, total);
        const high = clamp(Math.max(nextStart, nextEnd), 0, total);
        start = low;
        end = Math.max(high, low + 0.01);
        selectionStart.value = start.toFixed(2);
        selectionEnd.value = end.toFixed(2);
        selectionInfo.textContent = `${ctx.pick('Selection', 'Выделение')}: ${(end - start).toFixed(2)} ${ctx.pick('sec', 'сек')}`;
        drawWave();
      };

      const stopPlayback = (): void => {
        for (const source of activeSources) {
          try {
            source.stop();
          } catch {
            // Already stopped.
          }
        }
        activeSources = [];
        activeSource = null;
        playing = false;
        position.textContent = formatTime(start);
        drawWave();
      };

      const buildChain = (
        context: BaseAudioContext,
        source: AudioNode,
        destination: AudioNode,
      ): void => {
        let chain: AudioNode = source;
        eq.forEach((value, index) => {
          const filter = context.createBiquadFilter();
          filter.type = 'peaking';
          filter.frequency.value = EQ_FREQUENCIES[index];
          filter.Q.value = 1;
          filter.gain.value = value;
          chain.connect(filter);
          chain = filter;
        });
        if (filterType !== 'none') {
          const filter = context.createBiquadFilter();
          filter.type = filterType;
          filter.frequency.value = cutoff;
          filter.Q.value = resonance;
          chain.connect(filter);
          chain = filter;
        }
        const gain = context.createGain();
        gain.gain.value = Math.pow(10, gainDb / 20);
        chain.connect(gain);
        gain.connect(destination);
      };

      const play = async (): Promise<void> => {
        if (!tracks.length) return;
        await audioContext.resume();
        stopPlayback();
        const master = audioContext.createGain();
        buildChain(audioContext, master, audioContext.destination);
        const soloActive = tracks.some((track) => track.solo);
        for (const track of tracks) {
          if (track.muted || (soloActive && !track.solo)) continue;
          const offset = Math.max(0, start);
          const duration = Math.min(track.buffer.duration - offset, end - start);
          if (duration <= 0.001) continue;
          const source = audioContext.createBufferSource();
          source.buffer = track.buffer;
          const gain = audioContext.createGain();
          gain.gain.value = track.volume;
          source.connect(gain);
          gain.connect(master);
          source.start(0, offset, duration);
          activeSources.push(source);
          if (!activeSource) activeSource = source;
        }
        playStartedAt = audioContext.currentTime;
        playing = true;
        const tick = (): void => {
          if (!playing) return;
          const time = currentTimeInSelection();
          position.textContent = formatTime(time);
          drawWave();
          if (time >= end - 0.01) {
            stopPlayback();
            return;
          }
          animation = requestAnimationFrame(tick);
        };
        cancelAnimationFrame(animation);
        animation = requestAnimationFrame(tick);
      };

      const updateStats = (): void => {
        if (!tracks.length) {
          stats.replaceChildren();
          return;
        }
        const current = activeTrack();
        const items: Array<[string, string | number]> = [
          [ctx.pick('Tracks', 'Дорожки'), tracks.length],
          [ctx.pick('Total', 'Всего'), formatTime(timelineDuration())],
          [ctx.pick('Active', 'Активная'), formatTime(current?.buffer.duration ?? 0)],
          [ctx.pick('Sample rate', 'Частота'), `${current?.buffer.sampleRate ?? 0} Hz`],
        ];
        stats.replaceChildren(
          ...items.map(([label, value]) =>
            h(
              'div',
              { class: 'dt-stat' },
              h('div', { class: 'dt-stat-value' }, String(value)),
              h('div', { class: 'dt-stat-label' }, label),
            ),
          ),
        );
      };

      const loadAudio = (file: File): void => {
        setError(error, null);
        const name = file.name.replace(/\.[^.]+$/, '') || 'audio';
        void readArrayBuffer(file)
          .then((data) => {
            if (!tracks.length) {
              const bytes = new Uint8Array(data.slice(0));
              tags = parseId3(bytes) ?? emptyTags();
              renderMetadata();
            }
            return audioContext.decodeAudioData(data);
          })
          .then((decoded) => {
            stopPlayback();
            const track: AudioTrack = {
              id: nextTrackId++,
              name,
              buffer: decoded,
              peaks: computePeaksFor(decoded),
              volume: 1,
              muted: false,
              solo: false,
              color: trackColors[(tracks.length) % trackColors.length],
            };
            tracks.push(track);
            if (!baseName || baseName === 'audio') baseName = name;
            selectTrack(track.id);
            updateStats();
            drawWave();
            renderTracks();
          })
          .catch(() =>
            setError(
              error,
              ctx.pick('Cannot decode this audio file in the webview.', 'Не удалось декодировать аудиофайл в webview.'),
            ),
          );
      };

      const upload = fileDrop({
        accept: 'audio/*',
        multiple: true,
        hint: ctx.pick('Drop audio files (MP3, WAV, OGG, M4A)', 'Перетащите аудиофайлы (MP3, WAV, OGG, M4A)'),
        onFiles: (files) => {
          for (const file of files) loadAudio(file);
        },
      });

      const trackInput = h('input', { type: 'file', accept: 'audio/*', multiple: true, class: 'dt-hidden' });
      trackInput.addEventListener('change', () => {
        for (const file of Array.from(trackInput.files ?? [])) loadAudio(file);
        trackInput.value = '';
      });

      const renderTracks = (): void => {
        trackList.replaceChildren();
        for (const track of tracks) {
          const volumeField = knobGrid(
            knobField(ctx.pick('Volume', 'Громкость'), 0, 100, Math.round(track.volume * 100), (value) => {
              track.volume = value / 100;
            }),
          );
          trackList.appendChild(
            h(
              'div',
              { class: `dt-stack ${track.id === activeTrackId ? 'is-active' : ''}` },
              h(
                'div',
                { class: 'dt-row' },
                h('span', { class: 'dt-ie-layer-name' }, track.name),
                btn('M', () => {
                  track.muted = !track.muted;
                  renderTracks();
                  drawWave();
                }, { variant: track.muted ? 'danger' : 'subtle' }),
                btn('S', () => {
                  track.solo = !track.solo;
                  renderTracks();
                  drawWave();
                }, { variant: track.solo ? 'primary' : 'subtle' }),
                btn('×', () => {
                  tracks.splice(tracks.indexOf(track), 1);
                  buffer = null;
                  peaks = [];
                  if (tracks.length) selectTrack(tracks[Math.max(0, tracks.length - 1)].id);
                  else {
                    activeTrackId = 0;
                    start = 0;
                    end = 0;
                    durationLabel.textContent = formatTime(0);
                  }
                  updateStats();
                  drawWave();
                  renderTracks();
                }, { variant: 'danger' }),
              ),
              volumeField,
            ),
          );
        }
        trackList.appendChild(
          toolbar(btn(ctx.pick('Add audio track', 'Добавить аудиодорожку'), () => trackInput.click(), { variant: 'ghost' })),
        );
      };

      const processChannels = async (): Promise<Float32Array[] | null> => {
        if (!tracks.length) return null;
        const sampleRate = tracks[0].buffer.sampleRate;
        const total = timelineDuration();
        const from = clamp(start, 0, total);
        const to = clamp(end, from + 0.01, total);
        const length = Math.max(1, Math.floor((to - from) * sampleRate));
        const offline = new OfflineAudioContext(2, length, sampleRate);
        const master = offline.createGain();
        buildChain(offline, master, offline.destination);
        const soloActive = tracks.some((track) => track.solo);
        for (const track of tracks) {
          if (track.muted || (soloActive && !track.solo)) continue;
          const playDuration = Math.min(track.buffer.duration - from, to - from);
          if (playDuration <= 0.001) continue;
          const source = offline.createBufferSource();
          source.buffer = track.buffer;
          const gain = offline.createGain();
          gain.gain.value = track.volume;
          source.connect(gain);
          gain.connect(master);
          source.start(0, from, playDuration);
        }
        const rendered = await offline.startRendering();
        const channels: Float32Array[] = [];
        for (let channel = 0; channel < rendered.numberOfChannels; channel++) {
          channels.push(new Float32Array(rendered.getChannelData(channel)));
        }
        const fadeInSamples = Math.floor(fadeIn * sampleRate);
        const fadeOutSamples = Math.floor(fadeOut * sampleRate);
        for (const samples of channels) {
          for (let index = 0; index < Math.min(fadeInSamples, samples.length); index++) {
            samples[index] *= index / Math.max(1, fadeInSamples);
          }
          for (let index = 0; index < Math.min(fadeOutSamples, samples.length); index++) {
            samples[samples.length - 1 - index] *= index / Math.max(1, fadeOutSamples);
          }
        }
        if (normalize) {
          let peak = 0;
          for (const samples of channels) {
            for (const value of samples) peak = Math.max(peak, Math.abs(value));
          }
          if (peak > 0) {
            const factor = 0.98 / peak;
            for (const samples of channels) {
              for (let index = 0; index < samples.length; index++) samples[index] *= factor;
            }
          }
        }
        return channels;
      };

      const exportAudio = async (): Promise<void> => {
        if (!tracks.length) return;
        try {
          const sampleRate = tracks[0].buffer.sampleRate;
          const channels = await processChannels();
          if (!channels) return;
          if (exportFormat === 'wav') {
            downloadBlob(`${baseName}-edited.wav`, encodeWav(channels, sampleRate));
            return;
          }
          const encoded = encodeMp3(channels, sampleRate, mp3Bitrate);
          if (!hasTags(tags)) {
            downloadBlob(`${baseName}-edited.mp3`, encoded);
            return;
          }
          const audioBytes = new Uint8Array(await encoded.arrayBuffer());
          const tagBytes = buildId3(tags);
          const merged = new Uint8Array(tagBytes.length + audioBytes.length);
          merged.set(tagBytes, 0);
          merged.set(audioBytes, tagBytes.length);
          downloadBlob(`${baseName}-edited.mp3`, new Blob([bytesToArrayBuffer(merged)], { type: 'audio/mpeg' }));
        } catch {
          setError(error, ctx.pick('Export failed.', 'Не удалось экспортировать аудио.'));
        }
      };

      let coverObjectUrl = '';

      const textField = (
        label: [string, string],
        key: 'title' | 'artist' | 'album' | 'year' | 'genre' | 'track' | 'comment',
      ): HTMLElement =>
        field(
          ctx.pick(label[0], label[1]),
          textInput({
            value: tags[key],
            oninput: (value) => {
              tags[key] = value;
            },
          }),
        );

      function renderMetadata(): void {
        metadataHost.replaceChildren();
        metadataHost.appendChild(
          h(
            'div',
            { class: 'dt-inline-form' },
            textField(['Title', 'Название'], 'title'),
            textField(['Artist', 'Исполнитель'], 'artist'),
          ),
        );
        metadataHost.appendChild(
          h(
            'div',
            { class: 'dt-inline-form' },
            textField(['Album', 'Альбом'], 'album'),
            textField(['Genre', 'Жанр'], 'genre'),
          ),
        );
        metadataHost.appendChild(
          h(
            'div',
            { class: 'dt-inline-form' },
            textField(['Year', 'Год'], 'year'),
            textField(['Track', 'Трек'], 'track'),
          ),
        );
        metadataHost.appendChild(textField(['Comment', 'Комментарий'], 'comment'));
        if (coverObjectUrl) URL.revokeObjectURL(coverObjectUrl);
        coverObjectUrl = '';
        const preview = h('img', { class: 'dt-ie-cover', alt: '' });
        if (tags.cover) {
          coverObjectUrl = URL.createObjectURL(new Blob([bytesToArrayBuffer(tags.cover.bytes)], { type: tags.cover.mime }));
          preview.src = coverObjectUrl;
        }
        metadataHost.appendChild(
          h(
            'div',
            { class: 'dt-inline-actions' },
            preview,
            btn(ctx.pick('Set cover', 'Загрузить обложку'), () => coverInput.click(), { variant: 'ghost' }),
            btn(
              ctx.pick('Clear cover', 'Убрать обложку'),
              () => {
                tags.cover = null;
                renderMetadata();
              },
              { variant: 'ghost' },
            ),
          ),
        );
        metadataHost.appendChild(
          note(
            ctx.pick(
              'Tags are written into exported MP3 files (ID3v2.4). WAV does not support tags.',
              'Теги записываются в экспортируемые MP3 (ID3v2.4). WAV не поддерживает теги.',
            ),
            'info',
          ),
        );
      }

      coverInput.addEventListener('change', () => {
        const file = coverInput.files?.[0];
        if (!file) return;
        void readArrayBuffer(file).then((data) => {
          tags.cover = { mime: file.type || 'image/jpeg', bytes: new Uint8Array(data.slice(0)) };
          renderMetadata();
        });
        coverInput.value = '';
      });
      const renderEq = (): void => {
        eqControls.replaceChildren(
          ...eq.map((value, index) =>
            knobField(EQ_LABELS[index], -12, 12, value, (next) => {
              eq[index] = next;
            }, { step: 1, defaultValue: 0, format: (next) => `${next} dB` }),
          ),
        );
      };
      renderEq();

      const playBtn = btn(ctx.pick('Play', 'Играть'), () => void play(), {
        variant: 'primary',
        icon: '<path d="M7 4v16l13 -8z"/>',
      });
      const stopBtn = btn(ctx.pick('Stop', 'Стоп'), stopPlayback, {
        variant: 'ghost',
        icon: '<path d="M4 4h16v16h-16z"/>',
      });

      waveCanvas.addEventListener('pointerdown', (event) => {
        if (!tracks.length) return;
        const rect = waveCanvas.getBoundingClientRect();
        const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
        const total = timelineDuration() || 1;
        const lane = clamp(Math.floor(((event.clientY - rect.top) / Math.max(1, rect.height)) * tracks.length), 0, tracks.length - 1);
        focusTrack(tracks[lane].id);
        const span = Math.max(0.0001, viewTo - viewFrom);
        const time = (viewFrom + ratio * span) * total;
        const pixel = ratio * WAVE_COLUMNS;
        const startPixel = ((start / total - viewFrom) / span) * WAVE_COLUMNS;
        const endPixel = ((end / total - viewFrom) / span) * WAVE_COLUMNS;
        waveCanvas.setPointerCapture(event.pointerId);
        if (Math.abs(pixel - startPixel) <= 8) {
          handleDrag = 'start';
          return;
        }
        if (Math.abs(pixel - endPixel) <= 8) {
          handleDrag = 'end';
          return;
        }
        dragging = true;
        dragAnchor = time;
        dragTrackId = tracks[lane].id;
        updateSelection(time, time + 0.01);
      });
      waveCanvas.addEventListener('pointermove', (event) => {
        if (!tracks.length) return;
        const rect = waveCanvas.getBoundingClientRect();
        const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
        const total = timelineDuration() || 1;
        const span = Math.max(0.0001, viewTo - viewFrom);
        const pixel = ratio * WAVE_COLUMNS;
        const startPixel = ((start / total - viewFrom) / span) * WAVE_COLUMNS;
        const endPixel = ((end / total - viewFrom) / span) * WAVE_COLUMNS;
        if (!dragging && !handleDrag) {
          waveCanvas.style.cursor =
            Math.abs(pixel - startPixel) <= 8 || Math.abs(pixel - endPixel) <= 8 ? 'ew-resize' : 'crosshair';
          return;
        }
        const time = (viewFrom + ratio * span) * total;
        if (handleDrag === 'start') updateSelection(time, end);
        else if (handleDrag === 'end') updateSelection(start, time);
        else if (dragging) updateSelection(dragAnchor, time);
      });
      waveCanvas.addEventListener('pointerup', (event) => {
        dragging = false;
        dragTrackId = 0;
        handleDrag = null;
        if (waveCanvas.hasPointerCapture(event.pointerId)) waveCanvas.releasePointerCapture(event.pointerId);
      });

      const exportPane = pane(
        ctx.pick('Export', 'Экспорт'),
        h(
          'div',
          { class: 'dt-stack' },
          field(
            ctx.pick('Format', 'Формат'),
            select(
              [
                { value: 'wav', label: 'WAV' },
                { value: 'mp3', label: 'MP3' },
              ],
              exportFormat,
              (value) => {
                exportFormat = value === 'mp3' ? 'mp3' : 'wav';
              },
            ),
          ),
          field(
            ctx.pick('MP3 bitrate', 'Битрейт MP3'),
            select(
              [
                { value: '128', label: '128 kbps' },
                { value: '192', label: '192 kbps' },
                { value: '320', label: '320 kbps' },
              ],
              String(mp3Bitrate),
              (value) => {
                mp3Bitrate = Number(value);
              },
            ),
          ),
          btn(ctx.pick('Download audio', 'Скачать аудио'), () => void exportAudio(), { variant: 'primary' }),
          note(
            ctx.pick(
              'Filters and fades are applied on export. MP3 encoding runs locally.',
              'Фильтры и затухания применяются при экспорте. Кодирование MP3 выполняется локально.',
            ),
            'info',
          ),
        ),
      );

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          error,
          upload,
          h(
            'div',
            { class: 'dt-toolbar' },
            playBtn,
            stopBtn,
            position,
            h('span', { class: 'dt-hint' }, '/'),
            durationLabel,
          ),
          pane(
            ctx.pick('Timeline', 'Таймлайн'),
            h('div', { class: 'dt-timeline-wide' }, waveCanvas),
            [
              btn('-', () => applyWaveZoom(1 / 1.5), {
                variant: 'subtle',
                title: ctx.pick('Zoom out (Ctrl+wheel)', 'Уменьшить масштаб (Ctrl+колесо)'),
              }),
              waveZoomLabel,
              btn('+', () => applyWaveZoom(1.5), {
                variant: 'subtle',
                title: ctx.pick('Zoom in (Ctrl+wheel)', 'Увеличить масштаб (Ctrl+колесо)'),
              }),
              iconBtn(
                '<path d="M4 9V4h5"/><path d="M20 9V4h-5"/><path d="M4 15v5h5"/><path d="M20 15v5h-5"/>',
                ctx.pick('Fit the whole duration', 'Вписать всю длительность'),
                resetWaveZoom,
                { variant: 'subtle' },
              ),
            ],
            '',
            { collapsible: false },
          ),
          stats,
          tabs([
            { id: 'tracks', label: ctx.pick('Tracks', 'Дорожки'), render: () => pane(ctx.pick('Tracks', 'Дорожки'), trackList) },
            {
              id: 'selection',
              label: ctx.pick('Selection', 'Выделение'),
              render: () => pane(
                ctx.pick('Selection', 'Выделение'),
                h(
                  'div',
                  { class: 'dt-stack' },
                  h(
                    'div',
                    { class: 'dt-ie-size-row' },
                    field(ctx.pick('Start, s', 'Начало, с'), selectionStart),
                    field(ctx.pick('End, s', 'Конец, с'), selectionEnd),
                  ),
                  selectionInfo,
                  toolbar(
                    btn(
                      ctx.pick('Select all', 'Выделить всё'),
                      () => updateSelection(0, timelineDuration()),
                      { variant: 'ghost' },
                    ),
                  ),
                ),
              ),
            },
            {
              id: 'eq',
              label: ctx.pick('Equalizer', 'Эквалайзер'),
              render: () => pane(
                ctx.pick('Equalizer', 'Эквалайзер'),
                h(
                  'div',
                  { class: 'dt-stack' },
                  eqControls,
                  btn(
                    ctx.pick('Reset EQ', 'Сбросить эквалайзер'),
                    () => {
                      eq = new Array<number>(10).fill(0);
                      renderEq();
                    },
                    { variant: 'ghost' },
                  ),
                ),
              ),
            },
            {
              id: 'filter',
              label: ctx.pick('Filter', 'Фильтр'),
              render: () => pane(
                ctx.pick('Filter', 'Фильтр'),
                h(
                  'div',
                  { class: 'dt-stack' },
                  field(
                    ctx.pick('Type', 'Тип'),
                    select(
                      [
                        { value: 'none', label: ctx.pick('None', 'Нет') },
                        { value: 'lowpass', label: ctx.pick('Low-pass', 'Низкие частоты') },
                        { value: 'highpass', label: ctx.pick('High-pass', 'Высокие частоты') },
                      ],
                      filterType,
                      (value) => {
                        filterType = value as EqFilterType;
                      },
                    ),
                  ),
                  knobGrid(
                    knobField(ctx.pick('Cutoff, Hz', 'Срез, Гц'), 40, 18000, cutoff, (value) => {
                      cutoff = value;
                    }, { step: 20 }),
                    knobField(ctx.pick('Resonance', 'Резонанс'), 1, 20, resonance, (value) => {
                      resonance = value;
                    }),
                  ),
                ),
              ),
            },
            {
              id: 'levels',
              label: ctx.pick('Levels', 'Уровни'),
              render: () => pane(
                ctx.pick('Levels', 'Уровни'),
                h(
                  'div',
                  { class: 'dt-stack' },
                  knobGrid(
                    knobField(ctx.pick('Gain, dB', 'Усиление, дБ'), -24, 24, gainDb, (value) => {
                      gainDb = value;
                    }),
                    knobField(ctx.pick('Fade in, s', 'Плавное начало, с'), 0, 10, fadeIn, (value) => {
                      fadeIn = value;
                    }, { step: 0.1 }),
                    knobField(ctx.pick('Fade out, s', 'Плавное затухание, с'), 0, 10, fadeOut, (value) => {
                      fadeOut = value;
                    }, { step: 0.1 }),
                  ),
                  checkbox(ctx.pick('Normalize', 'Нормализовать'), normalize, (value) => {
                    normalize = value;
                  }),
                ),
              ),
            },
            { id: 'metadata', label: ctx.pick('Metadata', 'Метаданные'), render: () => pane(ctx.pick('Metadata (ID3)', 'Метаданные (ID3)'), metadataHost) },
            { id: 'export', label: ctx.pick('Export', 'Экспорт'), render: () => exportPane },
          ]),
          h(
            'div',
            { class: 'dt-hint' },
            ctx.pick(
              'Drag on a track lane to select a shared time range. Playback and export mix all unmuted tracks; EQ, filter and fades are master effects.',
              'Потяните по дорожке, чтобы выделить общий диапазон. Воспроизведение и экспорт микшируют все включённые дорожки; эквалайзер, фильтр и затухания — мастер-эффекты.',
            ),
          ),
        ),
      );

      drawWave();
      renderMetadata();
      renderTracks();
      updateStats();
      root.appendChild(coverInput);
      root.appendChild(trackInput);
      const incoming = ctx.takeIncoming();
      if (incoming) loadAudio(incomingToFile(incoming));
    },
  });
}

export const audioEditorTools = [audioEditorTool()];
