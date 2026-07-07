import type { BackgroundAsset, PoseAsset } from "@lopaka/game-core";
import { bakeScene, compositePaintToSurface, paintStroke, renderChameleonScene } from "@lopaka/rendering-web";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

import { LopakaApiClient } from "../api/client";
import { TimerBar } from "../components/TimerBar";
import { BrowserSessionStore } from "../platform/browser-session-store";
import { createInitialCreatorState, creatorReducer } from "./creator-state";

const DEFAULT_IMAGE_WIDTH = 1280;
const DEFAULT_IMAGE_HEIGHT = 720;
const CHAMELEON_BASE_COLOR = "#6f8f66";

type AssetStatus = "loading" | "ready" | "failed";

export function CreatorScreen() {
  const [state, dispatch] = useReducer(creatorReducer, undefined, () =>
    createInitialCreatorState({ nowMs: Date.now() }),
  );
  const [backgrounds, setBackgrounds] = useState<BackgroundAsset[]>([]);
  const [poses, setPoses] = useState<PoseAsset[]>([]);
  const [assetStatus, setAssetStatus] = useState<AssetStatus>("loading");
  const seededAssetsRef = useRef(false);
  const backgroundCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const chameleonCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const paintCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const api = useMemo(
    () =>
      new LopakaApiClient({
        baseUrl: import.meta.env.VITE_API_BASE_URL ?? "",
        sessionStore: new BrowserSessionStore(),
      }),
    [],
  );

  const selectedBackground = backgrounds.find((background) => background.id === state.selectedBackgroundId) ?? null;
  const selectedPose = poses.find((pose) => pose.id === state.selectedPoseId) ?? null;
  const imageWidth = selectedBackground?.width ?? DEFAULT_IMAGE_WIDTH;
  const imageHeight = selectedBackground?.height ?? DEFAULT_IMAGE_HEIGHT;
  const canSave =
    Boolean(selectedBackground && selectedPose) && state.saveStatus !== "saving" && state.saveStatus !== "saved";

  useEffect(() => {
    let isMounted = true;

    Promise.all([api.getBackgrounds(), api.getPoses()])
      .then(([loadedBackgrounds, loadedPoses]) => {
        if (!isMounted) return;

        setBackgrounds(loadedBackgrounds);
        setPoses(loadedPoses);
        setAssetStatus("ready");

        if (!seededAssetsRef.current) {
          const firstBackground = loadedBackgrounds[0];
          const firstPose = loadedPoses[0];
          if (firstBackground) {
            dispatch({ type: "select-background", backgroundId: firstBackground.id });
          }
          if (firstPose) {
            dispatch({ type: "select-pose", poseId: firstPose.id });
            dispatch({ type: "set-rotation", rotation: firstPose.defaultRotation });
          }
          seededAssetsRef.current = true;
        }
      })
      .catch(() => {
        if (isMounted) {
          setAssetStatus("failed");
        }
      });

    return () => {
      isMounted = false;
    };
  }, [api]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      dispatch({ type: "tick", nowMs: Date.now() });
    }, 250);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const canvas = backgroundCanvasRef.current;
    if (!canvas) return;

    canvas.width = imageWidth;
    canvas.height = imageHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!selectedBackground) {
      drawBackgroundFallback(ctx, canvas, assetStatus === "failed" ? "Backgrounds unavailable" : "Loading backgrounds");
      return;
    }

    let isCancelled = false;
    const image = new Image();
    image.onload = () => {
      if (isCancelled) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    image.onerror = () => {
      if (!isCancelled) {
        drawBackgroundFallback(ctx, canvas, selectedBackground.name);
      }
    };
    image.src = selectedBackground.src;

    return () => {
      isCancelled = true;
    };
  }, [assetStatus, imageHeight, imageWidth, selectedBackground]);

  useEffect(() => {
    const chameleonCanvas = chameleonCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!chameleonCanvas || !maskCanvas) return;
    const abortController = new AbortController();

    chameleonCanvas.width = imageWidth;
    chameleonCanvas.height = imageHeight;
    maskCanvas.width = imageWidth;
    maskCanvas.height = imageHeight;
    const paintCanvas = getPersistentPaintCanvas(paintCanvasRef, imageWidth, imageHeight);

    const renderInput = {
      canvas: chameleonCanvas,
      maskCanvas,
      poseId: selectedPose?.id ?? "placeholder",
      rotation: state.rotation,
      color: CHAMELEON_BASE_COLOR,
      signal: abortController.signal,
    };

    void renderChameleonScene(
      selectedPose
        ? {
            ...renderInput,
            modelSrc: selectedPose.modelSrc,
            fixedDisplayHeightRatio: selectedPose.fixedDisplayHeightRatio,
          }
        : renderInput,
    ).then(() => {
      if (abortController.signal.aborted) return;

      compositePaintToSurface({
        surfaceCanvas: chameleonCanvas,
        paintCanvas,
        maskCanvas,
      });
    });

    return () => {
      abortController.abort();
    };
  }, [imageHeight, imageWidth, selectedPose, state.rotation]);

  const saveLevel = useCallback(async () => {
    if (!canSave || !selectedBackground || !selectedPose) return;

    const backgroundCanvas = backgroundCanvasRef.current;
    const chameleonCanvas = chameleonCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!backgroundCanvas || !chameleonCanvas || !maskCanvas) return;

    dispatch({ type: "saving" });

    try {
      const baked = await bakeScene({
        backgroundCanvas,
        chameleonCanvas,
        maskCanvas,
        imageWidth,
        imageHeight,
      });
      const result = await api.createLevel({
        metadata: {
          backgroundId: selectedBackground.id,
          poseId: selectedPose.id,
          rotation: state.rotation,
          imageWidth: baked.imageWidth,
          imageHeight: baked.imageHeight,
        },
        scene: baked.sceneBlob,
        mask: baked.maskBlob,
      });

      dispatch({ type: "saved", levelId: result.levelId });
    } catch (error) {
      dispatch({
        type: "save-failed",
        message: error instanceof Error ? error.message : "Unable to save level.",
      });
    }
  }, [api, canSave, imageHeight, imageWidth, selectedBackground, selectedPose, state.rotation]);

  useEffect(() => {
    if (state.shouldAutoSave) {
      void saveLevel();
    }
  }, [saveLevel, state.shouldAutoSave]);

  const paintAtPointer = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!state.canPaint) return;

      const canvas = chameleonCanvasRef.current;
      const maskCanvas = maskCanvasRef.current;
      if (!canvas || !maskCanvas) return;
      const paintCanvas = getPersistentPaintCanvas(paintCanvasRef, canvas.width, canvas.height);

      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
      const y = ((event.clientY - rect.top) / rect.height) * canvas.height;

      paintStroke({
        canvas: paintCanvas,
        point: { x, y },
        color: state.color,
        brushSize: state.brushSize,
      });
      compositePaintToSurface({
        surfaceCanvas: canvas,
        paintCanvas,
        maskCanvas,
      });
    },
    [state.brushSize, state.canPaint, state.color],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      paintAtPointer(event);
    },
    [paintAtPointer],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (event.buttons === 1) {
        paintAtPointer(event);
      }
    },
    [paintAtPointer],
  );

  return (
    <div className="screen-layout">
      <div className="screen-toolbar" style={toolbarStyle}>
        <TimerBar remainingMs={state.remainingMs} durationMs={state.durationMs} />
        <button type="button" style={primaryButtonStyle} disabled={!canSave} onClick={() => void saveLevel()}>
          {state.saveStatus === "saving" ? "Saving" : "Save"}
        </button>
      </div>

      <div style={workspaceStyle}>
        <div className="stage-frame" aria-label="Create canvas" style={{ aspectRatio: `${imageWidth} / ${imageHeight}` }}>
          <div style={canvasStackStyle}>
            <canvas ref={backgroundCanvasRef} width={imageWidth} height={imageHeight} style={canvasLayerStyle} />
            <canvas ref={chameleonCanvasRef} width={imageWidth} height={imageHeight} style={canvasLayerStyle} />
            <canvas
              ref={maskCanvasRef}
              width={imageWidth}
              height={imageHeight}
              aria-hidden="true"
              style={hiddenCanvasStyle}
            />
            <canvas
              aria-label="Paint chameleon"
              width={imageWidth}
              height={imageHeight}
              style={paintInputStyle}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
            />
          </div>
        </div>

        <div style={controlsStyle} aria-label="Creator controls">
          <label style={fieldStyle}>
            <span style={labelStyle}>Background</span>
            <select
              value={state.selectedBackgroundId ?? ""}
              disabled={assetStatus !== "ready"}
              onChange={(event) => dispatch({ type: "select-background", backgroundId: event.target.value })}
            >
              {backgrounds.map((background) => (
                <option key={background.id} value={background.id}>
                  {background.name}
                </option>
              ))}
            </select>
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Pose</span>
            <select
              value={state.selectedPoseId ?? ""}
              disabled={assetStatus !== "ready"}
              onChange={(event) => {
                const pose = poses.find((item) => item.id === event.target.value);
                dispatch({ type: "select-pose", poseId: event.target.value });
                if (pose) {
                  dispatch({ type: "set-rotation", rotation: pose.defaultRotation });
                }
              }}
            >
              {poses.map((pose) => (
                <option key={pose.id} value={pose.id}>
                  {pose.name}
                </option>
              ))}
            </select>
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Color</span>
            <input
              type="color"
              value={state.color}
              disabled={!state.canPaint}
              onChange={(event) => dispatch({ type: "set-color", color: event.target.value })}
            />
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Brush {state.brushSize}px</span>
            <input
              type="range"
              min={state.brushSizeRange.min}
              max={state.brushSizeRange.max}
              step={state.brushSizeRange.step}
              value={state.brushSize}
              disabled={!state.canPaint}
              onChange={(event) => dispatch({ type: "set-brush-size", brushSize: event.target.valueAsNumber })}
            />
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Rotation {state.rotation}deg</span>
            <input
              type="range"
              min={0}
              max={359}
              step={1}
              value={state.rotation}
              onChange={(event) => dispatch({ type: "set-rotation", rotation: event.target.valueAsNumber })}
            />
          </label>

          <div style={rotationButtonRowStyle}>
            <button
              type="button"
              style={secondaryButtonStyle}
              onClick={() => dispatch({ type: "set-rotation", rotation: state.rotation - 15 })}
            >
              Rotate -15
            </button>
            <button
              type="button"
              style={secondaryButtonStyle}
              onClick={() => dispatch({ type: "set-rotation", rotation: state.rotation + 15 })}
            >
              Rotate +15
            </button>
          </div>

          <p role="status" style={statusStyle}>
            {statusText(assetStatus, state.saveStatus, state.levelId, state.errorMessage)}
          </p>
        </div>
      </div>
    </div>
  );
}

