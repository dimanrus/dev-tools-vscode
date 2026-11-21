/** Dependency-free animated GIF (GIF89a) encoder: median-cut palette plus LZW compression. */

export interface GifFrame {
  /** RGBA pixels, `width * height * 4` bytes. */
  pixels: Uint8ClampedArray;
  /** Frame delay in milliseconds. */
  delay: number;
}

const PALETTE_SIZE = 256;
const BIN_BITS = 5;
const BIN_SIZE = 1 << BIN_BITS;
const BIN_COUNT = BIN_SIZE * BIN_SIZE * BIN_SIZE;

class ByteWriter {
  private buffer = new Uint8Array(1 << 16);
  private length = 0;

  byte(value: number): void {
    this.ensure(1);
    this.buffer[this.length++] = value & 0xff;
  }

  bytes(values: ArrayLike<number>): void {
    this.ensure(values.length);
    this.buffer.set(values, this.length);
    this.length += values.length;
  }

  u16(value: number): void {
    this.byte(value);
    this.byte(value >> 8);
  }

  ascii(value: string): void {
    for (let index = 0; index < value.length; index++) this.byte(value.charCodeAt(index));
  }

  toUint8Array(): Uint8Array {
    return this.buffer.slice(0, this.length);
  }

  private ensure(size: number): void {
    if (this.length + size <= this.buffer.length) return;
    let capacity = this.buffer.length * 2;
    while (capacity < this.length + size) capacity *= 2;
    const next = new Uint8Array(capacity);
    next.set(this.buffer.subarray(0, this.length));
    this.buffer = next;
  }
}

/** Collects a coarse color histogram over all frames. */
function buildPalette(frames: GifFrame[], sampleLimit = 90_000): Uint8Array {
  const counts = new Uint32Array(BIN_COUNT);
  const reds = new Float64Array(BIN_COUNT);
  const greens = new Float64Array(BIN_COUNT);
  const blues = new Float64Array(BIN_COUNT);

  let totalPixels = 0;
  for (const frame of frames) totalPixels += frame.pixels.length / 4;
  const stride = Math.max(1, Math.ceil(totalPixels / sampleLimit));
  let counter = 0;
  for (const frame of frames) {
    const pixels = frame.pixels;
    for (let index = 0; index < pixels.length; index += 4) {
      if (counter++ % stride) continue;
      const r = pixels[index];
      const g = pixels[index + 1];
      const b = pixels[index + 2];
      const bin = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      counts[bin]++;
      reds[bin] += r;
      greens[bin] += g;
      blues[bin] += b;
    }
  }

  const average = new Float32Array(BIN_COUNT * 3);
  const used: number[] = [];
  for (let bin = 0; bin < BIN_COUNT; bin++) {
    if (!counts[bin]) continue;
    used.push(bin);
    const count = counts[bin];
    average[bin * 3] = reds[bin] / count;
    average[bin * 3 + 1] = greens[bin] / count;
    average[bin * 3 + 2] = blues[bin] / count;
  }

  let boxes: number[][] = [used];
  while (boxes.length < PALETTE_SIZE) {
    let target = -1;
    let targetChannel = 0;
    let bestScore = 0;
    for (let boxIndex = 0; boxIndex < boxes.length; boxIndex++) {
      const bins = boxes[boxIndex];
      if (bins.length < 2) continue;
      let minR = 255;
      let maxR = 0;
      let minG = 255;
      let maxG = 0;
      let minB = 255;
      let maxB = 0;
      let weight = 0;
      for (const bin of bins) {
        const r = average[bin * 3];
        const g = average[bin * 3 + 1];
        const b = average[bin * 3 + 2];
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (g < minG) minG = g;
        if (g > maxG) maxG = g;
        if (b < minB) minB = b;
        if (b > maxB) maxB = b;
        weight += counts[bin];
      }
      const spreadR = maxR - minR;
      const spreadG = maxG - minG;
      const spreadB = maxB - minB;
      const spread = Math.max(spreadR, spreadG, spreadB);
      const score = spread * Math.sqrt(weight);
      if (score > bestScore) {
        bestScore = score;
        target = boxIndex;
        targetChannel = spreadR >= spreadG && spreadR >= spreadB ? 0 : spreadG >= spreadB ? 1 : 2;
      }
    }
    if (target < 0) break;
    const bins = [...boxes[target]].sort((a, b) => average[a * 3 + targetChannel] - average[b * 3 + targetChannel]);
    let total = 0;
    for (const bin of bins) total += counts[bin];
    let accumulated = 0;
    let cut = 1;
    for (let index = 0; index < bins.length - 1; index++) {
      accumulated += counts[bins[index]];
      if (accumulated >= total / 2) {
        cut = index + 1;
        break;
      }
    }
    boxes.splice(target, 1, bins.slice(0, cut), bins.slice(cut));
  }

  const palette = new Uint8Array(PALETTE_SIZE * 3);
  for (let index = 0; index < boxes.length && index < PALETTE_SIZE; index++) {
    const bins = boxes[index];
    let weight = 0;
    let r = 0;
    let g = 0;
    let b = 0;
    for (const bin of bins) {
      const count = counts[bin];
      weight += count;
      r += average[bin * 3] * count;
      g += average[bin * 3 + 1] * count;
      b += average[bin * 3 + 2] * count;
    }
    const divisor = weight || 1;
    palette[index * 3] = Math.round(r / divisor);
    palette[index * 3 + 1] = Math.round(g / divisor);
    palette[index * 3 + 2] = Math.round(b / divisor);
  }
  return palette;
}

