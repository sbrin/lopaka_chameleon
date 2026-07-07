import type { LevelSummary } from "@lopaka/game-core";
import { mapRenderedPointToImagePoint, PLAY_SECONDS } from "@lopaka/game-core";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";

import { LopakaApiClient } from "../api/client";
import { TimerBar } from "../components/TimerBar";
import { BrowserSessionStore } from "../platform/browser-session-store";
import { getContainedImageRect } from "./image-coordinates";

type PlayStatus = "loading" | "ready" | "empty" | "failed";

const durationMs = PLAY_SECONDS * 1000;

export function PlayScreen() {
  const [level, setLevel] = useState<LevelSummary | null>(null);
  const [status, setStatus] = useState<PlayStatus>("loading");
  const [remainingMs, setRemainingMs] = useState(durationMs);
  const [message, setMessage] = useState("Loading level");
  const imageRef = useRef<HTMLImageElement | null>(null);
  const levelStartedAtRef = useRef(Date.now());
  const isMountedRef = useRef(false);
  const isAdvancingRef = useRef(false);
  const isGuessingRef = useRef(false);

  const api = useMemo(
    () =>
      new LopakaApiClient({
        baseUrl: import.meta.env.VITE_API_BASE_URL ?? "",
        sessionStore: new BrowserSessionStore(),
      }),
    [],
  );

  const applyNextLevel = useCallback((nextLevel: LevelSummary | null) => {
    if (!isMountedRef.current) return;

    isAdvancingRef.current = false;
    setLevel(nextLevel);
    setRemainingMs(durationMs);

    if (!nextLevel) {
      setStatus("empty");
      setMessage("No levels available");
      return;
    }

    levelStartedAtRef.current = Date.now();
    setStatus("ready");
    setMessage("");
  }, []);

  const failPlayMode = useCallback((error: unknown) => {
    if (!isMountedRef.current) return;

    isAdvancingRef.current = false;
    setStatus("failed");
    setMessage(error instanceof Error ? error.message : "Unable to load play mode.");
  }, []);

  const loadNextLevel = useCallback(async () => {
    isAdvancingRef.current = true;
    setStatus("loading");
    setMessage("Loading level");

    try {
      await api.ensureSession();
      const nextLevel = await api.getNextLevel();
      applyNextLevel(nextLevel);
    } catch (error) {
      failPlayMode(error);
    }
  }, [api, applyNextLevel, failPlayMode]);

  useEffect(() => {
    isMountedRef.current = true;
    void loadNextLevel();

    return () => {
      isMountedRef.current = false;
    };
  }, [loadNextLevel]);

  const elapsedMs = useCallback(
    () => Math.min(durationMs, Math.max(0, Date.now() - levelStartedAtRef.current)),
    [],
  );

  const skipCurrentLevel = useCallback(async () => {
    if (!level || isAdvancingRef.current) return;

    isAdvancingRef.current = true;
    setStatus("loading");
    setMessage("Loading level");

    try {
      const nextLevel = await api.skip({ levelId: level.levelId, elapsedMs: elapsedMs() });
      applyNextLevel(nextLevel);
    } catch (error) {
      failPlayMode(error);
    }
  }, [api, applyNextLevel, elapsedMs, failPlayMode, level]);

  useEffect(() => {
    if (status !== "ready" || !level) return;

    const tick = () => {
      const nextRemainingMs = Math.max(0, durationMs - elapsedMs());
      setRemainingMs(nextRemainingMs);

      if (nextRemainingMs === 0) {
        void skipCurrentLevel();
      }
    };

    tick();
    const intervalId = window.setInterval(tick, 250);

    return () => window.clearInterval(intervalId);
  }, [elapsedMs, level, skipCurrentLevel, status]);

  const handlePointerDown = useCallback(
    async (event: PointerEvent<HTMLImageElement>) => {
      if (!level || status !== "ready" || isGuessingRef.current || isAdvancingRef.current) return;

      const image = imageRef.current;
      if (!image) return;

      const renderedRect = getContainedImageRect(image.getBoundingClientRect(), level.imageWidth, level.imageHeight);
      const isInsideImage =
        event.clientX >= renderedRect.left &&
        event.clientX <= renderedRect.left + renderedRect.width &&
        event.clientY >= renderedRect.top &&
        event.clientY <= renderedRect.top + renderedRect.height;

      if (!isInsideImage) return;

      const point = mapRenderedPointToImagePoint({
        clientX: event.clientX,
        clientY: event.clientY,
        renderedRect,
        imageSize: { width: level.imageWidth, height: level.imageHeight },
      });

      isGuessingRef.current = true;
      setMessage("");

      try {
        const result = await api.guess({
          levelId: level.levelId,
          x: point.x,
          y: point.y,
          elapsedMs: elapsedMs(),
        });

        if (result.hit || result.nextAction === "load-next") {
          await loadNextLevel();
        } else if (isMountedRef.current) {
          setMessage("Try again");
        }
      } catch (error) {
        if (isMountedRef.current) {
          setMessage(error instanceof Error ? error.message : "Unable to submit guess.");
        }
      } finally {
        isGuessingRef.current = false;
      }
    },
    [api, elapsedMs, level, loadNextLevel, status],
  );

  const canSkip = status === "ready" && Boolean(level) && !isAdvancingRef.current;

  return (
    <div className="screen-layout">
      <div className="screen-toolbar" style={toolbarStyle}>
        <TimerBar remainingMs={remainingMs} durationMs={durationMs} />
        <button type="button" style={secondaryButtonStyle} disabled={!canSkip} onClick={() => void skipCurrentLevel()}>
          Skip
        </button>
      </div>

      <div
        className="stage-frame"
        aria-label="Play canvas"
        style={{ aspectRatio: level ? `${level.imageWidth} / ${level.imageHeight}` : "16 / 9" }}
      >
        {level ? (
          <img
            ref={imageRef}
            src={level.sceneUrl}
            alt="Hidden chameleon scene"
            draggable={false}
            onPointerDown={(event) => void handlePointerDown(event)}
            style={sceneImageStyle}
          />
        ) : (
          <div className="stage-frame__empty" role="status">
            <span>{message}</span>
          </div>
        )}
      </div>

      {level && message ? (
        <p role="status" aria-live="polite" style={messageStyle}>
          {message}
        </p>
      ) : null}
    </div>
  );
}

const toolbarStyle = {
  gap: "12px",
} satisfies CSSProperties;

const secondaryButtonStyle = {
  minWidth: "82px",
  minHeight: "44px",
  border: "1px solid rgb(31 36 40 / 18%)",
  background: "rgb(251 250 245 / 88%)",
  color: "rgb(31 36 40)",
  fontWeight: 800,
  cursor: "pointer",
} satisfies CSSProperties;

const sceneImageStyle = {
  width: "100%",
  height: "100%",
  objectFit: "contain",
  userSelect: "none",
  touchAction: "manipulation",
  cursor: "crosshair",
} satisfies CSSProperties;

const messageStyle = {
  margin: 0,
  minHeight: "20px",
  color: "rgb(31 36 40 / 72%)",
  fontSize: "14px",
  fontWeight: 700,
  textAlign: "center",
} satisfies CSSProperties;
