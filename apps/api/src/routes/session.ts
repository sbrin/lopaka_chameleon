import { Hono } from "hono";

import type { Env } from "../bindings";
import type { SessionRepository } from "../repositories/types";
import { D1SessionRepository } from "../repositories/d1-session-repository";

export type SessionRouteDependencies = {
  sessions?: SessionRepository;
};

const SESSION_HEADER = "x-lopaka-session-id";

export function sessionRoutes(dependencies: SessionRouteDependencies = {}) {
  const app = new Hono<{ Bindings: Env }>();

  app.post("/", async (c) => {
    const sessions = dependencies.sessions ?? new D1SessionRepository(c.env.DB);
    const session = await sessions.createOrRefresh(c.req.header(SESSION_HEADER));

    return c.json(session);
  });

  return app;
}

export { SESSION_HEADER };
