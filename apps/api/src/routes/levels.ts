import { backgrounds, poses } from "@lopaka/assets";
import type { CreateLevelInput, LevelSummary } from "@lopaka/game-core";
import { Hono } from "hono";

import type { Env } from "../bindings";
import { D1LevelRepository } from "../repositories/d1-level-repository";
import { R2ObjectStore, isSupportedMaskPngFile, type ObjectStore } from "../repositories/r2-object-store";
import type { LevelRepository, SessionRepository } from "../repositories/types";
import { D1SessionRepository } from "../repositories/d1-session-repository";
import { isMaskHit } from "../services/hit-test-service";
import { SESSION_HEADER } from "./session";

export type LevelRouteDependencies = {
  levels?: LevelRepository;
  sessions?: SessionRepository;
  objects?: ObjectStore;
};

type DependencyContext = {
  levels: LevelRepository;
  sessions: SessionRepository;
  objects: ObjectStore;
};

const backgroundIds = new Set(backgrounds.map((background) => background.id));
const poseIds = new Set(poses.map((pose) => pose.id));

const jsonError = (message: string) => ({ error: message });

const makeDependencies = (env: Env, dependencies: LevelRouteDependencies): DependencyContext => ({
  levels: dependencies.levels ?? new D1LevelRepository(env.DB),
  sessions: dependencies.sessions ?? new D1SessionRepository(env.DB),
  objects: dependencies.objects ?? new R2ObjectStore(env.LEVEL_BUCKET, env.SCENE_PUBLIC_BASE_URL),
});

const requireSession = async (sessionId: string | undefined, sessions: SessionRepository) => {
  if (!sessionId || !(await sessions.exists(sessionId))) {
    return null;
  }

  return sessionId;
};

const isImageFile = (value: FormDataEntryValue | null): value is File =>
  value instanceof File && value.type.startsWith("image/");

const isPngFile = (value: FormDataEntryValue | null): value is File => value instanceof File && value.type === "image/png";

const parseCreateLevelInput = (value: FormDataEntryValue | null): CreateLevelInput | null => {
  if (typeof value !== "string") return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;

  const input = parsed as Partial<CreateLevelInput>;
  const { backgroundId, poseId, rotation, imageWidth, imageHeight } = input;
  if (
    typeof backgroundId !== "string" ||
    !backgroundIds.has(backgroundId) ||
    typeof poseId !== "string" ||
    !poseIds.has(poseId) ||
    typeof rotation !== "number" ||
    !Number.isFinite(rotation) ||
    typeof imageWidth !== "number" ||
    !Number.isInteger(imageWidth) ||
    imageWidth <= 0 ||
    typeof imageHeight !== "number" ||
    !Number.isInteger(imageHeight) ||
    imageHeight <= 0
  ) {
    return null;
  }

  return {
    backgroundId,
    poseId,
    rotation,
    imageWidth,
    imageHeight,
  };
};

const withPublicSceneUrl = (summary: LevelSummary, objects: ObjectStore): LevelSummary => ({
  ...summary,
  sceneUrl: objects.getSceneUrl(summary.sceneUrl),
});

const parseGuessBody = (body: unknown): { x: number; y: number; elapsedMs: number } | null => {
  if (!body || typeof body !== "object") return null;
  const guess = body as { x?: unknown; y?: unknown; elapsedMs?: unknown };

  if (
    typeof guess.x !== "number" ||
    !Number.isFinite(guess.x) ||
    typeof guess.y !== "number" ||
    !Number.isFinite(guess.y) ||
    typeof guess.elapsedMs !== "number" ||
    !Number.isFinite(guess.elapsedMs) ||
    guess.elapsedMs < 0
  ) {
    return null;
  }

  return {
    x: guess.x,
    y: guess.y,
    elapsedMs: guess.elapsedMs,
  };
};

const parseSkipBody = (body: unknown): { elapsedMs: number } | null => {
  if (!body || typeof body !== "object") return null;
  const skip = body as { elapsedMs?: unknown };

  if (typeof skip.elapsedMs !== "number" || !Number.isFinite(skip.elapsedMs) || skip.elapsedMs < 0) {
    return null;
  }

  return { elapsedMs: skip.elapsedMs };
};

