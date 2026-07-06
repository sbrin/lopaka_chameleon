import { backgrounds, poses } from "@lopaka/assets";
import { Hono } from "hono";

import type { Env } from "../bindings";

export function assetsRoutes(kind: "backgrounds" | "poses") {
  const app = new Hono<{ Bindings: Env }>();

  app.get("/", (c) => c.json(kind === "backgrounds" ? backgrounds : poses));

  return app;
}
