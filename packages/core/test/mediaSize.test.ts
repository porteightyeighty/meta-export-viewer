import { describe, expect, it } from "vitest";
import { imageSize } from "../src/export/mediaSize.ts";

describe("imageSize", () => {
  it("reads PNG", () => {
    const b = Buffer.alloc(32);
    b.writeUInt32BE(0x89504e47, 0);
    b.writeUInt32BE(640, 16);
    b.writeUInt32BE(800, 20);
    expect(imageSize(b)).toEqual({ width: 640, height: 800 });
  });

  it("reads JPEG by skipping to the SOF segment", () => {
    const app0 = [0xff, 0xe0, 0x00, 0x04, 0x00, 0x00];
    const sof2 = [0xff, 0xc2, 0x00, 0x11, 0x08, 0x04, 0x38, 0x03, 0x60, 0x03];
    const b = Buffer.from([0xff, 0xd8, ...app0, ...sof2, ...Array(20).fill(0)]);
    expect(imageSize(b)).toEqual({ width: 864, height: 1080 });
  });

  it("reads WebP VP8X", () => {
    const b = Buffer.alloc(32);
    b.write("RIFF", 0, "ascii");
    b.write("WEBPVP8X", 8, "ascii");
    b.writeUIntLE(1079, 24, 3);
    b.writeUIntLE(1349, 27, 3);
    expect(imageSize(b)).toEqual({ width: 1080, height: 1350 });
  });

  it("returns undefined for unknown data", () => {
    expect(imageSize(Buffer.alloc(40))).toBeUndefined();
  });
});
