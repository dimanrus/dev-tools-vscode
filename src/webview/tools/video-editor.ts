/** Video editor: trim, overlays (text, images, GIFs), music track and WebM export. */
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
  readDataUrl,
  readArrayBuffer,
  select,
  setError,
  split,
  tabs,
  textInput,
  toolbar,
} from '../components.ts';
import { clamp, h } from '../dom.ts';
import { incomingToBlob } from '../lib/incoming.ts';
import { defineTool } from '../tool-types.ts';

interface Overlay {
  id: number;
  kind: 'text' | 'image';
  name: string;
  text: string;
  image: HTMLImageElement | null;
  x: number;
  y: number;
  scale: number;
  fontSize: number;
  color: string;
  bold: boolean;
  opacity: number;
  start: number;
  end: number;
  trackId: number;
}

interface OverlayTrack {
  id: number;
  name: string;
  visible: boolean;
}

interface AudioTrack {
  id: number;
  name: string;
  element: HTMLAudioElement;
  gain: GainNode;
  volume: number;
  muted: boolean;
  start: number;
  duration: number;
  peaks: number[];
  loaded: boolean;
  color: string;
}

const formatClock = (seconds: number): string => {
  const value = Math.max(0, seconds);
  const minutes = Math.floor(value / 60);
  const rest = value - minutes * 60;
  return `${String(minutes).padStart(2, '0')}:${rest.toFixed(1).padStart(4, '0')}`;
};

