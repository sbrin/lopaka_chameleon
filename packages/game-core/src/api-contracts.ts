export type SessionId = string;
export type LevelId = string;

export type BackgroundAsset = {
  id: string;
  name: string;
  src: string;
  width: number;
  height: number;
};

export type PoseAsset = {
  id: string;
  name: string;
  modelSrc: string;
  defaultRotation: number;
  fixedDisplayHeightRatio: number;
};

export type AnonymousSession = {
  id: SessionId;
  createdAt: string;
  lastSeenAt: string;
  userId: string | null;
};

export type LevelSummary = {
  levelId: LevelId;
  sceneUrl: string;
  imageWidth: number;
  imageHeight: number;
  playTimeLimitSeconds: 300;
};

export type CreateLevelInput = {
  backgroundId: string;
  poseId: string;
  rotation: number;
  imageWidth: number;
  imageHeight: number;
};

export type GuessInput = {
  levelId: LevelId;
  x: number;
  y: number;
  elapsedMs: number;
};

export type GuessResult = {
  hit: boolean;
  nextAction: "continue" | "load-next";
};
