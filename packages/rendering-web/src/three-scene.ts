import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  OrthographicCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { clearCanvas } from "./paint-surface";

export type ChameleonSceneInput = {
  canvas: HTMLCanvasElement;
  maskCanvas: HTMLCanvasElement;
  poseId: string;
  modelSrc?: string;
  rotation: number;
  color?: string;
  fixedDisplayHeightRatio?: number;
  signal?: AbortSignal;
};

const modelCache = new Map<string, Promise<Object3D>>();

export async function renderChameleonScene(input: ChameleonSceneInput): Promise<void> {
  clearCanvas(input.canvas);
  clearCanvas(input.maskCanvas);

  const modelSrc = input.modelSrc;
  if (modelSrc) {
    try {
      await renderModelScene({ ...input, modelSrc });
      return;
    } catch {
      if (input.signal?.aborted) return;
      renderFallbackSilhouette(input);
      return;
    }
  }

  renderFallbackSilhouette(input);
}

async function renderModelScene(input: ChameleonSceneInput & { modelSrc: string }): Promise<void> {
  const loadedModel = await loadModel(input.modelSrc);
  if (input.signal?.aborted) return;

  const sceneCanvas = makeRenderCanvas(input.canvas);
  const maskRenderCanvas = makeRenderCanvas(input.maskCanvas);
  const sceneModel = cloneModel(loadedModel);
  const maskModel = cloneModel(loadedModel);

  const sceneRenderer = renderModelToCanvas(sceneCanvas, sceneModel, {
    color: input.color ?? "#6f8f66",
    heightRatio: input.fixedDisplayHeightRatio ?? 0.22,
    mask: false,
    rotation: input.rotation,
  });
  const maskRenderer = renderModelToCanvas(maskRenderCanvas, maskModel, {
    color: "#ffffff",
    heightRatio: input.fixedDisplayHeightRatio ?? 0.22,
    mask: true,
    rotation: input.rotation,
  });

  if (input.signal?.aborted) return;

  get2dContext(input.canvas).drawImage(sceneCanvas, 0, 0, input.canvas.width, input.canvas.height);
  get2dContext(input.maskCanvas).drawImage(maskRenderCanvas, 0, 0, input.maskCanvas.width, input.maskCanvas.height);
  sceneRenderer.dispose();
  maskRenderer.dispose();
}

function renderModelToCanvas(
  canvas: HTMLCanvasElement,
  model: Object3D,
  options: DrawOptions,
): WebGLRenderer {
  const scene = new Scene();
  const camera = makeCamera(canvas);

  prepareModel(model, options);
  scene.add(model);

  if (!options.mask) {
    const keyLight = new DirectionalLight("#fff8e8", 2.2);
    keyLight.position.set(2.5, 3.5, 6);
    scene.add(new AmbientLight("#ffffff", 1.8));
    scene.add(keyLight);
  }

  const renderer = new WebGLRenderer({
    alpha: true,
    antialias: true,
    canvas,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(canvas.width, canvas.height, false);
  renderer.setClearColor(new Color("#000000"), 0);
  renderer.render(scene, camera);

  return renderer;
}

function makeCamera(canvas: HTMLCanvasElement): OrthographicCamera {
  const aspect = canvas.width / canvas.height;
  const viewHeight = 2;
  const viewWidth = viewHeight * aspect;
  const camera = new OrthographicCamera(-viewWidth / 2, viewWidth / 2, viewHeight / 2, -viewHeight / 2, 0.1, 100);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);

  return camera;
}

function prepareModel(model: Object3D, options: DrawOptions): void {
  model.rotation.y = Math.PI / 2;
  model.rotation.z = (options.rotation * Math.PI) / 180;
  model.traverse((child: Object3D) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;

    mesh.material = options.mask
      ? new MeshBasicMaterial({ color: "#ffffff" })
      : new MeshStandardMaterial({
          color: options.color,
          metalness: 0.05,
          roughness: 0.68,
        });
  });

  model.updateMatrixWorld(true);
  const box = new Box3().setFromObject(model);
  const center = box.getCenter(new Vector3());
  const size = box.getSize(new Vector3());

  const targetHeight = Math.max(0.08, options.heightRatio * 2);
  const modelHeight = Math.max(size.y, 0.0001);
  const scale = targetHeight / modelHeight;
  model.scale.multiplyScalar(scale);
  model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
}

async function loadModel(modelSrc: string): Promise<Object3D> {
  const cached = modelCache.get(modelSrc);
  if (cached) return cached;

  const promise = new GLTFLoader().loadAsync(modelSrc).then((gltf) => gltf.scene);
  modelCache.set(modelSrc, promise);

  return promise;
}

function cloneModel(model: Object3D): Object3D {
  return model.clone(true);
}

function makeRenderCanvas(reference: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = reference.width;
  canvas.height = reference.height;

  return canvas;
}

function renderFallbackSilhouette(input: ChameleonSceneInput): void {
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
