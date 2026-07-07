import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TimerBar } from "../src/components/TimerBar";

describe("TimerBar", () => {
  it("formats remaining time as zero-padded mm:ss", () => {
    const labels = [30_000, 300_000, 723_000].map((remainingMs) =>
      renderToStaticMarkup(<TimerBar remainingMs={remainingMs} durationMs={900_000} />),
    );

    expect(labels[0]).toContain(">00:30<");
    expect(labels[1]).toContain(">05:00<");
    expect(labels[2]).toContain(">12:03<");
  });
});
