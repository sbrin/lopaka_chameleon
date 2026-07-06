import type { SessionStore } from "@lopaka/game-core";

export class BrowserSessionStore implements SessionStore {
  constructor(private readonly key = "lopaka_chameleon_session_id") {}

  async getSessionId(): Promise<string | null> {
    return window.localStorage.getItem(this.key);
  }

  async setSessionId(sessionId: string): Promise<void> {
    window.localStorage.setItem(this.key, sessionId);
  }

  async clearSessionId(): Promise<void> {
    window.localStorage.removeItem(this.key);
  }
}