function videoEditorTool(): ReturnType<typeof defineTool> {
  return defineTool({
    id: 'media-video-editor',
    group: 'media',
    icon: '<path d="M15 10l4.553 -2.069a1 1 0 0 1 1.447 .894v6.35a1 1 0 0 1 -1.447 .894l-4.553 -2.069v-4z"/><path d="M3 8a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z"/>',
    name: { en: 'Video Editor', ru: 'Видеоредактор' },
    desc: {
      en: 'Multi-track video editing: V/A lanes, trim, overlays, audio mixing, zoomable full-width timeline and WebM export.',
      ru: 'Многодорожечный видеоредактор: видео- и аудиодорожки, обрезка, наложения, микс звука, масштабируемый таймлайн на всю ширину и экспорт WebM.',
    },
    keywords: 'video mp4 mov webm gif trim timeline tracks overlays text image music audio mix zoom export',
    mount(root, ctx) {
      let nextOverlayId = 1;
      let trimStart = 0;
      let trimEnd = 0;
      let duration = 0;
      let playing = false;
      let selectedOverlay = 0;
      let overlays: Overlay[] = [];
      let fileName = 'video';
      let exportFrame = 0;
      let musicVolume = 0.8;
      let videoVolume = 1;
      let videoMuted = false;
      let zoom = 1;
      let nextTrackId = 2;
      const overlayTrackList: OverlayTrack[] = [{ id: 1, name: 'V2', visible: true }];
      let activeOverlayTrackId = 1;
      const audioTracks: AudioTrack[] = [];

      const error = errorSlot();
      const preview = h('canvas', { class: 'dt-video-canvas', width: 960, height: 540 });
      const stage = h('div', { class: 'dt-video-stage' }, preview);
      const timeLabel = h('span', { class: 'dt-audio-time' }, '00:00.0');
      const totalLabel = h('span', { class: 'dt-audio-time' }, '00:00.0');
      const trimStartInput = textInput({ type: 'number', value: 0, min: 0, step: 0.1 });
      const trimEndInput = textInput({ type: 'number', value: 0, min: 0, step: 0.1 });
      const overlayList = h('div', { class: 'dt-ie-layers' });
      const overlayInspector = h('div', { class: 'dt-stack' });
      const audioList = h('div', { class: 'dt-stack' });
      const timelineBody = h('div', { class: 'dt-video-timeline-body' });
      const playhead = h('div', { class: 'dt-video-playhead' });
      const timeline = h('div', { class: 'dt-video-timeline' }, timelineBody);
      const zoomLabel = h('span', { class: 'dt-hint' }, '100%');
      const progress = h('div', { class: 'dt-hint' });

      const video = document.createElement('video');
      video.playsInline = true;
      video.preload = 'auto';
      video.className = 'dt-hidden';
      const music = document.createElement('audio');
      music.loop = false;
      music.className = 'dt-hidden';
      const audioHost = h('div', { class: 'dt-hidden' });
      audioHost.appendChild(music);

      const audioContext = new AudioContext();
      const videoGain = audioContext.createGain();
      const musicGain = audioContext.createGain();
      const mix = audioContext.createGain();
      const streamDestination = audioContext.createMediaStreamDestination();
      try {
        const videoSource = audioContext.createMediaElementSource(video);
        videoSource.connect(videoGain);
      } catch {
        // Some codecs have no audio track; preview still works.
      }
      try {
        const musicSource = audioContext.createMediaElementSource(music);
        musicSource.connect(musicGain);
      } catch {
        // Ignore.
      }
      videoGain.gain.value = videoVolume;
      musicGain.gain.value = musicVolume;
      videoGain.connect(mix);
      musicGain.connect(mix);
      mix.connect(audioContext.destination);
      mix.connect(streamDestination);

      audioTracks.push({
        id: 1,
        name: ctx.pick('Audio 1', 'Аудио 1'),
        element: music,
        gain: musicGain,
        volume: musicVolume,
        muted: false,
        start: 0,
        duration: 0,
        peaks: [],
        loaded: false,
        color: '#22c55e',
      });

      const trackGain = (track: AudioTrack): void => {
        track.gain.gain.value = track.muted ? 0 : track.volume;
      };

      const syncAudioTracks = (time: number): void => {
        for (const track of audioTracks) {
          if (!track.loaded || track.duration <= 0) continue;
          const local = time - track.start;
          if (track.muted || local < 0 || local >= track.duration) {
            if (!track.element.paused) track.element.pause();
            continue;
          }
          if (Math.abs(track.element.currentTime - local) > 0.3) track.element.currentTime = local;
          if (track.element.paused) void track.element.play().catch(() => undefined);
        }
      };

      const pauseAudioTracks = (): void => {
        for (const track of audioTracks) track.element.pause();
      };

      const overlaysAt = (time: number): Overlay[] => {
        const visible = new Set(overlayTrackList.filter((track) => track.visible).map((track) => track.id));
        return overlays.filter((overlay) => visible.has(overlay.trackId) && time >= overlay.start && time <= overlay.end);
      };

      const drawOverlays = (context: CanvasRenderingContext2D, time: number): void => {
        for (const overlay of overlaysAt(time)) {
          context.save();
          context.globalAlpha = overlay.opacity;
          if (overlay.kind === 'text') {
            context.font = `${overlay.bold ? '700' : '400'} ${overlay.fontSize}px system-ui, "Segoe UI", sans-serif`;
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillStyle = overlay.color;
            context.fillText(overlay.text, overlay.x * preview.width, overlay.y * preview.height);
          } else if (overlay.image) {
            const width = overlay.scale * preview.width;
            const height = width * (overlay.image.naturalHeight / Math.max(1, overlay.image.naturalWidth));
            context.drawImage(
              overlay.image,
              overlay.x * preview.width - width / 2,
              overlay.y * preview.height - height / 2,
              width,
              height,
            );
          }
          context.restore();
        }
      };

      const drawFrame = (): void => {
        const context = preview.getContext('2d');
        if (!context) return;
        context.fillStyle = '#000000';
        context.fillRect(0, 0, preview.width, preview.height);
        if (video.videoWidth) {
          context.drawImage(video, 0, 0, preview.width, preview.height);
        }
        drawOverlays(context, video.currentTime || trimStart);
      };

      const drawPeaks = (canvas: HTMLCanvasElement, peaks: number[], color: string): void => {
        const context = canvas.getContext('2d');
        if (!context) return;
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = color;
        const middle = canvas.height / 2;
        for (let column = 0; column < canvas.width; column++) {
          const peak = peaks[Math.min(peaks.length - 1, Math.floor((column / canvas.width) * peaks.length))] ?? 0;
          const height = Math.max(1, peak * middle * 0.9);
          context.fillRect(column, middle - height, 1, height * 2);
        }
      };

      const trackHead = (label: string, active: boolean, ...controls: HTMLElement[]): HTMLElement =>
        h(
          'div',
          { class: `dt-video-head-row ${active ? 'is-active' : ''}` },
          h('span', { class: 'dt-video-track-label' }, label),
          ...controls,
        );

      const beginClipDrag = (
        event: PointerEvent,
        element: HTMLElement,
        inner: HTMLElement,
        applyDelta: (seconds: number) => void,
      ): void => {
        event.stopPropagation();
        event.preventDefault();
        const rect = inner.getBoundingClientRect();
        let lastX = event.clientX;
        const move = (moveEvent: PointerEvent): void => {
          const seconds = ((moveEvent.clientX - lastX) / Math.max(1, rect.width)) * (duration || 1);
          lastX = moveEvent.clientX;
          applyDelta(seconds);
        };
        const up = (): void => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          renderTimeline();
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up, { once: true });
      };

      const renderTimeline = (): void => {
        timelineBody.replaceChildren();
        const total = duration || 1;
        if (!duration) {
          timelineBody.appendChild(note(ctx.pick('Load a video to build the timeline.', 'Загрузите видео для таймлайна.'), 'info'));
          return;
        }
        const heads = h('div', { class: 'dt-video-heads' });
        heads.appendChild(h('div', { class: 'dt-video-head-spacer' }));
        const scroll = h('div', { class: 'dt-video-lanes-scroll' });
        const inner = h('div', { class: 'dt-video-lanes-inner' });
        inner.style.width = `${Math.max(1, zoom) * 100}%`;
        const ruler = h('div', { class: 'dt-video-ruler' });
        const ticks = Math.max(8, Math.round(8 * zoom));
        for (let index = 0; index <= ticks; index++) {
          const mark = h('span', { class: 'dt-video-tick' }, formatClock((total / ticks) * index));
          mark.style.left = `${(index / ticks) * 100}%`;
          ruler.appendChild(mark);
        }
        inner.appendChild(ruler);

        const baseLane = h('div', { class: 'dt-video-lane' });
        const baseClip = h('div', { class: 'dt-video-clip is-video', title: fileName }, fileName);
        baseClip.style.left = `${(trimStart / total) * 100}%`;
        baseClip.style.width = `${Math.max(0.5, ((trimEnd - trimStart) / total) * 100)}%`;
        const paintBase = (): void => {
          baseClip.style.left = `${(trimStart / total) * 100}%`;
          baseClip.style.width = `${Math.max(0.5, ((trimEnd - trimStart) / total) * 100)}%`;
        };
        for (const which of ['start', 'end'] as const) {
          const handle = h('div', {
            class: `dt-video-handle dt-video-handle-${which}`,
            title: which === 'start' ? ctx.pick('Trim start', 'Начало') : ctx.pick('Trim end', 'Конец'),
          });
          handle.addEventListener('pointerdown', (event) => {
            event.stopPropagation();
            event.preventDefault();
            const rect = inner.getBoundingClientRect();
            handle.setPointerCapture(event.pointerId);
            const move = (moveEvent: PointerEvent): void => {
              const time = clamp((moveEvent.clientX - rect.left) / Math.max(1, rect.width), 0, 1) * total;
              if (which === 'start') trimStart = clamp(time, 0, trimEnd - 0.1);
              else trimEnd = clamp(time, trimStart + 0.1, duration);
              trimStartInput.value = trimStart.toFixed(1);
              trimEndInput.value = trimEnd.toFixed(1);
              paintBase();
            };
            const up = (): void => {
              handle.removeEventListener('pointermove', move);
              handle.removeEventListener('pointerup', up);
              renderTimeline();
            };
            handle.addEventListener('pointermove', move);
            handle.addEventListener('pointerup', up);
          });
          baseClip.appendChild(handle);
        }
        baseLane.appendChild(baseClip);
        heads.appendChild(trackHead('V1', false));
        inner.appendChild(baseLane);

        for (const track of overlayTrackList) {
          const eye = iconBtn(
            track.visible ? '<path d="M2 12s3.5 -6 10 -6s10 6 10 6s-3.5 6 -10 6s-10 -6 -10 -6z"/><path d="M12 15a3 3 0 1 0 0 -6a3 3 0 0 0 0 6z"/>' : '<path d="M4 4l16 16"/><path d="M10.6 10.6a3 3 0 0 0 4.2 4.2"/>',
            ctx.pick('Show/hide track', 'Показать/скрыть дорожку'),
            () => {
              track.visible = !track.visible;
              renderTimeline();
              drawFrame();
            },
            { variant: 'subtle', class: 'dt-tree-eye' },
          );
          const trash = overlayTrackList.length > 1
            ? iconBtn(
                '<path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"/><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3"/>',
                ctx.pick('Delete track', 'Удалить дорожку'),
                () => {
                  overlayTrackList.splice(overlayTrackList.indexOf(track), 1);
                  overlays = overlays.filter((overlay) => overlay.trackId !== track.id);
                  activeOverlayTrackId = overlayTrackList[0]?.id ?? 1;
                  syncOverlayUi();
                },
                { variant: 'danger', class: 'dt-tree-eye' },
              )
            : h('span', { class: 'dt-tree-spacer' });
          const head = trackHead(track.name, track.id === activeOverlayTrackId, eye, trash);
          head.addEventListener('click', () => {
            activeOverlayTrackId = track.id;
            renderTimeline();
          });
          heads.appendChild(head);
          const lane = h('div', { class: `dt-video-lane ${track.id === activeOverlayTrackId ? 'is-active' : ''}` });
          for (const overlay of overlays.filter((item) => item.trackId === track.id)) {
            const block = h('div', {
              class: `dt-video-clip ${overlay.kind} ${overlay.id === selectedOverlay ? 'is-active' : ''}`,
              title: overlay.name,
            }, overlay.name);
            const paint = (): void => {
              block.style.left = `${(overlay.start / total) * 100}%`;
              block.style.width = `${Math.max(0.5, ((overlay.end - overlay.start) / total) * 100)}%`;
            };
            paint();
            block.addEventListener('pointerdown', (event) => {
              selectedOverlay = overlay.id;
              renderOverlayList();
              renderOverlayInspector();
              const start0 = overlay.start;
              const end0 = overlay.end;
              beginClipDrag(event, block, inner, (seconds) => {
                const length = end0 - start0;
                overlay.start = clamp(start0 + seconds, 0, Math.max(0, total - length));
                overlay.end = overlay.start + length;
                paint();
              });
            });
            for (const which of ['start', 'end'] as const) {
              const handle = h('div', { class: `dt-video-handle dt-video-handle-${which}` });
              handle.addEventListener('pointerdown', (event) => {
                const start0 = overlay.start;
                const end0 = overlay.end;
                beginClipDrag(event, handle, inner, (seconds) => {
                  if (which === 'start') overlay.start = clamp(start0 + seconds, 0, end0 - 0.1);
                  else overlay.end = clamp(end0 + seconds, start0 + 0.1, total);
                  paint();
                });
              });
              block.appendChild(handle);
            }
            lane.appendChild(block);
          }
          inner.appendChild(lane);
        }

        const originalHead = trackHead(
          'A1',
          false,
          btn('M', (event) => {
            event.stopPropagation();
            videoMuted = !videoMuted;
            videoGain.gain.value = videoMuted ? 0 : videoVolume;
            renderTimeline();
          }, { variant: videoMuted ? 'danger' : 'subtle', class: 'dt-video-mini-btn' }),
        );
        heads.appendChild(originalHead);
        const originalLane = h('div', { class: 'dt-video-lane is-audio' });
        const originalClip = h('div', { class: 'dt-video-clip is-audio-original' }, ctx.pick('Original audio', 'Звук видео'));
        originalClip.style.left = `${(trimStart / total) * 100}%`;
        originalClip.style.width = `${Math.max(0.5, ((trimEnd - trimStart) / total) * 100)}%`;
        originalLane.appendChild(originalClip);
        inner.appendChild(originalLane);

        for (const track of audioTracks) {
          const trackIndex = audioTracks.indexOf(track);
          const mute = btn('M', (event) => {
            event.stopPropagation();
            track.muted = !track.muted;
            trackGain(track);
            renderTimeline();
            renderAudioList();
          }, { variant: track.muted ? 'danger' : 'subtle', class: 'dt-video-mini-btn' });
          const trash = iconBtn(
            '<path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"/><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3"/>',
            ctx.pick('Delete audio track', 'Удалить аудиодорожку'),
            () => {
              track.element.pause();
              audioTracks.splice(audioTracks.indexOf(track), 1);
              renderTimeline();
              renderAudioList();
            },
            { variant: 'danger', class: 'dt-tree-eye' },
          );
          heads.appendChild(trackHead(`A${trackIndex + 2}`, false, mute, trash));
          const lane = h('div', { class: 'dt-video-lane is-audio' });
          const length = track.loaded ? Math.min(track.duration, Math.max(0.1, total - track.start)) : 0;
          if (length > 0.01) {
            const block = h('div', { class: 'dt-video-clip is-audio', title: track.name }, track.name);
            const canvas = h('canvas', { class: 'dt-video-audio-peaks', width: 320, height: 26 });
            block.appendChild(canvas);
            const paint = (): void => {
              block.style.left = `${(track.start / total) * 100}%`;
              block.style.width = `${Math.max(0.5, (Math.min(track.duration, total - track.start) / total) * 100)}%`;
            };
            paint();
            block.addEventListener('pointerdown', (event) => {
              pause();
              const start0 = track.start;
              beginClipDrag(event, block, inner, (seconds) => {
                track.start = clamp(start0 + seconds, 0, Math.max(0, total - 0.1));
                paint();
              });
            });
            for (const which of ['start', 'end'] as const) {
              const handle = h('div', { class: `dt-video-handle dt-video-handle-${which}` });
              handle.addEventListener('pointerdown', (event) => {
                pause();
                const start0 = track.start;
                const duration0 = track.duration;
                beginClipDrag(event, handle, inner, (seconds) => {
                  if (which === 'start') {
                    const nextStart = clamp(start0 + seconds, 0, start0 + duration0 - 0.1);
                    track.duration = duration0 - (nextStart - start0);
                    track.start = nextStart;
                  } else {
                    track.duration = clamp(duration0 + seconds, 0.1, total - start0);
                  }
                  paint();
                });
              });
              block.appendChild(handle);
            }
            lane.appendChild(block);
            queueMicrotask(() => drawPeaks(canvas, track.peaks, 'rgba(187,247,208,0.85)'));
          }
          inner.appendChild(lane);
        }

        inner.appendChild(playhead);
        timelineBody.append(heads, scroll);
        scroll.appendChild(inner);
        updatePlayhead();
      };

      const updatePlayhead = (): void => {
        const total = duration || 1;
        playhead.style.left = `${(clamp(video.currentTime || trimStart, 0, total) / total) * 100}%`;
        timeLabel.textContent = formatClock(video.currentTime || trimStart);
      };

      const seek = (time: number): void => {
        if (!video.src) return;
        video.currentTime = clamp(time, trimStart, trimEnd);
        updatePlayhead();
        drawFrame();
      };

      const pause = (): void => {
        playing = false;
        cancelAnimationFrame(exportFrame);
        if (!video.paused) video.pause();
        pauseAudioTracks();
        playBtn.classList.remove('is-active');
        playBtn.querySelector('.dt-btn-label')!.textContent = ctx.pick('Play', 'Играть');
      };

      const tick = (): void => {
        if (!playing) return;
        drawFrame();
        updatePlayhead();
        syncAudioTracks(video.currentTime);
        if (video.currentTime >= trimEnd - 0.01) {
          pause();
          seek(trimEnd);
          return;
        }
        exportFrame = requestAnimationFrame(tick);
      };

      const play = async (): Promise<void> => {
        if (!video.src) {
          setError(error, ctx.pick('Load a video first.', 'Сначала загрузите видео.'));
          return;
        }
        await audioContext.resume();
        if (video.currentTime < trimStart || video.currentTime >= trimEnd - 0.02) {
          video.currentTime = trimStart;
        }
        playing = true;
        playBtn.classList.add('is-active');
        playBtn.querySelector('.dt-btn-label')!.textContent = ctx.pick('Pause', 'Пауза');
        await video.play();
        syncAudioTracks(video.currentTime);
        cancelAnimationFrame(exportFrame);
        exportFrame = requestAnimationFrame(tick);
      };

      const playBtn = btn(ctx.pick('Play', 'Играть'), () => {
        if (playing) pause();
        else void play();
      }, {
        variant: 'primary',
        icon: '<path d="M7 4v16l13 -8z"/>',
      });

      const syncOverlayInputs = (): void => {
        trimStartInput.value = trimStart.toFixed(1);
        trimEndInput.value = trimEnd.toFixed(1);
      };

      const applyTrim = (start: number, end: number): void => {
        if (!duration) return;
        trimStart = clamp(start, 0, Math.max(0, end - 0.1));
        trimEnd = clamp(end, trimStart + 0.1, duration);
        syncOverlayInputs();
        renderTimeline();
      };

      trimStartInput.addEventListener('change', () => applyTrim(Number(trimStartInput.value), trimEnd));
      trimEndInput.addEventListener('change', () => applyTrim(trimStart, Number(trimEndInput.value)));

      // ---------- overlay management ----------
      const selected = (): Overlay | undefined => overlays.find((overlay) => overlay.id === selectedOverlay);

      const selectOverlay = (id: number): void => {
        selectedOverlay = id;
        renderOverlayList();
        renderOverlayInspector();
        renderTimeline();
      };

      const addTextOverlay = (): void => {
        if (!duration) {
          setError(error, ctx.pick('Load a video first.', 'Сначала загрузите видео.'));
          return;
        }
        const start = clamp(video.currentTime || trimStart, trimStart, trimEnd);
        overlays.push({
          id: nextOverlayId++,
          kind: 'text',
          name: `${ctx.pick('Text', 'Текст')} ${overlays.length + 1}`,
          text: ctx.pick('Your text', 'Ваш текст'),
          image: null,
          x: 0.5,
          y: 0.82,
          scale: 0.3,
          fontSize: Math.round(preview.height / 14),
          color: '#ffffff',
          bold: true,
          opacity: 1,
          start,
          end: Math.min(trimEnd, start + 3),
          trackId: activeOverlayTrackId,
        });
        selectedOverlay = overlays[overlays.length - 1].id;
        syncOverlayUi();
      };

      const addImageOverlay = (file: File): void => {
        if (!duration) {
          setError(error, ctx.pick('Load a video first.', 'Сначала загрузите видео.'));
          return;
        }
        void readDataUrl(file)
          .then(
            (dataUrl) =>
              new Promise<HTMLImageElement>((resolve, reject) => {
                const element = new Image();
                element.onload = () => resolve(element);
                element.onerror = () => reject(new Error('image'));
                element.src = dataUrl;
              }),
          )
          .then((element) => {
            const start = clamp(video.currentTime || trimStart, trimStart, trimEnd);
            overlays.push({
              id: nextOverlayId++,
              kind: 'image',
              name: file.name.replace(/\.[^.]+$/, '') || `${ctx.pick('Image', 'Изображение')} ${overlays.length + 1}`,
              text: '',
              image: element,
              x: 0.5,
              y: 0.5,
              scale: 0.35,
              fontSize: 48,
              color: '#ffffff',
              bold: false,
              opacity: 1,
              start,
              end: Math.min(trimEnd, start + 3),
              trackId: activeOverlayTrackId,
            });
            selectedOverlay = overlays[overlays.length - 1].id;
            syncOverlayUi();
          })
          .catch(() => setError(error, ctx.pick('Cannot read this image.', 'Не удалось прочитать изображение.')));
      };

      const deleteOverlay = (): void => {
        overlays = overlays.filter((overlay) => overlay.id !== selectedOverlay);
        selectedOverlay = overlays[overlays.length - 1]?.id ?? 0;
        syncOverlayUi();
      };

      const duplicateOverlay = (): void => {
        const overlay = selected();
        if (!overlay) return;
        const copy: Overlay = { ...overlay, id: nextOverlayId++, name: `${overlay.name} ${ctx.pick('copy', 'копия')}`, y: clamp(overlay.y + 0.08, 0, 1) };
        overlays.push(copy);
        selectedOverlay = copy.id;
        syncOverlayUi();
      };

      const syncOverlayUi = (): void => {
        renderOverlayList();
        renderOverlayInspector();
        renderTimeline();
        drawFrame();
      };

      const renderOverlayList = (): void => {
        overlayList.replaceChildren();
        for (let index = overlays.length - 1; index >= 0; index--) {
          const overlay = overlays[index];
          overlayList.appendChild(
            h(
              'div',
              { class: `dt-ie-layer-row ${overlay.id === selectedOverlay ? 'is-active' : ''}` },
              h(
                'button',
                { class: 'dt-ie-layer', type: 'button', onclick: () => selectOverlay(overlay.id) },
                h('span', { class: 'dt-ie-layer-name' }, overlay.name),
                h('span', { class: 'dt-ie-layer-kind' }, overlay.kind === 'text' ? 'TEXT' : 'IMAGE'),
              ),
            ),
          );
        }
        if (!overlays.length) {
          overlayList.appendChild(note(ctx.pick('No overlays yet.', 'Наложений пока нет.'), 'info'));
        }
      };

      const renderOverlayInspector = (): void => {
        overlayInspector.replaceChildren();
        const overlay = selected();
        if (!overlay) {
          overlayInspector.appendChild(
            note(ctx.pick('Add a text, image or GIF overlay to edit it.', 'Добавьте текстовое, графическое или GIF-наложение.'), 'info'),
          );
          return;
        }
        overlayInspector.appendChild(
          h(
            'div',
            { class: 'dt-row dt-ie-inspector-head' },
            badge(overlay.kind === 'text' ? ctx.pick('Text', 'Текст') : ctx.pick('Image', 'Изображение')),
            h('span', { class: 'dt-ie-layer-title' }, overlay.name),
          ),
        );
        const knobs: HTMLElement[] = [];
        if (overlay.kind === 'text') {
          const content = textInput({
            value: overlay.text,
            oninput: (value) => {
              overlay.text = value;
              drawFrame();
            },
          });
          overlayInspector.appendChild(field(ctx.pick('Text', 'Текст'), content));
          const color = h('input', { type: 'color', class: 'dt-color-input', value: overlay.color });
          color.addEventListener('input', () => {
            overlay.color = color.value;
            drawFrame();
          });
          overlayInspector.appendChild(field(ctx.pick('Color', 'Цвет'), color));
          knobs.push(
            knobField(ctx.pick('Font size', 'Размер шрифта'), 12, 200, overlay.fontSize, (value) => {
              overlay.fontSize = value;
              drawFrame();
            }),
          );
          overlayInspector.appendChild(
            checkbox(ctx.pick('Bold', 'Жирный'), overlay.bold, (value) => {
              overlay.bold = value;
              drawFrame();
            }),
          );
        } else {
          knobs.push(
            knobField(ctx.pick('Size', 'Размер'), 5, 100, Math.round(overlay.scale * 100), (value) => {
              overlay.scale = value / 100;
              drawFrame();
            }),
          );
        }
        knobs.push(
          knobField(ctx.pick('Position X', 'Позиция X'), 0, 100, Math.round(overlay.x * 100), (value) => {
            overlay.x = value / 100;
            drawFrame();
          }),
        );
        knobs.push(
          knobField(ctx.pick('Position Y', 'Позиция Y'), 0, 100, Math.round(overlay.y * 100), (value) => {
            overlay.y = value / 100;
            drawFrame();
          }),
        );
        knobs.push(
          knobField(ctx.pick('Opacity', 'Прозрачность'), 0, 100, Math.round(overlay.opacity * 100), (value) => {
            overlay.opacity = value / 100;
            drawFrame();
          }),
        );
        overlayInspector.appendChild(knobGrid(...knobs));
        overlayInspector.appendChild(
          h(
            'div',
            { class: 'dt-inline-form' },
            field(
              ctx.pick('Start, s', 'Начало, с'),
              textInput({
                type: 'number',
                value: Number(overlay.start.toFixed(1)),
                step: 0.1,
                oninput: (value) => {
                  overlay.start = clamp(Number(value) || 0, 0, overlay.end - 0.1);
                  renderTimeline();
                  drawFrame();
                },
              }),
            ),
            field(
              ctx.pick('End, s', 'Конец, с'),
              textInput({
                type: 'number',
                value: Number(overlay.end.toFixed(1)),
                step: 0.1,
                oninput: (value) => {
                  overlay.end = clamp(Number(value) || 0, overlay.start + 0.1, duration || overlay.start + 1);
                  renderTimeline();
                  drawFrame();
                },
              }),
            ),
          ),
        );
        overlayInspector.appendChild(
          toolbar(
            iconBtn(
              '<path d="M7 7m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z"/><path d="M5 15v-8a2 2 0 0 1 2 -2h8"/>',
              ctx.pick('Duplicate overlay', 'Дублировать наложение'),
              duplicateOverlay,
              { variant: 'subtle' },
            ),
            iconBtn(
              '<path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"/><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3"/>',
              ctx.pick('Delete overlay', 'Удалить наложение'),
              deleteOverlay,
              { variant: 'danger' },
            ),
          ),
        );
      };

      // ---------- loading ----------
      const loadVideoSource = (name: string, url: string): void => {
        setError(error, null);
        pause();
        if (video.src.startsWith('blob:')) URL.revokeObjectURL(video.src);
        fileName = name || 'video';
        exportFrame = 0;
        video.src = url;
        video.load();
      };

      const loadVideo = (file: File): void => {
        loadVideoSource(file.name.replace(/\.[^.]+$/, ''), URL.createObjectURL(file));
      };

      video.addEventListener('loadedmetadata', () => {
        duration = video.duration || 0;
        trimStart = 0;
        trimEnd = duration;
        overlays = [];
        selectedOverlay = 0;
        const aspect = video.videoHeight / Math.max(1, video.videoWidth);
        preview.width = 960;
        preview.height = Math.max(1, Math.round(960 * aspect));
        syncOverlayInputs();
        totalLabel.textContent = formatClock(duration);
        renderTimeline();
        syncOverlayUi();
        seek(0);
      });

      video.addEventListener('error', () => {
        setError(error, ctx.pick('This video codec is not supported by the webview.', 'Кодек этого видео не поддерживается в webview.'));
      });

      video.addEventListener('timeupdate', () => {
        updatePlayhead();
      });

      video.addEventListener('seeked', () => {
        drawFrame();
      });

      const videoInput = h('input', { type: 'file', accept: 'video/*', class: 'dt-hidden' });
      videoInput.addEventListener('change', () => {
        const file = videoInput.files?.[0];
        if (file) loadVideo(file);
        videoInput.value = '';
      });

      const imageInput = h('input', { type: 'file', accept: 'image/*', class: 'dt-hidden' });
      imageInput.addEventListener('change', () => {
        const file = imageInput.files?.[0];
        if (file) addImageOverlay(file);
        imageInput.value = '';
      });

      const audioTrackInput = h('input', { type: 'file', accept: 'audio/*', multiple: true, class: 'dt-hidden' });

      const computeTrackPeaks = (buffer: AudioBuffer): number[] => {
        const channel = buffer.getChannelData(0);
        const columns = 320;
        const block = Math.max(1, Math.floor(channel.length / columns));
        const peaks: number[] = [];
        for (let column = 0; column < columns; column++) {
          let peak = 0;
          const from = column * block;
          const to = Math.min(channel.length, from + block);
          for (let index = from; index < to; index += 1) peak = Math.max(peak, Math.abs(channel[index]));
          peaks.push(peak);
        }
        return peaks;
      };

      const addAudioFiles = (files: File[]): void => {
        if (!duration) {
          setError(error, ctx.pick('Load a video first.', 'Сначала загрузите видео.'));
          return;
        }
        for (const file of files) {
          let track = audioTracks.find((item) => !item.element.src);
          if (!track) {
            const element = document.createElement('audio');
            element.className = 'dt-hidden';
            audioHost.appendChild(element);
            const gain = audioContext.createGain();
            gain.connect(mix);
            try {
              const source = audioContext.createMediaElementSource(element);
              source.connect(gain);
            } catch {
              // Ignore codec issues; the element can still play through the mix.
            }
            track = {
              id: nextTrackId++,
              name: `${ctx.pick('Audio', 'Аудио')} ${audioTracks.length + 1}`,
              element,
              gain,
              volume: 0.8,
              muted: false,
              start: 0,
              duration: 0,
              peaks: [],
              loaded: false,
              color: '#22c55e',
            };
            audioTracks.push(track);
          }
          if (track.element.src.startsWith('blob:')) URL.revokeObjectURL(track.element.src);
          track.name = file.name.replace(/\.[^.]+$/, '') || track.name;
          track.loaded = false;
          track.start = 0;
          track.duration = 0;
          track.peaks = [];
          track.element.src = URL.createObjectURL(file);
          track.element.load();
          track.element.onloadedmetadata = () => {
            track!.duration = clamp(track!.element.duration || 0.1, 0.1, duration);
            track!.loaded = true;
            trackGain(track!);
            renderTimeline();
            renderAudioList();
          };
          void readArrayBuffer(file)
            .then((data) => audioContext.decodeAudioData(data))
            .then((buffer) => {
              track!.peaks = computeTrackPeaks(buffer);
              renderTimeline();
            })
            .catch(() => undefined);
        }
        setError(error, null);
      };

      audioTrackInput.addEventListener('change', () => {
        addAudioFiles(Array.from(audioTrackInput.files ?? []));
        audioTrackInput.value = '';
      });

      const renderAudioList = (): void => {
        audioList.replaceChildren();
        audioList.appendChild(
          h(
            'div',
            { class: 'dt-row' },
            h('span', { class: 'dt-ie-layer-name' }, ctx.pick('Original audio', 'Звук видео')),
            btn('M', () => {
              videoMuted = !videoMuted;
              videoGain.gain.value = videoMuted ? 0 : videoVolume;
              renderAudioList();
              renderTimeline();
            }, { variant: videoMuted ? 'danger' : 'subtle' }),
          ),
        );
        audioList.appendChild(
          knobGrid(
            knobField(ctx.pick('Original volume', 'Громкость оригинала'), 0, 100, Math.round(videoVolume * 100), (value) => {
              videoVolume = value / 100;
              if (!videoMuted) videoGain.gain.value = videoVolume;
            }),
          ),
        );
        for (const track of audioTracks) {
          audioList.appendChild(
            h(
              'div',
              { class: 'dt-stack' },
              h(
                'div',
                { class: 'dt-row' },
                h('span', { class: 'dt-ie-layer-name' }, track.name),
                btn('M', () => {
                  track.muted = !track.muted;
                  trackGain(track);
                  renderAudioList();
                  renderTimeline();
                }, { variant: track.muted ? 'danger' : 'subtle' }),
                iconBtn(
                  '<path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"/><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3"/>',
                  ctx.pick('Delete audio track', 'Удалить аудиодорожку'),
                  () => {
                    track.element.pause();
                    audioTracks.splice(audioTracks.indexOf(track), 1);
                    renderAudioList();
                    renderTimeline();
                  },
                  { variant: 'danger' },
                ),
              ),
              knobGrid(
                knobField(ctx.pick('Volume', 'Громкость'), 0, 100, Math.round(track.volume * 100), (value) => {
                  track.volume = value / 100;
                  trackGain(track);
                }),
              ),
            ),
          );
        }
        audioList.appendChild(
          toolbar(
            btn(ctx.pick('Add audio track', 'Добавить аудиодорожку'), () => audioTrackInput.click(), { variant: 'ghost' }),
          ),
        );
      };

      const videoDrop = fileDrop({
        accept: 'video/*',
        hint: ctx.pick('Drop a video (MP4, MOV, WebM)', 'Перетащите видео (MP4, MOV, WebM)'),
        onFiles: (files) => {
          if (files[0]) loadVideo(files[0]);
        },
      });

      // ---------- timeline interactions ----------
      const timeFromEvent = (event: PointerEvent): number => {
        const inner = timelineBody.querySelector<HTMLElement>('.dt-video-lanes-inner');
        if (!inner) return 0;
        const rect = inner.getBoundingClientRect();
        const ratio = clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
        return ratio * (duration || 1);
      };

      timelineBody.addEventListener('pointerdown', (event) => {
        if (!duration) return;
        const target = event.target as HTMLElement;
        if (target.closest('.dt-video-handle') || target.closest('.dt-video-clip') || target.closest('.dt-video-head-row')) return;
        if (!target.closest('.dt-video-lane')) return;
        pause();
        seek(timeFromEvent(event));
      });

      // ---------- export ----------
      const exportVideo = async (): Promise<void> => {
        if (!duration) {
          setError(error, ctx.pick('Load a video first.', 'Сначала загрузите видео.'));
          return;
        }
        if (typeof MediaRecorder === 'undefined') {
          setError(error, ctx.pick('MediaRecorder is not available in this webview.', 'MediaRecorder недоступен в этом webview.'));
          return;
        }
        try {
          await audioContext.resume();
          pause();
          video.currentTime = trimStart;
          await new Promise<void>((resolve) => {
            const done = (): void => {
              video.removeEventListener('seeked', done);
              resolve();
            };
            video.addEventListener('seeked', done);
            setTimeout(done, 600);
          });
          const canvasStream = preview.captureStream(30);
          const tracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];
          tracks.push(...streamDestination.stream.getAudioTracks());
          const stream = new MediaStream(tracks);
          const mime =
            ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((type) =>
              MediaRecorder.isTypeSupported(type),
            ) ?? 'video/webm';
          const chunks: BlobPart[] = [];
          const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
          recorder.ondataavailable = (event) => {
            if (event.data.size) chunks.push(event.data);
          };
          const stopped = new Promise<void>((resolve) => {
            recorder.onstop = () => resolve();
          });
          progress.textContent = ctx.pick('Recording…', 'Запись…');
          recorder.start(250);
          playing = true;
          await video.play();
          syncAudioTracks(video.currentTime);
          await new Promise<void>((resolve) => {
            const step = (): void => {
              drawFrame();
              updatePlayhead();
              syncAudioTracks(video.currentTime);
              if (video.currentTime >= trimEnd - 0.03 || video.ended) {
                resolve();
                return;
              }
              exportFrame = requestAnimationFrame(step);
            };
            step();
          });
          cancelAnimationFrame(exportFrame);
          video.pause();
          pauseAudioTracks();
          playing = false;
          recorder.stop();
          await stopped;
          progress.textContent = ctx.pick('Done', 'Готово');
          downloadBlob(`${fileName}-edited.webm`, new Blob(chunks, { type: mime }));
        } catch {
          setError(error, ctx.pick('Video export failed.', 'Не удалось экспортировать видео.'));
        }
      };

      const audioPane = pane(
        ctx.pick('Audio tracks', 'Аудиодорожки'),
        audioList,
      );

      const exportPane = pane(
        ctx.pick('Export', 'Экспорт'),
        h(
          'div',
          { class: 'dt-stack' },
          btn(ctx.pick('Export WebM', 'Экспортировать WebM'), () => void exportVideo(), {
            variant: 'primary',
            icon: '<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2"/><path d="M7 11l5 5l5 -5"/><path d="M12 4l0 12"/>',
          }),
          progress,
          note(
            ctx.pick(
              'Recording happens in real time. The webview exports WebM (VP9/VP8 + Opus); MP4 is not available in the browser encoder.',
              'Запись идёт в реальном времени. Webview экспортирует WebM (VP9/VP8 + Opus); кодирование MP4 в браузере недоступно.',
            ),
            'info',
          ),
        ),
      );

      const setZoom = (next: number): void => {
        zoom = clamp(next, 1, 4);
        zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
        renderTimeline();
      };

      // Ctrl+wheel zooms the timeline around the pointer.
      timeline.addEventListener(
        'wheel',
        (event) => {
          if (!event.ctrlKey) return;
          const inner = timeline.querySelector<HTMLElement>('.dt-video-lanes-inner');
          const scroll = timeline.querySelector<HTMLElement>('.dt-video-lanes-scroll');
          if (!inner || !scroll) return;
          event.preventDefault();
          const pointer = event.clientX - inner.getBoundingClientRect().left;
          const previous = inner.offsetWidth || 1;
          const factor = event.deltaY < 0 ? 1.25 : 1 / 1.25;
          const next = clamp(zoom * factor, 1, 4);
          if (next === zoom) return;
          setZoom(next);
          const updated = timeline.querySelector<HTMLElement>('.dt-video-lanes-inner');
          const updatedScroll = timeline.querySelector<HTMLElement>('.dt-video-lanes-scroll');
          if (updated && updatedScroll) {
            const viewportPointer = event.clientX - updatedScroll.getBoundingClientRect().left;
            updatedScroll.scrollLeft = (pointer / previous) * (updated.offsetWidth || 1) - viewportPointer;
          }
        },
        { passive: false },
      );

      const addOverlayTrack = (): void => {
        const id = nextTrackId++;
        overlayTrackList.push({ id, name: `V${overlayTrackList.length + 2}`, visible: true });
        activeOverlayTrackId = id;
        renderTimeline();
      };

      root.append(
        h(
          'div',
          { class: 'dt-stack' },
          error,
          videoDrop,
          split(
            h(
              'div',
              { class: 'dt-col' },
              h(
                'div',
                { class: 'dt-toolbar' },
                playBtn,
                btn(ctx.pick('Load video', 'Загрузить видео'), () => videoInput.click(), { variant: 'ghost' }),
                timeLabel,
                h('span', { class: 'dt-hint' }, '/'),
                totalLabel,
              ),
              pane(ctx.pick('Preview', 'Предпросмотр'), stage, [], '', { collapsible: false }),
            ),
            h(
              'div',
              { class: 'dt-col' },
              tabs([
                { id: 'trim', label: ctx.pick('Trim', 'Обрезка'), render: () => pane(
                  ctx.pick('Trim', 'Обрезка'),
                  h(
                    'div',
                    { class: 'dt-stack' },
                    h(
                      'div',
                      { class: 'dt-ie-size-row' },
                      field(ctx.pick('Start, s', 'Начало, с'), trimStartInput),
                      field(ctx.pick('End, s', 'Конец, с'), trimEndInput),
                    ),
                    toolbar(
                      btn(ctx.pick('Set start at playhead', 'Начало по курсору'), () => applyTrim(video.currentTime, trimEnd), { variant: 'ghost' }),
                      btn(ctx.pick('Set end at playhead', 'Конец по курсору'), () => applyTrim(trimStart, video.currentTime), { variant: 'ghost' }),
                    ),
                  ),
                ) },
                { id: 'overlays', label: ctx.pick('Overlays', 'Наложения'), render: () => pane(ctx.pick('Overlays', 'Наложения'), overlayList, [
                  iconBtn(
                    '<path d="M4 6v-1h16v1"/><path d="M12 5v14"/><path d="M9 19h6"/>',
                    ctx.pick('Add text overlay', 'Добавить текст'),
                    addTextOverlay,
                  ),
                  iconBtn(
                    '<path d="M15 8h.01"/><path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3z"/><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5"/><path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3"/>',
                    ctx.pick('Add image or GIF overlay', 'Добавить изображение или GIF'),
                    () => imageInput.click(),
                  ),
                ]) },
                { id: 'properties', label: ctx.pick('Properties', 'Свойства'), render: () => pane(ctx.pick('Overlay properties', 'Свойства наложения'), overlayInspector) },
                { id: 'audio', label: ctx.pick('Audio', 'Звук'), render: () => audioPane },
                { id: 'export', label: ctx.pick('Export', 'Экспорт'), render: () => exportPane },
              ]),
            ),
          ),
          h(
            'div',
            { class: 'dt-toolbar dt-timeline-toolbar' },
            btn('-', () => setZoom(zoom - 0.25), { variant: 'subtle', title: ctx.pick('Zoom out', 'Уменьшить масштаб') }),
            zoomLabel,
            btn('+', () => setZoom(zoom + 0.25), { variant: 'subtle', title: ctx.pick('Zoom in', 'Увеличить масштаб') }),
            iconBtn(
              '<path d="M4 9V4h5"/><path d="M20 9V4h-5"/><path d="M4 15v5h5"/><path d="M20 15v5h-5"/>',
              ctx.pick('Fit the whole duration', 'Вписать всю длительность'),
              () => setZoom(1),
              { variant: 'subtle' },
            ),
            h('span', { class: 'dt-grow' }),
            btn(ctx.pick('+ Video track', '+ Видеодорожка'), addOverlayTrack, { variant: 'ghost' }),
            btn(ctx.pick('+ Audio track', '+ Аудиодорожка'), () => audioTrackInput.click(), { variant: 'ghost' }),
          ),
          pane(ctx.pick('Timeline', 'Таймлайн'), timeline, [], '', { collapsible: false }),
          h(
            'div',
            { class: 'dt-hint' },
            ctx.pick(
              'Drag clips to move, edges to trim, use ± or Ctrl+wheel for zoom. Load several audio files to build a multi-track mix.',
              'Тяните клипы для перемещения, края — для обрезки, ± или Ctrl+колесо меняют масштаб. Загружайте несколько аудиофайлов для многодорожечного микса.',
            ),
          ),
        ),
      );
      root.append(video, audioHost, videoInput, imageInput, audioTrackInput);

      renderOverlayList();
      renderOverlayInspector();
      renderAudioList();
      drawFrame();
      const incoming = ctx.takeIncoming();
      if (incoming) loadVideoSource(incoming.name.replace(/\.[^.]+$/, ''), URL.createObjectURL(incomingToBlob(incoming)));
    },
  });
}

export const videoEditorTools = [videoEditorTool()];
