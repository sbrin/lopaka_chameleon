import { describe, expect, it } from "vitest";

import * as entrypoint from "../src/index";

describe("@lopaka/rendering-web", () => {
  it("exposes a module entrypoint", () => {
    expect(entrypoint).toBeDefined();
  });
});
