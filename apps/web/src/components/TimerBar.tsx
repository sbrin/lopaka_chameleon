export type TimerBarProps = {
  remainingMs: number;
  durationMs: number;
};

export function TimerBar({ remainingMs, durationMs }: TimerBarProps) {
  const safeDurationMs = Math.max(1, durationMs);
  const safeRemainingMs = Math.min(Math.max(0, remainingMs), safeDurationMs);
  const progress = safeRemainingMs / safeDurationMs;

  return (
    <div className="timer-bar" aria-label={`Time remaining ${formatTime(safeRemainingMs)}`}>
      <div className="timer-bar__track" aria-hidden="true">
        <div className="timer-bar__fill" style={{ transform: `scaleX(${progress})` }} />
      </div>
      <span className="timer-bar__label">{formatTime(safeRemainingMs)}</span>
    </div>
  );
}

function formatTime(valueMs: number): string {
  const totalSeconds = Math.ceil(valueMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}
