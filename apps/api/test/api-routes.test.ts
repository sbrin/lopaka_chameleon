import { describe, expect, it } from "vitest";

import { createApp } from "../src/app";
import type { ObjectStore } from "../src/repositories/r2-object-store";
import type { LevelRepository, NewLevelRecord, SessionRepository, StoredLevel } from "../src/repositories/types";
import type { Env } from "../src/bindings";
import type { AnonymousSession, LevelSummary } from "@lopaka/game-core";
import type { MaskBitmap } from "../src/services/hit-test-service";

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

class FakeSessionRepository implements SessionRepository {
  readonly sessions = new Set<string>();

  async createOrRefresh(sessionId: string = "session-test"): Promise<AnonymousSession> {
    this.sessions.add(sessionId);
    return {
      id: sessionId,
      createdAt: "2026-07-06T00:00:00.000Z",
      lastSeenAt: "2026-07-06T00:00:00.000Z",
      userId: null,
    };
  }

  async exists(sessionId: string): Promise<boolean> {
    return this.sessions.has(sessionId);
  }
}

class FakeLevelRepository implements LevelRepository {
  readonly guesses: Array<{ levelId: string; sessionId: string; x: number; y: number; elapsedMs: number; hit: boolean }> = [];
  readonly skips: Array<{ levelId: string; sessionId: string; elapsedMs: number }> = [];
  readonly created: NewLevelRecord[] = [];
  nextLevel: LevelSummary | null = {
    levelId: "level-public",
    sceneUrl: "scenes/level-public.png",
    imageWidth: 640,
    imageHeight: 480,
    playTimeLimitSeconds: 300,
  };
  private readonly levels = new Map<string, StoredLevel>();

  seedLevel(level: StoredLevel): void {
    this.levels.set(level.id, level);
  }

  async createLevel(input: NewLevelRecord): Promise<StoredLevel> {
    this.created.push(input);
    const level: StoredLevel = {
      id: "level-created",
      creatorSessionId: input.creatorSessionId,
      backgroundId: input.backgroundId,
      poseId: input.poseId,
      rotation: input.rotation,
      sceneObjectKey: input.sceneObjectKey,
      maskObjectKey: input.maskObjectKey,
      imageWidth: input.imageWidth,
      imageHeight: input.imageHeight,
      status: "published",
    };
    this.levels.set(level.id, level);
    return level;
  }

  async getLevel(id: string): Promise<StoredLevel | null> {
    return this.levels.get(id) ?? null;
  }

  async getNextLevel(): Promise<LevelSummary | null> {
    return this.nextLevel;
  }

  async recordGuess(input: {
    levelId: string;
    sessionId: string;
    x: number;
    y: number;
    elapsedMs: number;
    hit: boolean;
  }): Promise<void> {
    this.guesses.push(input);
  }

  async recordSkip(input: { levelId: string; sessionId: string; elapsedMs: number }): Promise<void> {
    this.skips.push(input);
  }
}

class FakeObjectStore implements ObjectStore {
  readonly puts: Array<{ kind: "scene" | "mask"; levelId: string; file: File }> = [];
  mask: MaskBitmap = {
    width: 5,
    height: 5,
    alphaAt: (x: number, y: number) => (x === 2 && y === 2 ? 255 : 0),
  };

  async putLevelAsset(kind: "scene" | "mask", levelId: string, file: File): Promise<string> {
    this.puts.push({ kind, levelId, file });
    return `${kind}s/${levelId}.png`;
  }

  getSceneUrl(objectKey: string): string {
    return `https://cdn.example.test/${objectKey}`;
  }

  async getMask(): Promise<MaskBitmap> {
    return this.mask;
  }
}

const makeApp = () => {
  const sessions = new FakeSessionRepository();
  const levels = new FakeLevelRepository();
  const objects = new FakeObjectStore();
  const app = createApp({ sessions, levels, objects });
  const env = {} as Env;

  return { app, env, sessions, levels, objects };
};

const privatePayloadKeys = ["maskUrl", "mask_object_key", "maskObjectKey", "poseId", "rotation", "modelSrc"] as const;

