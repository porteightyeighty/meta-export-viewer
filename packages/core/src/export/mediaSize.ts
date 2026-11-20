/**
 * Dependency-free width/height sniffing for the formats Meta exports contain:
 * JPEG, PNG, WebP, GIF and MP4/MOV. Reads only file headers (or the moov box).
 */
export interface Size {
  width: number;
  height: number;
}

/** Reads `len` bytes at `pos`; may return fewer at end of file. */
export type ReadAt = (pos: number, len: number) => Uint8Array;

export function mediaSize(read: ReadAt, fileSize: number): Size | undefined {
  try {
    return imageSize(read(0, 64 * 1024)) ?? mp4Size(read, fileSize);
  } catch {
    return undefined;
  }
}

const view = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength);
const ascii = (b: Uint8Array, start: number, end: number) => String.fromCharCode(...b.subarray(start, end));
const u24le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);

/** Image formats from a header buffer. */
export function imageSize(b: Uint8Array): Size | undefined {
  if (b.length < 24) return undefined;
  const v = view(b);
  // PNG
  if (v.getUint32(0) === 0x89504e47) return ok(v.getUint32(16), v.getUint32(20));
  // GIF
  if (ascii(b, 0, 3) === "GIF") return ok(v.getUint16(6, true), v.getUint16(8, true));
  // WebP
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") {
    const chunk = ascii(b, 12, 16);
    if (chunk === "VP8X") return ok(1 + u24le(b, 24), 1 + u24le(b, 27));
    if (chunk === "VP8L") {
      const bits = v.getUint32(21, true);
      return ok((bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1);
    }
    if (chunk === "VP8 ") return ok(v.getUint16(26, true) & 0x3fff, v.getUint16(28, true) & 0x3fff);
    return undefined;
  }
  // JPEG: walk segments to the first SOFn
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return undefined;
      const marker = b[i + 1];
      if (marker === 0xff) { i++; continue; }
      const len = v.getUint16(i + 2);
      const isSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSOF) return ok(v.getUint16(i + 7), v.getUint16(i + 5));
      i += 2 + len;
    }
  }
  return undefined;
}

/** MP4/MOV: find moov → trak → tkhd with a non-zero size (the video track). */
function mp4Size(read: ReadAt, fileSize: number): Size | undefined {
  let pos = 0;
  while (pos + 8 <= fileSize) {
    const hdr = new Uint8Array(16);
    hdr.set(read(pos, 16)); // zero-padded near end of file, like a short read into a buffer
    const v = view(hdr);
    let size = v.getUint32(0);
    const type = ascii(hdr, 4, 8);
    if (size === 1) size = Number(v.getBigUint64(8));
    else if (size === 0) size = fileSize - pos;
    if (size < 8) return undefined;
    if (type === "moov") {
      if (size > 64 * 1024 * 1024) return undefined;
      const moov = read(pos, size);
      return findTkhd(moov, 8, moov.length);
    }
    pos += size;
  }
  return undefined;
}

function findTkhd(b: Uint8Array, start: number, end: number): Size | undefined {
  const v = view(b);
  let p = start;
  while (p + 8 <= end) {
    const size = v.getUint32(p);
    const type = ascii(b, p + 4, p + 8);
    if (size < 8 || p + size > end) return undefined;
    if (type === "trak" || type === "mdia") {
      const hit = findTkhd(b, p + 8, p + size);
      if (hit) return hit;
    } else if (type === "tkhd") {
      // width/height are the last 8 bytes, 16.16 fixed point
      const w = v.getUint32(p + size - 8) / 65536, h = v.getUint32(p + size - 4) / 65536;
      if (w && h) {
        // honour 90° rotation in the matrix (a=0, b=±1)
        const version = b[p + 8];
        const matrix = p + 8 + (version === 1 ? 52 : 40);
        const a = v.getInt32(matrix), bb = v.getInt32(matrix + 4);
        return a === 0 && bb !== 0 ? ok(h, w) : ok(w, h);
      }
    }
    p += size;
  }
  return undefined;
}

const ok = (width: number, height: number) => (width > 0 && height > 0 ? { width: Math.round(width), height: Math.round(height) } : undefined);
