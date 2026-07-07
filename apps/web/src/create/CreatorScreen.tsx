import { CREATE_SECONDS } from "@lopaka/game-core";

import { TimerBar } from "../components/TimerBar";

export function CreatorScreen() {
  const durationMs = CREATE_SECONDS * 1000;

  return (
    <div className="screen-layout">
      <div className="screen-toolbar">
        <TimerBar remainingMs={durationMs} durationMs={durationMs} />
      </div>

      <div className="stage-frame" aria-label="Create canvas">
        <div className="stage-frame__empty">
          <span>Create</span>
        </div>
      </div>
    </div>
  );
}
