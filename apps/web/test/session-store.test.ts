import { describe, expect, it, vi } from "vitest";

import { LopakaApiClient } from "../src/api/client";
import { BrowserSessionStore } from "../src/platform/browser-session-store";

type FetchCall = {
  url: string;
  init: RequestInit | undefined;
};

const anonymousSession = (id: string) => ({
  id,
  createdAt: "2026-07-06T00:00:00.000Z",
  lastSeenAt: "2026-07-06T00:00:00.000Z",
  userId: null,
});

const levelSummary = (levelId: string) => ({
  levelId,
  sceneUrl: `https://cdn.example.com/${levelId}.png`,
  imageWidth: 1280,
  imageHeight: 720,
  playTimeLimitSeconds: 300 as const,
});

class MemorySessionStore {
  constructor(private sessionId: string | null = null) {}

  async getSessionId(): Promise<string | null> {
    return this.sessionId;
  }

  async setSessionId(sessionId: string): Promise<void> {
    this.sessionId = sessionId;
  }

  async clearSessionId(): Promise<void> {
    this.sessionId = null;
  }
}

const jsonResponse = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "content-type": "application/json", ...init?.headers },
  });

const makeFetch = (responses: Response[]) => {
  const calls: FetchCall[] = [];
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: input.toString(), init });
    const response = responses.shift();
    if (!response) {
      throw new Error(`Unexpected request to ${input.toString()}`);
    }
    return response;
  }) satisfies typeof fetch;

  return { calls, fetchImpl };
};

const headerValue = (init: RequestInit | undefined, name: string) => new Headers(init?.headers).get(name);

const installFakeLocalStorage = () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    get length() {
      return values.size;
    },
  } satisfies Storage;

  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: storage,
  });
};

describe("BrowserSessionStore", () => {
  it("persists the session id in localStorage", async () => {
    installFakeLocalStorage();
    const store = new BrowserSessionStore("test-session");

    await store.setSessionId("session-1");

    expect(await store.getSessionId()).toBe("session-1");

    await store.clearSessionId();

    expect(await store.getSessionId()).toBeNull();
  });
});

describe("LopakaApiClient session handling", () => {
  it("reuses a stored session id when ensuring a session", async () => {
    const { calls, fetchImpl } = makeFetch([jsonResponse(anonymousSession("session-existing"))]);
    const store = new MemorySessionStore("session-existing");
    const client = new LopakaApiClient({
      baseUrl: "https://api.example.com",
      sessionStore: store,
      fetchImpl,
    });

    const session = await client.ensureSession();

    expect(session.id).toBe("session-existing");
    expect(await store.getSessionId()).toBe("session-existing");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://api.example.com/api/session");
    expect(headerValue(calls[0]?.init, "x-lopaka-session-id")).toBe("session-existing");
  });

  it("stores a new session id returned by the API", async () => {
    const { calls, fetchImpl } = makeFetch([jsonResponse(anonymousSession("session-new"))]);
    const store = new MemorySessionStore();
    const client = new LopakaApiClient({
      baseUrl: "https://api.example.com/",
      sessionStore: store,
      fetchImpl,
    });

    const session = await client.ensureSession();

    expect(session.id).toBe("session-new");
    expect(await store.getSessionId()).toBe("session-new");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://api.example.com/api/session");
    expect(headerValue(calls[0]?.init, "x-lopaka-session-id")).toBeNull();
  });

  it("sends the stored session id when creating a level", async () => {
    const { calls, fetchImpl } = makeFetch([jsonResponse({ levelId: "level-1" }, { status: 201 })]);
    const client = new LopakaApiClient({
      baseUrl: "https://api.example.com",
      sessionStore: new MemorySessionStore("session-create"),
      fetchImpl,
    });

    await client.createLevel({
      metadata: {
        backgroundId: "studio-desk",
        poseId: "og-standing",
        rotation: 0,
        imageWidth: 1280,
        imageHeight: 720,
      },
      scene: new Blob(["scene"], { type: "image/png" }),
      mask: new Blob(["mask"], { type: "image/png" }),
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://api.example.com/api/levels");
    expect(calls[0]?.init?.method).toBe("POST");
    expect(headerValue(calls[0]?.init, "x-lopaka-session-id")).toBe("session-create");
    expect(calls[0]?.init?.body).toBeInstanceOf(FormData);
  });

  it("sends the stored session id when submitting a guess", async () => {
    const { calls, fetchImpl } = makeFetch([jsonResponse({ hit: false, nextAction: "continue" })]);
    const client = new LopakaApiClient({
      baseUrl: "https://api.example.com",
      sessionStore: new MemorySessionStore("session-guess"),
      fetchImpl,
    });

    const result = await client.guess({ levelId: "level-1", x: 100, y: 50, elapsedMs: 1200 });

    expect(result).toEqual({ hit: false, nextAction: "continue" });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://api.example.com/api/levels/level-1/guess");
    expect(calls[0]?.init?.method).toBe("POST");
    expect(headerValue(calls[0]?.init, "x-lopaka-session-id")).toBe("session-guess");
    expect(JSON.parse(calls[0]?.init?.body as string)).toEqual({ x: 100, y: 50, elapsedMs: 1200 });
  });

  it("sends the stored session id when skipping and loads the next level after a 204 response", async () => {
    const { calls, fetchImpl } = makeFetch([
      new Response(null, { status: 204 }),
      jsonResponse(levelSummary("level-next")),
    ]);
    const client = new LopakaApiClient({
      baseUrl: "https://api.example.com",
      sessionStore: new MemorySessionStore("session-skip"),
      fetchImpl,
    });

    const nextLevel = await client.skip({ levelId: "level-1", elapsedMs: 5000 });

    expect(nextLevel).toEqual(levelSummary("level-next"));
    expect(calls).toHaveLength(2);
    expect(calls[0]?.url).toBe("https://api.example.com/api/levels/level-1/skip");
    expect(calls[0]?.init?.method).toBe("POST");
    expect(headerValue(calls[0]?.init, "x-lopaka-session-id")).toBe("session-skip");
    expect(JSON.parse(calls[0]?.init?.body as string)).toEqual({ elapsedMs: 5000 });
    expect(calls[1]?.url).toBe("https://api.example.com/api/levels/next");
    expect(headerValue(calls[1]?.init, "x-lopaka-session-id")).toBe("session-skip");
  });

  it("accepts a level summary directly from skip when the API returns one", async () => {
    const { calls, fetchImpl } = makeFetch([jsonResponse(levelSummary("level-returned"))]);
    const client = new LopakaApiClient({
      baseUrl: "https://api.example.com",
      sessionStore: new MemorySessionStore("session-skip-json"),
      fetchImpl,
    });

    const nextLevel = await client.skip({ levelId: "level-1", elapsedMs: 5000 });

    expect(nextLevel).toEqual(levelSummary("level-returned"));
    expect(calls).toHaveLength(1);
    expect(headerValue(calls[0]?.init, "x-lopaka-session-id")).toBe("session-skip-json");
  });
});
