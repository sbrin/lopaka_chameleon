import { encode as encodePng } from "fast-png";
import { describe, expect, it } from "vitest";

import { R2ObjectStore, isSupportedMaskPngFile } from "../src/repositories/r2-object-store";

const rgbaPngFixture =
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4XmP4zwAE/8EUkPz/vwEANlwHesZDrpkAAAAASUVORK5CYII=";

const decodeBase64 = (value: string): Uint8Array => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
};

const blobPartFromBytes = (bytes: Uint8Array): ArrayBuffer => {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
};

class FakeR2ObjectBody {
  constructor(private readonly bytes: Uint8Array) {}

  async arrayBuffer(): Promise<ArrayBuffer> {
    return this.bytes.slice().buffer;
  }
}

class FakeR2Bucket {
  readonly puts: Array<{ key: string; file: ReadableStream; contentType: string | undefined }> = [];

  constructor(private readonly objects: Map<string, Uint8Array>) {}

  async get(key: string): Promise<R2ObjectBody | null> {
    const bytes = this.objects.get(key);
    return bytes ? (new FakeR2ObjectBody(bytes) as unknown as R2ObjectBody) : null;
  }

  async put(
    key: string,
    file: ReadableStream,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<void> {
    this.puts.push({ key, file, contentType: options?.httpMetadata?.contentType });
  }
}

const makeStore = (objects: Map<string, Uint8Array>) =>
  new R2ObjectStore(new FakeR2Bucket(objects) as unknown as R2Bucket, "https://cdn.example.test");

describe("R2ObjectStore", () => {
  it("stores WebP scene assets with a WebP object key and metadata", async () => {
    const bucket = new FakeR2Bucket(new Map());
    const store = new R2ObjectStore(bucket as unknown as R2Bucket, "https://cdn.example.test");

    await expect(store.putLevelAsset("scene", "level-webp", new File(["scene"], "scene.webp", { type: "image/webp" }))).resolves.toBe(
      "scenes/level-webp.webp",
    );
    expect(bucket.puts).toEqual([
      expect.objectContaining({
        key: "scenes/level-webp.webp",
        contentType: "image/webp",
      }),
    ]);
  });

  it("accepts uploaded RGBA PNG mask files", async () => {
    const file = new File([blobPartFromBytes(decodeBase64(rgbaPngFixture))], "mask.png", { type: "image/png" });

    await expect(isSupportedMaskPngFile(file)).resolves.toBe(true);
  });

  it("accepts uploaded grayscale-alpha PNG mask files", async () => {
    const grayAlphaPng = encodePng({
      width: 2,
      height: 1,
      channels: 2,
      depth: 8,
      data: new Uint8Array([0, 0, 255, 200]),
    });
    const file = new File([blobPartFromBytes(grayAlphaPng)], "mask.png", { type: "image/png" });

    await expect(isSupportedMaskPngFile(file)).resolves.toBe(true);
  });

  it("rejects uploaded mask files with malformed PNG bytes", async () => {
    const file = new File(["not a png"], "mask.png", { type: "image/png" });

    await expect(isSupportedMaskPngFile(file)).resolves.toBe(false);
  });

  it("rejects uploaded PNG masks without an alpha channel", async () => {
    const rgbPng = encodePng({
      width: 1,
      height: 1,
      channels: 3,
      depth: 8,
      data: new Uint8Array([255, 255, 255]),
    });
    const file = new File([blobPartFromBytes(rgbPng)], "mask.png", { type: "image/png" });

    await expect(isSupportedMaskPngFile(file)).resolves.toBe(false);
  });

  it("decodes uploaded RGBA PNG masks from R2 bytes", async () => {
    const store = makeStore(new Map([["masks/rgba.png", decodeBase64(rgbaPngFixture)]]));

    const mask = await store.getMask("masks/rgba.png");

    expect(mask.width).toBe(2);
    expect(mask.height).toBe(2);
    expect(mask.alphaAt(0, 0)).toBe(0);
    expect(mask.alphaAt(1, 0)).toBe(255);
    expect(mask.alphaAt(0, 1)).toBe(0);
    expect(mask.alphaAt(1, 1)).toBe(128);
  });

  it("decodes grayscale-alpha PNG masks from R2 bytes", async () => {
    const grayAlphaPng = encodePng({
      width: 2,
      height: 1,
      channels: 2,
      depth: 8,
      data: new Uint8Array([0, 0, 255, 200]),
    });
    const store = makeStore(new Map([["masks/gray-alpha.png", grayAlphaPng]]));

    const mask = await store.getMask("masks/gray-alpha.png");

    expect(mask.width).toBe(2);
    expect(mask.height).toBe(1);
    expect(mask.alphaAt(0, 0)).toBe(0);
    expect(mask.alphaAt(1, 0)).toBe(200);
  });

  it("throws when a mask object is missing", async () => {
    const store = makeStore(new Map());

    await expect(store.getMask("masks/missing.png")).rejects.toThrow("Mask object not found.");
  });
});