function getPersistentPaintCanvas(
  ref: React.MutableRefObject<HTMLCanvasElement | null>,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = ref.current ?? document.createElement("canvas");
  ref.current = canvas;

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  return canvas;
}

function drawBackgroundFallback(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, label: string): void {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#efe8db";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(111, 148, 166, 0.22)";
  ctx.fillRect(0, canvas.height * 0.62, canvas.width, canvas.height * 0.38);
  ctx.fillStyle = "#43583f";
  ctx.font = "700 42px ui-sans-serif, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, canvas.width / 2, canvas.height / 2);
}

function statusText(
  assetStatus: AssetStatus,
  saveStatus: string,
  levelId: string | null,
  errorMessage: string | null,
): string {
  if (assetStatus === "loading") return "Loading creator assets.";
  if (assetStatus === "failed") return "Creator assets are unavailable.";
  if (saveStatus === "saving") return "Saving level.";
  if (saveStatus === "saved") return `Saved ${levelId ?? "level"}.`;
  if (saveStatus === "failed") return errorMessage ?? "Save failed.";

  return "Paint the chameleon before time runs out.";
}

const toolbarStyle = {
  gap: 12,
  justifyContent: "flex-end",
  flexWrap: "wrap",
} satisfies React.CSSProperties;

const workspaceStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
  gap: 14,
  alignItems: "start",
} satisfies React.CSSProperties;

