/** Minimal DXF reader: extracts wireframe entities from the ENTITIES section (no dependencies). */
export interface DxfPoint {
  x: number;
  y: number;
  z: number;
}

export interface DxfPath {
  points: DxfPoint[];
  closed: boolean;
}

export interface DxfDrawing {
  paths: DxfPath[];
  /** Entities that were recognised but carry no drawable geometry for us. */
  skipped: number;
}

interface DxfEntity {
  section: string;
  name: string;
  pairs: Array<[number, string]>;
}

interface DxfVertex {
  point: DxfPoint;
  bulge: number;
}

interface DxfTransform {
  scale: number;
  rotation: number;
  tx: number;
  ty: number;
  tz: number;
}

const IDENTITY: DxfTransform = { scale: 1, rotation: 0, tx: 0, ty: 0, tz: 0 };
/** Segments per full circle when tessellating arcs. */
const ARC_STEPS = 32;
/** How deep nested blocks are expanded. */
const MAX_BLOCK_DEPTH = 4;

function firstString(entity: DxfEntity, code: number): string {
  for (const [pairCode, value] of entity.pairs) {
    if (pairCode === code) return value;
  }
  return '';
}

function applyTransform(points: DxfPoint[], transform: DxfTransform): DxfPoint[] {
  if (transform.scale === 1 && !transform.rotation && !transform.tx && !transform.ty && !transform.tz) return points;
  const cos = Math.cos(transform.rotation);
  const sin = Math.sin(transform.rotation);
  return points.map((point) => {
    const x = point.x * transform.scale;
    const y = point.y * transform.scale;
    return {
      x: x * cos - y * sin + transform.tx,
      y: x * sin + y * cos + transform.ty,
      z: point.z * transform.scale + transform.tz,
    };
  });
}

/** Block inserts can be nested, so parent and child placements are combined. */
function compose(parent: DxfTransform, child: DxfTransform): DxfTransform {
  const cos = Math.cos(parent.rotation);
  const sin = Math.sin(parent.rotation);
  return {
    scale: parent.scale * child.scale,
    rotation: parent.rotation + child.rotation,
    tx: parent.tx + parent.scale * (child.tx * cos - child.ty * sin),
    ty: parent.ty + parent.scale * (child.tx * sin + child.ty * cos),
    tz: parent.tz + parent.scale * child.tz,
  };
}

