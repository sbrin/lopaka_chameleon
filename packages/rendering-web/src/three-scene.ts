import { clearCanvas } from "./paint-surface";

export type ChameleonSceneInput = {
  canvas: HTMLCanvasElement;
  maskCanvas: HTMLCanvasElement;
  poseId: string;
  rotation: number;
  color?: string;
  fixedDisplayHeightRatio?: number;
};

export function renderChameleonScene(input: ChameleonSceneInput): void {
  clearCanvas(input.canvas);
  clearCanvas(input.maskCanvas);

  const sceneCtx = get2dContext(input.canvas);
  const maskCtx = get2dContext(input.maskCanvas);
  const color = input.color ?? "#6f8f66";

  drawSilhouette(sceneCtx, input.canvas, {
    color,
    rotation: input.rotation,
    heightRatio: input.fixedDisplayHeightRatio ?? 0.22,
    mask: false,
  });
  drawSilhouette(maskCtx, input.maskCanvas, {
    color: "#ffffff",
    rotation: input.rotation,
    heightRatio: input.fixedDisplayHeightRatio ?? 0.22,
    mask: true,
  });
}

type DrawOptions = {
  color: string;
  rotation: number;
  heightRatio: number;
  mask: boolean;
};

function drawSilhouette(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, options: DrawOptions): void {
  const height = Math.max(44, canvas.height * options.heightRatio);
  const width = height * 1.95;
  const bodyWidth = width * 0.55;
  const bodyHeight = height * 0.46;
  const headRadius = height * 0.18;
  const legWidth = Math.max(7, height * 0.08);
  const tailWidth = Math.max(9, height * 0.1);
  const centerX = canvas.width * 0.52;
  const centerY = canvas.height * 0.53;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate((options.rotation * Math.PI) / 180);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.strokeStyle = options.mask ? "#ffffff" : shade(options.color, -24);
  ctx.lineWidth = tailWidth;
  ctx.beginPath();
  ctx.moveTo(-bodyWidth * 0.46, -bodyHeight * 0.02);
  ctx.bezierCurveTo(-width * 0.66, -height * 0.06, -width * 0.58, height * 0.33, -width * 0.34, height * 0.2);
  ctx.stroke();

  ctx.strokeStyle = options.mask ? "#ffffff" : shade(options.color, -18);
  ctx.lineWidth = legWidth;
  drawLeg(ctx, -bodyWidth * 0.18, bodyHeight * 0.28, -bodyWidth * 0.28, height * 0.36);
  drawLeg(ctx, bodyWidth * 0.16, bodyHeight * 0.27, bodyWidth * 0.25, height * 0.36);

  ctx.fillStyle = options.color;
  ctx.beginPath();
  ctx.ellipse(0, 0, bodyWidth / 2, bodyHeight / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(bodyWidth * 0.47, -bodyHeight * 0.15, headRadius, 0, Math.PI * 2);
  ctx.fill();

  if (!options.mask) {
    ctx.fillStyle = shade(options.color, 30);
    ctx.beginPath();
    ctx.ellipse(bodyWidth * 0.02, -bodyHeight * 0.18, bodyWidth * 0.3, bodyHeight * 0.18, -0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f8fbef";
    ctx.beginPath();
    ctx.arc(bodyWidth * 0.53, -bodyHeight * 0.22, headRadius * 0.26, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#1f2428";
    ctx.beginPath();
    ctx.arc(bodyWidth * 0.56, -bodyHeight * 0.22, headRadius * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawLeg(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): void {
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();
}

function shade(color: string, amount: number): string {
  const normalized = color.replace("#", "");
  const value = Number.parseInt(normalized.length === 3 ? expandShortHex(normalized) : normalized, 16);
  if (!Number.isFinite(value)) return color;

  const red = clampColor((value >> 16) + amount);
  const green = clampColor(((value >> 8) & 0xff) + amount);
  const blue = clampColor((value & 0xff) + amount);

  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}

function expandShortHex(value: string): string {
  return value
    .split("")
    .map((part) => `${part}${part}`)
    .join("");
}

function clampColor(value: number): number {
  return Math.min(255, Math.max(0, value));
}

function toHex(value: number): string {
  return value.toString(16).padStart(2, "0");
}

function get2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas is unavailable.");

  return ctx;
}