const canvasStackStyle = {
  position: "relative",
  width: "100%",
  height: "100%",
} satisfies React.CSSProperties;

const canvasLayerStyle = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
} satisfies React.CSSProperties;

const hiddenCanvasStyle = {
  display: "none",
} satisfies React.CSSProperties;

const paintInputStyle = {
  ...canvasLayerStyle,
  touchAction: "none",
  cursor: "crosshair",
} satisfies React.CSSProperties;

const controlsStyle = {
  display: "grid",
  gap: 12,
  padding: 14,
  border: "1px solid var(--line)",
  background: "rgb(255 255 255 / 72%)",
} satisfies React.CSSProperties;

const fieldStyle = {
  display: "grid",
  gap: 6,
  color: "var(--ink)",
  fontSize: 14,
  fontWeight: 700,
} satisfies React.CSSProperties;

const labelStyle = {
  color: "var(--muted)",
  fontSize: 12,
  textTransform: "uppercase",
} satisfies React.CSSProperties;

const rotationButtonRowStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
} satisfies React.CSSProperties;

const primaryButtonStyle = {
  minWidth: 88,
  height: 44,
  border: 0,
  color: "#fffdf7",
  background: "var(--moss-strong)",
  fontWeight: 800,
  cursor: "pointer",
} satisfies React.CSSProperties;

const secondaryButtonStyle = {
  minHeight: 38,
  border: "1px solid var(--line)",
  color: "var(--ink)",
  background: "var(--paper)",
  fontWeight: 750,
  cursor: "pointer",
} satisfies React.CSSProperties;

const statusStyle = {
  minHeight: 36,
  margin: 0,
  color: "var(--muted)",
  fontSize: 13,
  lineHeight: 1.35,
} satisfies React.CSSProperties;
