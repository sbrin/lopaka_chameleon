export type { AnonymousSession } from "./api-contracts";

export type SessionStore = {
  getSessionId(): Promise<string | null>;
  setSessionId(sessionId: string): Promise<void>;
  clearSessionId(): Promise<void>;
};
