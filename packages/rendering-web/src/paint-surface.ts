export type PaintPoint = {
  x: number;
  y: number;
};

export type PaintStrokeInput = {
  canvas: HTMLCanvasElement;
  point: PaintPoint;
  color: string;
  brushSize: number;
};

export type MaskedPaintStrokeInput = PaintStrokeInput & {
  maskCanvas: HTMLCanvasElement;
};

export type CompositePaintInput = {
  surfaceCanvas: HTMLCanvasElement;
  paintCanvas: HTMLCanvasElement;
  maskCanvas: HTMLCanvasElement;
};

export function paintStroke(input: PaintStrokeInput): void {
  const ctx = get2dContext(input.canvas);
  ctx.save();
  ctx.fillStyle = input.color;
  ctx.beginPath();
  ctx.arc(input.point.x, input.point.y, input.brushSize / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function paintMaskedStroke(input: MaskedPaintStrokeInput): void {
  paintStroke(input);
  clipCanvasToMask(input.canvas, input.maskCanvas);
}

export function compositePaintToSurface(input: CompositePaintInput): void {
  const ctx = get2dContext(input.surfaceCanvas);
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(input.paintCanvas, 0, 0, input.surfaceCanvas.width, input.surfaceCanvas.height);
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(input.maskCanvas, 0, 0, input.surfaceCanvas.width, input.surfaceCanvas.height);
  ctx.restore();
  ctx.globalCompositeOperation = "source-over";
}

export function clipCanvasToMask(canvas: HTMLCanvasElement, maskCanvas: HTMLCanvasElement): void {
  const ctx = get2dContext(canvas);
  ctx.save();
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(maskCanvas, 0, 0, canvas.width, canvas.height);
  ctx.restore();
}

export function clearCanvas(canvas: HTMLCanvasElement): void {
  get2dContext(canvas).clearRect(0, 0, canvas.width, canvas.height);
}

function get2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas is unavailable.");

  return ctx;
}
