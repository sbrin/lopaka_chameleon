import { afterEach, describe, expect, it, vi } from "vitest";

import { bakeScene } from "../src/bake";

class FakeCanvas {
  width = 0;
  height = 0;

  constructor(
    readonly blobType = "image/webp",
    readonly context: { drawImage: ReturnType<typeof vi.fn> } | null = null,
  ) {}

  getContext(kind: string) {
    return kind === "2d" ? this.context : null;
  }

  toBlob(callback: BlobCallback, type?: string) {
    const blobType = type ?? this.blobType;
    callback(new Blob([blobType], { type: blobType }));
  }
}

const originalDocument = globalThis.document;

afterEach(() => {
  vi.restoreAllMocks();
  globalThis.document = originalDocument;
});

describe("bakeScene", () => {
  it("composites background and chameleon canvases and exports scene plus mask blobs", async () => {
    const drawImage = vi.fn();
    const sceneCanvas = new FakeCanvas("image/webp", { drawImage });
    const backgroundCanvas = new FakeCanvas();
    const chameleonCanvas = new FakeCanvas();
    const maskCanvas = new FakeCanvas("image/png");

    globalThis.document = {
      createElement: vi.fn(() => sceneCanvas),
    } as unknown as Document;

    const baked = await bakeScene({
      backgroundCanvas: backgroundCanvas as unknown as HTMLCanvasElement,
      chameleonCanvas: chameleonCanvas as unknown as HTMLCanvasElement,
      maskCanvas: maskCanvas as unknown as HTMLCanvasElement,
      imageWidth: 320,
      imageHeight: 180,
    });

    expect(sceneCanvas.width).toBe(320);
    expect(sceneCanvas.height).toBe(180);
    expect(drawImage).toHaveBeenNthCalledWith(1, backgroundCanvas, 0, 0);
    expect(drawImage).toHaveBeenNthCalledWith(2, chameleonCanvas, 0, 0);
    expect(baked.sceneBlob.type).toBe("image/webp");
    expect(baked.maskBlob.type).toBe("image/png");
    expect(baked.imageWidth).toBe(320);
    expect(baked.imageHeight).toBe(180);
  });
});
