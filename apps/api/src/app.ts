import { Hono } from "hono";

import type { Env } from "./bindings";
import { assetsRoutes } from "./routes/assets";
import { levelsRoutes, type LevelRouteDependencies } from "./routes/levels";
import { sessionRoutes, type SessionRouteDependencies } from "./routes/session";

export type AppDependencies = LevelRouteDependencies & SessionRouteDependencies;

export function createApp(dependencies: AppDependencies = {}) {
  const app = new Hono<{ Bindings: Env }>();

  app.route("/api/session", sessionRoutes(dependencies));
  app.route("/api/backgrounds", assetsRoutes("backgrounds"));
  app.route("/api/poses", assetsRoutes("poses"));
  app.route("/api/levels", levelsRoutes(dependencies));
  app.get("/assets/scenes/:file", async (c) => {
    const objectKey = `scenes/${c.req.param("file")}`;
    const object = await c.env.LEVEL_BUCKET.get(objectKey);

    if (!object) {
      return c.body(null, 404);
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);

    return new Response(object.body, { headers });
  });

  return app;
}
