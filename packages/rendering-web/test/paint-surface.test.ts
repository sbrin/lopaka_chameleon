import { describe, expect, it, vi } from "vitest";

import { compositePaintToSurface, paintStroke } from "../src/paint-surface";

class FakeCanvas {
  width = 320;
  height = 180;

  constructor(readonly context: FakeContext | null = null) {}

  getContext(kind: string) {
    return kind === "2d" ? this.context : null;
  }
}

class FakeContext {
  fillStyle = "";
  globalCompositeOperation = "source-over";
  save = vi.fn();
  restore = vi.fn();
  beginPath = vi.fn();
  arc = vi.fn();
  fill = vi.fn();
  clearRect = vi.fn();
  drawImage = vi.fn();
}

describe("paint surface helpers", () => {
  it("records a stroke on a persistent paint canvas without touching the mask or background", () => {
    const paintContext = new FakeContext();
    const paintCanvas = new FakeCanvas(paintContext);
    const maskContext = new FakeContext();
    const maskCanvas = new FakeCanvas(maskContext);
    const backgroundContext = new FakeContext();

    paintStroke({
      canvas: paintCanvas as unknown as HTMLCanvasElement,
      point: { x: 80, y: 42 },
      color: "#ff00aa",
      brushSize: 18,
    });

    expect(paintContext.fillStyle).toBe("#ff00aa");
    expect(paintContext.arc).toHaveBeenCalledWith(80, 42, 9, 0, Math.PI * 2);
    expect(paintContext.fill).toHaveBeenCalledOnce();
    expect(maskContext.drawImage).not.toHaveBeenCalled();
    expect(backgroundContext.drawImage).not.toHaveBeenCalled();

    compositePaintToSurface({
      surfaceCanvas: new FakeCanvas(new FakeContext()) as unknown as HTMLCanvasElement,
      paintCanvas: paintCanvas as unknown as HTMLCanvasElement,
      maskCanvas: maskCanvas as unknown as HTMLCanvasElement,
    });

    expect(paintContext.clearRect).not.toHaveBeenCalled();
  });

  it("reapplies persistent paint through the current mask when the surface is redrawn", () => {
    const surfaceContext = new FakeContext();
    const surfaceCanvas = new FakeCanvas(surfaceContext);
    const paintCanvas = new FakeCanvas(new FakeContext());
    const firstMaskCanvas = new FakeCanvas(new FakeContext());
    const secondMaskCanvas = new FakeCanvas(new FakeContext());

    compositePaintToSurface({
      surfaceCanvas: surfaceCanvas as unknown as HTMLCanvasElement,
      paintCanvas: paintCanvas as unknown as HTMLCanvasElement,
      maskCanvas: firstMaskCanvas as unknown as HTMLCanvasElement,
    });
    compositePaintToSurface({
      surfaceCanvas: surfaceCanvas as unknown as HTMLCanvasElement,
      paintCanvas: paintCanvas as unknown as HTMLCanvasElement,
      maskCanvas: secondMaskCanvas as unknown as HTMLCanvasElement,
    });

    expect(surfaceContext.drawImage).toHaveBeenNthCalledWith(1, paintCanvas, 0, 0, 320, 180);
    expect(surfaceContext.drawImage).toHaveBeenNthCalledWith(2, firstMaskCanvas, 0, 0, 320, 180);
    expect(surfaceContext.drawImage).toHaveBeenNthCalledWith(3, paintCanvas, 0, 0, 320, 180);
    expect(surfaceContext.drawImage).toHaveBeenNthCalledWith(4, secondMaskCanvas, 0, 0, 320, 180);
    expect(surfaceContext.globalCompositeOperation).toBe("source-over");
  });
});
