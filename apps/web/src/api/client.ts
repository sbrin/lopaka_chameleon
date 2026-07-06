import type { BackgroundAsset, PoseAsset } from "@lopaka/assets";
import type {
  AnonymousSession,
  CreateLevelInput,
  GuessInput,
  GuessResult,
  LevelSummary,
  SessionStore,
} from "@lopaka/game-core";

const SESSION_HEADER = "x-lopaka-session-id";

export type LopakaApiClientOptions = {
  baseUrl: string;
  sessionStore: SessionStore;
  fetchImpl?: typeof fetch;
};

export class LopakaApiClient {
  private readonly baseUrl: string;
  private readonly sessionStore: SessionStore;
  private readonly fetchImpl: typeof fetch;

  constructor(options: LopakaApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.sessionStore = options.sessionStore;
    this.fetchImpl = options.fetchImpl ?? (globalThis.fetch.bind(globalThis) as typeof fetch);
  }

  async ensureSession(): Promise<AnonymousSession> {
    const storedSessionId = await this.sessionStore.getSessionId();
    const headers = new Headers();
    if (storedSessionId) {
      headers.set(SESSION_HEADER, storedSessionId);
    }

    const session = await this.requestJson<AnonymousSession>("/api/session", {
      method: "POST",
      headers,
    });

    await this.sessionStore.setSessionId(session.id);

    return session;
  }

  async getBackgrounds(): Promise<BackgroundAsset[]> {
    return this.requestJson<BackgroundAsset[]>("/api/backgrounds");
  }

  async getPoses(): Promise<PoseAsset[]> {
    return this.requestJson<PoseAsset[]>("/api/poses");
  }

  async createLevel(input: { metadata: CreateLevelInput; scene: Blob; mask: Blob }): Promise<{ levelId: string }> {
    const form = new FormData();
    form.set("metadata", JSON.stringify(input.metadata));
    form.set("scene", input.scene);
    form.set("mask", input.mask);

    return this.requestJson<{ levelId: string }>("/api/levels", {
      method: "POST",
      headers: await this.authHeaders(),
      body: form,
    });
  }

  async getNextLevel(): Promise<LevelSummary | null> {
    const response = await this.fetchImpl(this.url("/api/levels/next"), {
      method: "GET",
      headers: await this.authHeaders(),
    });

    if (response.status === 404) {
      return null;
    }

    return this.readJsonResponse<LevelSummary>(response);
  }

  async guess(input: GuessInput): Promise<GuessResult> {
    return this.requestJson<GuessResult>(`/api/levels/${encodeURIComponent(input.levelId)}/guess`, {
      method: "POST",
      headers: await this.jsonAuthHeaders(),
      body: JSON.stringify({
        x: input.x,
        y: input.y,
        elapsedMs: input.elapsedMs,
      }),
    });
  }

  async skip(input: { levelId: string; elapsedMs: number }): Promise<LevelSummary | null> {
    const response = await this.fetchImpl(this.url(`/api/levels/${encodeURIComponent(input.levelId)}/skip`), {
      method: "POST",
      headers: await this.jsonAuthHeaders(),
      body: JSON.stringify({ elapsedMs: input.elapsedMs }),
    });

    if (response.status === 204) {
      return this.getNextLevel();
    }

    return this.readJsonResponse<LevelSummary>(response);
  }

  private async authHeaders(): Promise<Headers> {
    const sessionId = await this.getSessionIdForAuth();
    const headers = new Headers();
    headers.set(SESSION_HEADER, sessionId);

    return headers;
  }

  private async jsonAuthHeaders(): Promise<Headers> {
    const headers = await this.authHeaders();
    headers.set("content-type", "application/json");

    return headers;
  }

  private async getSessionIdForAuth(): Promise<string> {
    const storedSessionId = await this.sessionStore.getSessionId();
    if (storedSessionId) {
      return storedSessionId;
    }

    const session = await this.ensureSession();

    return session.id;
  }

  private async requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.fetchImpl(this.url(path), init);

    return this.readJsonResponse<T>(response);
  }

  private async readJsonResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      throw new Error(`Lopaka API request failed with status ${response.status}.`);
    }

    return response.json() as Promise<T>;
  }

  private url(path: string): string {
    return `${this.baseUrl}${path}`;
  }
}
