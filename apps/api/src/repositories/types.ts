import type { AnonymousSession, CreateLevelInput, LevelId, LevelSummary, SessionId } from "@lopaka/game-core";

export type StoredLevel = {
  id: LevelId;
  creatorSessionId: SessionId;
  backgroundId: string;
  poseId: string;
  rotation: number;
  sceneObjectKey: string;
  maskObjectKey: string;
  imageWidth: number;
  imageHeight: number;
  status: "published" | "hidden" | "deleted";
};

export type NewLevelRecord = CreateLevelInput & {
  creatorSessionId: SessionId;
  sceneObjectKey: string;
  maskObjectKey: string;
};

export interface SessionRepository {
  createOrRefresh(sessionId?: string): Promise<AnonymousSession>;
  exists(sessionId: string): Promise<boolean>;
}

export interface LevelRepository {
  createLevel(input: NewLevelRecord): Promise<StoredLevel>;
  getLevel(id: LevelId): Promise<StoredLevel | null>;
  getNextLevel(sessionId: SessionId): Promise<LevelSummary | null>;
  recordGuess(input: {
    levelId: LevelId;
    sessionId: SessionId;
    x: number;
    y: number;
    elapsedMs: number;
    hit: boolean;
  }): Promise<void>;
  recordSkip(input: { levelId: LevelId; sessionId: SessionId; elapsedMs: number }): Promise<void>;
}
