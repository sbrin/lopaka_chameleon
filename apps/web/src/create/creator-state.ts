import { CREATE_SECONDS } from "@lopaka/game-core";

const DEFAULT_BRUSH_SIZE = 18;

export const creatorBrushSizeRange = {
  min: 4,
  max: 48,
  step: 1,
} as const;

export type CreatorSaveStatus = "idle" | "saving" | "saved" | "failed";

export type CreatorState = {
  selectedBackgroundId: string | null;
  selectedPoseId: string | null;
  rotation: number;
  color: string;
  brushSize: number;
  brushSizeRange: typeof creatorBrushSizeRange;
  startedAtMs: number;
  durationMs: number;
  remainingMs: number;
  canPaint: boolean;
  shouldAutoSave: boolean;
  saveStatus: CreatorSaveStatus;
  levelId: string | null;
  errorMessage: string | null;
};

export type CreateInitialCreatorStateInput = {
  nowMs: number;
  durationMs?: number;
};

export type CreatorAction =
  | { type: "select-background"; backgroundId: string }
  | { type: "select-pose"; poseId: string }
  | { type: "set-rotation"; rotation: number }
  | { type: "set-color"; color: string }
  | { type: "set-brush-size"; brushSize: number }
  | { type: "tick"; nowMs: number }
  | { type: "saving" }
  | { type: "saved"; levelId: string }
  | { type: "save-failed"; message: string };

export function createInitialCreatorState(input: CreateInitialCreatorStateInput): CreatorState {
  const durationMs = input.durationMs ?? CREATE_SECONDS * 1_000;

  return {
    selectedBackgroundId: null,
    selectedPoseId: null,
    rotation: 0,
    color: "#4f8f5f",
    brushSize: DEFAULT_BRUSH_SIZE,
    brushSizeRange: creatorBrushSizeRange,
    startedAtMs: input.nowMs,
    durationMs,
    remainingMs: durationMs,
    canPaint: true,
    shouldAutoSave: false,
    saveStatus: "idle",
    levelId: null,
    errorMessage: null,
  };
}

export function creatorReducer(state: CreatorState, action: CreatorAction): CreatorState {
  switch (action.type) {
    case "select-background":
      return {
        ...state,
        selectedBackgroundId: action.backgroundId,
      };

    case "select-pose":
      return {
        ...state,
        selectedPoseId: action.poseId,
      };

    case "set-rotation":
      return {
        ...state,
        rotation: normalizeRotation(action.rotation),
      };

    case "set-color":
      return {
        ...state,
        color: action.color,
      };

    case "set-brush-size":
      return {
        ...state,
        brushSize: clampBrushSize(action.brushSize),
      };

    case "tick": {
      const elapsedMs = Math.max(0, action.nowMs - state.startedAtMs);
      const remainingMs = Math.max(0, state.durationMs - elapsedMs);
      const isExpired = remainingMs === 0;
      const saveComplete = state.saveStatus === "saving" || state.saveStatus === "saved";

      return {
        ...state,
        remainingMs,
        canPaint: !isExpired && !saveComplete,
        shouldAutoSave: isExpired && !saveComplete,
      };
    }

    case "saving":
      return {
        ...state,
        canPaint: false,
        shouldAutoSave: false,
        saveStatus: "saving",
        errorMessage: null,
      };

    case "saved":
      return {
        ...state,
        canPaint: false,
        shouldAutoSave: false,
        saveStatus: "saved",
        levelId: action.levelId,
        errorMessage: null,
      };

    case "save-failed":
      return {
        ...state,
        canPaint: state.remainingMs > 0,
        shouldAutoSave: false,
        saveStatus: "failed",
        errorMessage: action.message,
      };

    default:
      return state;
  }
}

function normalizeRotation(rotation: number): number {
  return ((Math.round(rotation) % 360) + 360) % 360;
}

function clampBrushSize(brushSize: number): number {
  return Math.min(creatorBrushSizeRange.max, Math.max(creatorBrushSizeRange.min, Math.round(brushSize)));
}
