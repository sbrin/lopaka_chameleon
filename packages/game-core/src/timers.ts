export const CREATE_SECONDS = 30 as const;
export const PLAY_SECONDS = 300 as const;
export const HIT_TOLERANCE_PX = 3 as const;

export type CountdownState = {
  durationMs: number;
  startedAtMs: number;
  remainingMs: number;
  expired: boolean;
};

export function createCountdown(durationMs: number, nowMs: number): CountdownState {
  return {
    durationMs,
    startedAtMs: nowMs,
    remainingMs: durationMs,
    expired: false,
  };
}

export function updateCountdown(
  state: CountdownState,
  nowMs: number,
): CountdownState {
  const elapsed = Math.max(0, nowMs - state.startedAtMs);
  const remainingMs = Math.max(0, state.durationMs - elapsed);

  return { ...state, remainingMs, expired: remainingMs === 0 };
}