export function levelsRoutes(dependencies: LevelRouteDependencies = {}) {
  const app = new Hono<{ Bindings: Env }>();

  app.get("/next", async (c) => {
    const { levels, sessions, objects } = makeDependencies(c.env, dependencies);
    const sessionId = await requireSession(c.req.header(SESSION_HEADER), sessions);

    if (!sessionId) {
      return c.json(jsonError("Missing or invalid session."), 401);
    }

    const level = await levels.getNextLevel(sessionId);
    if (!level) {
      return c.json(jsonError("No playable levels found."), 404);
    }

    return c.json(withPublicSceneUrl(level, objects));
  });

  app.post("/", async (c) => {
    const { levels, sessions, objects } = makeDependencies(c.env, dependencies);
    const sessionId = await requireSession(c.req.header(SESSION_HEADER), sessions);

    if (!sessionId) {
      return c.json(jsonError("Missing or invalid session."), 401);
    }

    const form = await c.req.formData().catch(() => null);
    if (!form) {
      return c.json(jsonError("Invalid level upload."), 400);
    }

    const scene = form.get("scene");
    const mask = form.get("mask");
    const metadata = parseCreateLevelInput(form.get("metadata"));

    if (!isImageFile(scene) || !isPngFile(mask) || !metadata) {
      return c.json(jsonError("Invalid level upload."), 400);
    }

    if (!(await isSupportedMaskPngFile(mask))) {
      return c.json(jsonError("Invalid level upload."), 400);
    }

    const levelId = crypto.randomUUID();
    const sceneObjectKey = await objects.putLevelAsset("scene", levelId, scene);
    const maskObjectKey = await objects.putLevelAsset("mask", levelId, mask);
    const level = await levels.createLevel({
      ...metadata,
      creatorSessionId: sessionId,
      sceneObjectKey,
      maskObjectKey,
    });

    return c.json(
      {
        levelId: level.id,
        sceneUrl: objects.getSceneUrl(level.sceneObjectKey),
        imageWidth: level.imageWidth,
        imageHeight: level.imageHeight,
        playTimeLimitSeconds: 300,
      },
      201,
    );
  });

  app.post("/:id/guess", async (c) => {
    const { levels, sessions, objects } = makeDependencies(c.env, dependencies);
    const sessionId = await requireSession(c.req.header(SESSION_HEADER), sessions);

    if (!sessionId) {
      return c.json(jsonError("Missing or invalid session."), 401);
    }

    const level = await levels.getLevel(c.req.param("id"));
    if (!level || level.status !== "published") {
      return c.json(jsonError("Level not found."), 404);
    }

    const guess = parseGuessBody(await c.req.json().catch(() => null));
    if (!guess) {
      return c.json(jsonError("Invalid guess."), 400);
    }

    const mask = await objects.getMask(level.maskObjectKey);
    const hit = isMaskHit(mask, guess.x, guess.y);

    await levels.recordGuess({
      levelId: level.id,
      sessionId,
      x: guess.x,
      y: guess.y,
      elapsedMs: guess.elapsedMs,
      hit,
    });

    return c.json({
      hit,
      nextAction: hit ? "load-next" : "continue",
    });
  });

  app.post("/:id/skip", async (c) => {
    const { levels, sessions } = makeDependencies(c.env, dependencies);
    const sessionId = await requireSession(c.req.header(SESSION_HEADER), sessions);

    if (!sessionId) {
      return c.json(jsonError("Missing or invalid session."), 401);
    }

    const level = await levels.getLevel(c.req.param("id"));
    if (!level || level.status !== "published") {
      return c.json(jsonError("Level not found."), 404);
    }

    const skip = parseSkipBody(await c.req.json().catch(() => null));
    if (!skip) {
      return c.json(jsonError("Invalid skip."), 400);
    }

    await levels.recordSkip({
      levelId: c.req.param("id"),
      sessionId,
      elapsedMs: skip.elapsedMs,
    });

    return c.body(null, 204);
  });

  return app;
}
