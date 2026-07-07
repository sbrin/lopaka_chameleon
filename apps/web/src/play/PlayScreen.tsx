import { PLAY_SECONDS } from "@lopaka/game-core";

import { TimerBar } from "../components/TimerBar";

export function PlayScreen() {
  const durationMs = PLAY_SECONDS * 1000;

  return (
    <div className="screen-layout">
      <div className="screen-toolbar">
        <TimerBar remainingMs={durationMs} durationMs={durationMs} />
      </div>

      <div className="stage-frame" aria-label="Play canvas">
        <div className="stage-frame__empty">
          <span>Play</span>
        </div>
      </div>
    </div>
  );
}