function createMapper(palette: Uint8Array): (r: number, g: number, b: number) => number {
  const cache = new Map<number, number>();
  return (r, g, b) => {
    const key = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    let best = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < PALETTE_SIZE; index++) {
      const dr = r - palette[index * 3];
      const dg = g - palette[index * 3 + 1];
      const db = b - palette[index * 3 + 2];
      const distance = dr * dr + dg * dg + db * db;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    }
    cache.set(key, best);
    return best;
  };
}

function lzwEncode(pixels: Uint8Array, minCodeSize: number): Uint8Array {
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  const bytes: number[] = [];
  let codeSize = minCodeSize + 1;
  let nextCode = clearCode + 2;
  let dictionary = new Map<number, number>();
  let accumulator = 0;
  let bitCount = 0;

  const emit = (code: number): void => {
    accumulator |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      bytes.push(accumulator & 0xff);
      accumulator >>= 8;
      bitCount -= 8;
    }
  };

  emit(clearCode);
  let prefix = pixels[0];
  for (let index = 1; index < pixels.length; index++) {
    const symbol = pixels[index];
    const key = (prefix << 8) | symbol;
    const existing = dictionary.get(key);
    if (existing !== undefined) {
      prefix = existing;
      continue;
    }
    emit(prefix);
    if (nextCode < 4096) {
      // The GIF bit width grows before the entry that no longer fits is inserted.
      if (nextCode >= 1 << codeSize && codeSize < 12) codeSize++;
      dictionary.set(key, nextCode++);
    } else {
      emit(clearCode);
      dictionary = new Map();
      nextCode = clearCode + 2;
      codeSize = minCodeSize + 1;
    }
    prefix = symbol;
  }
  emit(prefix);
  emit(endCode);
  if (bitCount > 0) bytes.push(accumulator & 0xff);
  return Uint8Array.from(bytes);
}

/** Encodes equally sized RGBA frames into an animated, infinitely looping GIF. */
export function encodeGif(frames: GifFrame[], width: number, height: number): Uint8Array {
  if (!frames.length || width < 1 || height < 1) return new Uint8Array(0);
  const palette = buildPalette(frames);
  const mapColor = createMapper(palette);
  const writer = new ByteWriter();
  writer.ascii('GIF89a');
  writer.u16(width);
  writer.u16(height);
  writer.byte(0xf7);
  writer.byte(0);
  writer.byte(0);
  writer.bytes(palette);
  writer.bytes([0x21, 0xff, 0x0b]);
  writer.ascii('NETSCAPE2.0');
  writer.bytes([0x03, 0x01, 0x00, 0x00, 0x00]);

  const minCodeSize = 8;
  const indices = new Uint8Array(width * height);
  for (const frame of frames) {
    const delay = Math.max(2, Math.round(frame.delay / 10));
    writer.bytes([0x21, 0xf9, 0x04, 0x04]);
    writer.u16(delay);
    writer.bytes([0x00, 0x00]);
    writer.byte(0x2c);
    writer.u16(0);
    writer.u16(0);
    writer.u16(width);
    writer.u16(height);
    writer.byte(0x00);
    const pixels = frame.pixels;
    for (let index = 0, offset = 0; index < indices.length; index++, offset += 4) {
      indices[index] = mapColor(pixels[offset], pixels[offset + 1], pixels[offset + 2]);
    }
    const compressed = lzwEncode(indices, minCodeSize);
    writer.byte(minCodeSize);
    for (let offset = 0; offset < compressed.length; offset += 255) {
      const size = Math.min(255, compressed.length - offset);
      writer.byte(size);
      writer.bytes(compressed.subarray(offset, offset + size));
    }
    writer.byte(0x00);
  }
  writer.byte(0x3b);
  return writer.toUint8Array();
}
