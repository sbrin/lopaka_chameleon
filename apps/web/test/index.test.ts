import { describe, expect, it } from "vitest";

import * as entrypoint from "../src/index";

describe("@lopaka/web", () => {
  it("exposes a module entrypoint", () => {
    expect(entrypoint).toBeDefined();
  });
});