const expectNoPrivateFields = (value: unknown): void => {
  const serialized = JSON.stringify(value);
  for (const key of privatePayloadKeys) {
    expect(serialized).not.toContain(key);
  }
};

describe("API routes", () => {
  it("creates an anonymous session", async () => {
    const { app, env } = makeApp();

    const response = await app.request("/api/session", { method: "POST" }, env);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      id: expect.any(String),
      userId: null,
    });
  });

  it("returns static background and pose manifests", async () => {
    const { app, env } = makeApp();

    const backgroundsResponse = await app.request("/api/backgrounds", {}, env);
    const posesResponse = await app.request("/api/poses", {}, env);

    await expect(backgroundsResponse.json()).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "studio-desk" })]),
    );
    await expect(posesResponse.json()).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ id: "og-standing" })]));
  });

  it("rejects authenticated MVP routes without the session header", async () => {
    const { app, env } = makeApp();

    await expect(app.request("/api/levels/next", {}, env)).resolves.toMatchObject({ status: 401 });
    await expect(app.request("/api/levels", { method: "POST" }, env)).resolves.toMatchObject({ status: 401 });
    await expect(app.request("/api/levels/level-public/guess", { method: "POST" }, env)).resolves.toMatchObject({
      status: 401,
    });
    await expect(app.request("/api/levels/level-public/skip", { method: "POST" }, env)).resolves.toMatchObject({
      status: 401,
    });
  });

  it("returns the next level with a public scene URL and no private fields", async () => {
    const { app, env, sessions } = makeApp();
    await sessions.createOrRefresh("session-player");

    const response = await app.request("/api/levels/next", {
      headers: { "x-lopaka-session-id": "session-player" },
    }, env);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      levelId: "level-public",
      sceneUrl: "https://cdn.example.test/scenes/level-public.png",
      imageWidth: 640,
      imageHeight: 480,
      playTimeLimitSeconds: 300,
    });
    expectNoPrivateFields(body);
  });

  it("stores uploaded scene and mask objects before creating level metadata", async () => {
    const { app, env, sessions, levels, objects } = makeApp();
    await sessions.createOrRefresh("session-creator");
    const form = new FormData();
    form.set("scene", new File(["scene"], "scene.webp", { type: "image/webp" }));
    form.set("mask", new File([blobPartFromBytes(decodeBase64(rgbaPngFixture))], "mask.png", { type: "image/png" }));
    form.set(
      "metadata",
      JSON.stringify({
        backgroundId: "studio-desk",
        poseId: "og-standing",
        rotation: 0,
        imageWidth: 640,
        imageHeight: 480,
      }),
    );

    const response = await app.request("/api/levels", {
      method: "POST",
      headers: { "x-lopaka-session-id": "session-creator" },
      body: form,
    }, env);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(objects.puts.map((put) => put.kind)).toEqual(["scene", "mask"]);
    expect(objects.puts[0]?.file.type).toBe("image/webp");
    expect(objects.puts[1]?.file.type).toBe("image/png");
    const sceneObjectKey = "scenes/" + objects.puts[0]?.levelId + ".png";
    const maskObjectKey = "masks/" + objects.puts[1]?.levelId + ".png";
    expect(levels.created).toEqual([
      expect.objectContaining({
        creatorSessionId: "session-creator",
        sceneObjectKey,
        maskObjectKey,
      }),
    ]);
    expect(body).toEqual({
      levelId: "level-created",
      sceneUrl: `https://cdn.example.test/${sceneObjectKey}`,
      imageWidth: 640,
      imageHeight: 480,
      playTimeLimitSeconds: 300,
    });
    expectNoPrivateFields(body);
  });

  it("rejects invalid level uploads", async () => {
    const { app, env, sessions } = makeApp();
    await sessions.createOrRefresh("session-creator");
    const form = new FormData();
    form.set("scene", new File(["not an image"], "scene.txt", { type: "text/plain" }));
    form.set("mask", new File(["mask"], "mask.png", { type: "image/png" }));
    form.set(
      "metadata",
      JSON.stringify({
        backgroundId: "missing-background",
        poseId: "og-standing",
        rotation: 0,
        imageWidth: 640,
        imageHeight: 480,
      }),
    );

    const response = await app.request("/api/levels", {
      method: "POST",
      headers: { "x-lopaka-session-id": "session-creator" },
      body: form,
    }, env);

    expect(response.status).toBe(400);
  });

  it("rejects non-PNG mask uploads before storing objects", async () => {
    const { app, env, sessions, objects } = makeApp();
    await sessions.createOrRefresh("session-creator");
    const form = new FormData();
    form.set("scene", new File(["scene"], "scene.webp", { type: "image/webp" }));
    form.set("mask", new File(["mask"], "mask.webp", { type: "image/webp" }));
    form.set(
      "metadata",
      JSON.stringify({
        backgroundId: "studio-desk",
        poseId: "og-standing",
        rotation: 0,
        imageWidth: 640,
        imageHeight: 480,
      }),
    );

    const response = await app.request("/api/levels", {
      method: "POST",
      headers: { "x-lopaka-session-id": "session-creator" },
      body: form,
    }, env);

    expect(response.status).toBe(400);
    expect(objects.puts).toEqual([]);
  });

  it("rejects malformed PNG mask uploads before storing objects or creating level metadata", async () => {
    const { app, env, sessions, levels, objects } = makeApp();
    await sessions.createOrRefresh("session-creator");
    const form = new FormData();
    form.set("scene", new File(["scene"], "scene.webp", { type: "image/webp" }));
    form.set("mask", new File(["not a png"], "mask.png", { type: "image/png" }));
    form.set(
      "metadata",
      JSON.stringify({
        backgroundId: "studio-desk",
        poseId: "og-standing",
        rotation: 0,
        imageWidth: 640,
        imageHeight: 480,
      }),
    );

    const response = await app.request("/api/levels", {
      method: "POST",
      headers: { "x-lopaka-session-id": "session-creator" },
      body: form,
    }, env);

    expect(response.status).toBe(400);
    expect(objects.puts).toEqual([]);
    expect(levels.created).toEqual([]);
  });

  it("records guesses using the private mask object without exposing private fields", async () => {
    const { app, env, sessions, levels } = makeApp();
    await sessions.createOrRefresh("session-player");
    levels.seedLevel({
      id: "level-private",
      creatorSessionId: "session-creator",
      backgroundId: "studio-desk",
      poseId: "og-standing",
      rotation: 0,
      sceneObjectKey: "scenes/level-private.png",
      maskObjectKey: "masks/level-private.png",
      imageWidth: 5,
      imageHeight: 5,
      status: "published",
    });

    const response = await app.request("/api/levels/level-private/guess", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-lopaka-session-id": "session-player",
      },
      body: JSON.stringify({ x: 2, y: 2, elapsedMs: 1200 }),
    }, env);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ hit: true, nextAction: "load-next" });
    expect(levels.guesses).toEqual([
      {
        levelId: "level-private",
        sessionId: "session-player",
        x: 2,
        y: 2,
        elapsedMs: 1200,
        hit: true,
      },
    ]);
    expectNoPrivateFields(body);
  });

  it("records skips for the authenticated session", async () => {
    const { app, env, sessions, levels } = makeApp();
    await sessions.createOrRefresh("session-player");
    levels.seedLevel({
      id: "level-public",
      creatorSessionId: "session-creator",
      backgroundId: "studio-desk",
      poseId: "og-standing",
      rotation: 0,
      sceneObjectKey: "scenes/level-public.png",
      maskObjectKey: "masks/level-public.png",
      imageWidth: 640,
      imageHeight: 480,
      status: "published",
    });

    const response = await app.request("/api/levels/level-public/skip", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-lopaka-session-id": "session-player",
      },
      body: JSON.stringify({ elapsedMs: 2200 }),
    }, env);

    expect(response.status).toBe(204);
    expect(levels.skips).toEqual([{ levelId: "level-public", sessionId: "session-player", elapsedMs: 2200 }]);
  });
});