function toNumber(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function firstNumber(entity: DxfEntity, code: number, fallback = 0): number {
  for (const [pairCode, value] of entity.pairs) {
    if (pairCode === code) return toNumber(value);
  }
  return fallback;
}

function pointAt(entity: DxfEntity, xCode: number): DxfPoint {
  return {
    x: firstNumber(entity, xCode),
    y: firstNumber(entity, xCode + 10),
    z: firstNumber(entity, xCode + 20),
  };
}

/** Reads the group-code stream into records tagged with their section. */
function readRecords(text: string): DxfEntity[] {
  const lines = text.split(/\r\n|\n|\r/);
  const entities: DxfEntity[] = [];
  let section = '';
  let pendingSection = false;
  let current: DxfEntity | null = null;

  for (let index = 0; index + 1 < lines.length; index += 2) {
    const code = Number.parseInt(lines[index].trim(), 10);
    if (!Number.isFinite(code)) continue;
    const value = lines[index + 1].trim();

    if (code === 0) {
      if (current) entities.push(current);
      current = null;
      const name = value.toUpperCase();
      if (name === 'SECTION') {
        pendingSection = true;
        continue;
      }
      if (name === 'ENDSEC') {
        section = '';
        continue;
      }
      if (name === 'EOF') break;
      current = { section, name, pairs: [] };
      continue;
    }

    if (pendingSection && code === 2) {
      section = value.toUpperCase();
      pendingSection = false;
      continue;
    }
    if (current) current.pairs.push([code, value]);
  }

  if (current) entities.push(current);
  return entities;
}

/** Arc through `from` -> `to` described by a DXF bulge (tan of a quarter of the included angle). */
function bulgePoints(from: DxfPoint, to: DxfPoint, bulge: number): DxfPoint[] {
  const theta = 4 * Math.atan(bulge);
  if (Math.abs(theta) < 1e-4) return [];
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const chord = Math.hypot(dx, dy);
  if (chord < 1e-9) return [];

  const offset = (chord / 2) / Math.tan(theta / 2);
  const centerX = (from.x + to.x) / 2 + (dy / chord) * offset;
  const centerY = (from.y + to.y) / 2 - (dx / chord) * offset;
  const radius = Math.hypot(from.x - centerX, from.y - centerY);
  const start = Math.atan2(from.y - centerY, from.x - centerX);
  const sweep = -theta;
  const steps = Math.max(4, Math.round((Math.abs(theta) / (Math.PI * 2)) * ARC_STEPS));

  const points: DxfPoint[] = [];
  for (let step = 1; step < steps; step += 1) {
    const angle = start + (sweep * step) / steps;
    const ratio = step / steps;
    points.push({
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
      z: from.z + (to.z - from.z) * ratio,
    });
  }
  return points;
}

function circlePoints(center: DxfPoint, radius: number, startDeg: number, endDeg: number): DxfPoint[] {
  let sweep = endDeg - startDeg;
  if (sweep <= 0) sweep += 360;
  const steps = Math.max(8, Math.round((sweep / 360) * ARC_STEPS * 2));
  const points: DxfPoint[] = [];
  for (let step = 0; step <= steps; step += 1) {
    const angle = ((startDeg + (sweep * step) / steps) * Math.PI) / 180;
    points.push({
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
      z: center.z,
    });
  }
  return points;
}

function bulgePath(vertices: DxfVertex[], closed: boolean): DxfPoint[] {
  if (!vertices.length) return [];
  const points: DxfPoint[] = [{ ...vertices[0].point }];
  const count = vertices.length;
  const segments = closed ? count : count - 1;
  for (let index = 0; index < segments; index += 1) {
    const from = vertices[index];
    const to = vertices[(index + 1) % count];
    if (Math.abs(from.bulge) > 1e-6) points.push(...bulgePoints(from.point, to.point, from.bulge));
    points.push({ ...to.point });
  }
  return points;
}

function lwVertices(entity: DxfEntity): DxfVertex[] {
  const vertices: DxfVertex[] = [];
  let current: DxfVertex | null = null;
  for (const [code, value] of entity.pairs) {
    if (code === 10) {
      if (current) vertices.push(current);
      current = { point: { x: toNumber(value), y: 0, z: 0 }, bulge: 0 };
    } else if (code === 20 && current) {
      current.point.y = toNumber(value);
    } else if (code === 38 && current) {
      current.point.z = toNumber(value);
    } else if (code === 42 && current) {
      current.bulge = toNumber(value);
    }
  }
  if (current) vertices.push(current);
  return vertices;
}

/** Spline fit points (codes 11/21/31) approximated as a polyline. */
function fitPoints(entity: DxfEntity): DxfPoint[] {
  const points: DxfPoint[] = [];
  let current: DxfPoint | null = null;
  for (const [code, value] of entity.pairs) {
    if (code === 11) {
      if (current) points.push(current);
      current = { x: toNumber(value), y: 0, z: 0 };
    } else if (code === 21 && current) {
      current.y = toNumber(value);
    } else if (code === 31 && current) {
      current.z = toNumber(value);
    }
  }
  if (current) points.push(current);
  return points;
}

function isClosed(entity: DxfEntity): boolean {
  return (Math.round(firstNumber(entity, 70)) & 1) === 1;
}

interface BlockRange {
  from: number;
  to: number;
}

interface RangeOptions {
  records: DxfEntity[];
  from: number;
  to: number;
  blocks: Map<string, BlockRange>;
  transform: DxfTransform;
  depth: number;
}

/** Turns a range of records into polylines placed by `transform`. */
function parseRange(options: RangeOptions): DxfDrawing {
  const { records: entities, blocks, transform, depth } = options;
  const paths: DxfPath[] = [];
  let skipped = 0;

  const add = (points: DxfPoint[], closed: boolean): void => {
    if (points.length < 2) {
      skipped += 1;
      return;
    }
    paths.push({ points: applyTransform(points, transform), closed });
  };

  for (let index = options.from; index < options.to; index += 1) {
    const entity = entities[index];
    switch (entity.name) {
      case 'LINE': {
        paths.push({ points: [pointAt(entity, 10), pointAt(entity, 11)], closed: false });
        break;
      }
      case 'LWPOLYLINE': {
        const vertices = lwVertices(entity);
        if (vertices.length >= 2) add(bulgePath(vertices, isClosed(entity)), isClosed(entity));
        else skipped += 1;
        break;
      }
      case 'POLYLINE': {
        const vertices: DxfVertex[] = [];
        let cursor = index + 1;
        while (cursor < entities.length && entities[cursor].name === 'VERTEX') {
          vertices.push({ point: pointAt(entities[cursor], 10), bulge: firstNumber(entities[cursor], 42) });
          cursor += 1;
        }
        if (cursor < entities.length && entities[cursor].name === 'SEQEND') cursor += 1;
        index = cursor - 1;
        if (vertices.length >= 2) add(bulgePath(vertices, isClosed(entity)), isClosed(entity));
        else skipped += 1;
        break;
      }
      case 'CIRCLE': {
        const radius = firstNumber(entity, 40);
        if (radius > 0) add(circlePoints(pointAt(entity, 10), radius, 0, 360), true);
        else skipped += 1;
        break;
      }
      case 'ARC': {
        const radius = firstNumber(entity, 40);
        if (radius > 0) {
          add(circlePoints(pointAt(entity, 10), radius, firstNumber(entity, 50), firstNumber(entity, 51)), false);
        } else skipped += 1;
        break;
      }
      case '3DFACE':
      case 'SOLID':
      case 'TRACE': {
        const corners = [pointAt(entity, 10), pointAt(entity, 11), pointAt(entity, 12), pointAt(entity, 13)];
        const last = corners[3];
        const first = corners[0];
        const unique = Math.hypot(last.x - first.x, last.y - first.y, last.z - first.z) < 1e-6 ? corners.slice(0, 3) : corners;
        add([...unique, { ...unique[0] }], true);
        break;
      }
      case 'SPLINE': {
        add(fitPoints(entity), false);
        break;
      }
      case 'INSERT': {
        const block = blocks.get(firstString(entity, 2));
        if (!block || depth >= MAX_BLOCK_DEPTH) {
          skipped += 1;
          break;
        }
        const local: DxfTransform = {
          scale: firstNumber(entity, 41, 1) || 1,
          rotation: (firstNumber(entity, 50) * Math.PI) / 180,
          tx: firstNumber(entity, 10),
          ty: firstNumber(entity, 20),
          tz: firstNumber(entity, 30),
        };
        const nested = parseRange({
          records: entities,
          from: block.from,
          to: block.to,
          blocks,
          transform: compose(transform, local),
          depth: depth + 1,
        });
        paths.push(...nested.paths);
        skipped += nested.skipped;
        break;
      }
      case 'POINT':
      case 'TEXT':
      case 'MTEXT':
      case 'ATTRIB':
      case 'ATTDEF':
      case 'DIMENSION':
      case 'LEADER':
      case 'HATCH':
      case 'VIEWPORT':
        skipped += 1;
        break;
      default:
        break;
    }
  }

  return { paths, skipped };
}

/** Parses a DXF file into polylines: LINE, LWPOLYLINE, POLYLINE, CIRCLE, ARC, 3DFACE/SOLID, SPLINE and expanded INSERT blocks. */
export function parseDxf(text: string): DxfDrawing {
  const records = readRecords(text);

  const blocks = new Map<string, BlockRange>();
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (record.section !== 'BLOCKS' || record.name !== 'BLOCK') continue;
    const name = firstString(record, 2);
    let end = index + 1;
    while (end < records.length && !(records[end].section === 'BLOCKS' && records[end].name === 'ENDBLK')) end += 1;
    if (name) blocks.set(name, { from: index + 1, to: end });
    index = end;
  }

  let from = -1;
  let to = -1;
  for (let index = 0; index < records.length; index += 1) {
    if (records[index].section !== 'ENTITIES') continue;
    if (from < 0) from = index;
    to = index + 1;
  }
  if (from < 0) return { paths: [], skipped: 0 };

  return parseRange({ records, from, to, blocks, transform: IDENTITY, depth: 0 });
}
