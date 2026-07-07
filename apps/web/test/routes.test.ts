import { describe, expect, it } from "vitest";

import { routeFromPathname } from "../src/app/routes";

describe("routeFromPathname", () => {
  it("opens create mode from the create URL", () => {
    expect(routeFromPathname("/create")).toBe("create");
  });

  it("defaults to play mode", () => {
    expect(routeFromPathname("/")).toBe("play");
    expect(routeFromPathname("/play")).toBe("play");
  });
});
