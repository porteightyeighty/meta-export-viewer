/**
 * Dependency-free width/height sniffing for the formats Meta exports contain:
 * JPEG, PNG, WebP, GIF and MP4/MOV. Reads only file headers (or the moov box).
 */
import fs from "node:fs";

export interface Size {
  width: number;
  height: number;
}

export function mediaSize(file: string): Size | undefined {
  try {
    const fd = fs.openSync(file, "r");
    try {
      const head = Buffer.alloc(64 * 1024);
      const n = fs.readSync(fd, head, 0, head.length, 0);
      const b = head.subarray(0, n);
      return imageSize(b) ?? mp4Size(fd, fs.fstatSync(fd).size);
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return undefined;
  }
}

/** Image formats from a header buffer. */
export function imageSize(b: Buffer): Size | undefined {
  if (b.length < 24) return undefined;
  // PNG
  if (b.readUInt32BE(0) === 0x89504e47) return ok(b.readUInt32BE(16), b.readUInt32BE(20));
  // GIF
  if (b.toString("ascii", 0, 3) === "GIF") return ok(b.readUInt16LE(6), b.readUInt16LE(8));
  // WebP
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
    const chunk = b.toString("ascii", 12, 16);
    if (chunk === "VP8X") return ok(1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3));
    if (chunk === "VP8L") {
      const bits = b.readUInt32LE(21);
      return ok((bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1);
    }
    if (chunk === "VP8 ") return ok(b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff);
    return undefined;
  }
  // JPEG: walk segments to the first SOFn
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return undefined;
      const marker = b[i + 1];
      if (marker === 0xff) { i++; continue; }
      const len = b.readUInt16BE(i + 2);
      const isSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSOF) return ok(b.readUInt16BE(i + 7), b.readUInt16BE(i + 5));
      i += 2 + len;
    }
  }
  return undefined;
}

/** MP4/MOV: find moov → trak → tkhd with a non-zero size (the video track). */
function mp4Size(fd: number, fileSize: number): Size | undefined {
  const hdr = Buffer.alloc(16);
  let pos = 0;
  while (pos + 8 <= fileSize) {
    fs.readSync(fd, hdr, 0, 16, pos);
    let size = hdr.readUInt32BE(0);
    const type = hdr.toString("ascii", 4, 8);
    if (size === 1) size = Number(hdr.readBigUInt64BE(8));
    else if (size === 0) size = fileSize - pos;
    if (size < 8) return undefined;
    if (type === "moov") {
      if (size > 64 * 1024 * 1024) return undefined;
      const moov = Buffer.alloc(size);
      fs.readSync(fd, moov, 0, size, pos);
      return findTkhd(moov, 8, size);
    }
    pos += size;
  }
  return undefined;
}

function findTkhd(b: Buffer, start: number, end: number): Size | undefined {
  let p = start;
  while (p + 8 <= end) {
    const size = b.readUInt32BE(p);
    const type = b.toString("ascii", p + 4, p + 8);
    if (size < 8 || p + size > end) return undefined;
    if (type === "trak" || type === "mdia") {
      const hit = findTkhd(b, p + 8, p + size);
      if (hit) return hit;
    } else if (type === "tkhd") {
      // width/height are the last 8 bytes, 16.16 fixed point
      const w = b.readUInt32BE(p + size - 8) / 65536, h = b.readUInt32BE(p + size - 4) / 65536;
      if (w && h) {
        // honour 90° rotation in the matrix (a=0, b=±1)
        const version = b[p + 8];
        const matrix = p + 8 + (version === 1 ? 52 : 40);
        const a = b.readInt32BE(matrix), bb = b.readInt32BE(matrix + 4);
        return a === 0 && bb !== 0 ? ok(h, w) : ok(w, h);
      }
    }
    p += size;
  }
  return undefined;
}

const ok = (width: number, height: number) => (width > 0 && height > 0 ? { width: Math.round(width), height: Math.round(height) } : undefined);
