import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { D1LevelRepository } from "../src/repositories/d1-level-repository";
import { D1SessionRepository } from "../src/repositories/d1-session-repository";
import type { NewLevelRecord } from "../src/repositories/types";

type SqliteDatabase = {
  exec(sql: string): void;
  query(sql: string): SqliteStatement;
  close(): void;
};

type SqliteStatement = {
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown;
  run(...params: unknown[]): unknown;
};

type SqliteDatabaseConstructor = new (path: string) => SqliteDatabase;

type D1Result = {
  success: boolean;
  meta: Record<string, never>;
};

class TestD1PreparedStatement {
  #params: unknown[] = [];

  constructor(private readonly statement: SqliteStatement) {}

  bind(...params: unknown[]): TestD1PreparedStatement {
    this.#params = params;
    return this;
  }

  first<T>(): T | null {
    return (this.statement.get(...this.#params) ?? null) as T | null;
  }

  all<T>(): { results: T[]; success: true; meta: Record<string, never> } {
    return {
      results: this.statement.all(...this.#params) as T[],
      success: true,
      meta: {},
    };
  }

  run(): D1Result {
    this.statement.run(...this.#params);
    return { success: true, meta: {} };
  }
}

class TestD1Database {
  constructor(private readonly db: SqliteDatabase) {}

  prepare(sql: string): TestD1PreparedStatement {
    return new TestD1PreparedStatement(this.db.query(sql));
  }

  close(): void {
    this.db.close();
  }
}

type RuntimeVersions = {
  bun?: string;
};

declare const process: {
  versions: RuntimeVersions;
};

const loadSqliteDatabase = async (): Promise<SqliteDatabaseConstructor> => {
  if (process.versions.bun) {
    const load = new Function("return import('bun:sqlite')");
    const sqlite = (await load()) as { Database: SqliteDatabaseConstructor };
    return sqlite.Database;
  }

  // @ts-expect-error This package intentionally does not include Node ambient types.
  const sqlite = (await import("node:sqlite")) as {
    DatabaseSync: new (path: string) => {
      exec(sql: string): void;
      prepare(sql: string): SqliteStatement;
      close(): void;
    };
  };

  return class NodeSqliteDatabase implements SqliteDatabase {
    readonly #db: InstanceType<typeof sqlite.DatabaseSync>;

    constructor(path: string) {
      this.#db = new sqlite.DatabaseSync(path);
    }

    exec(sql: string): void {
      this.#db.exec(sql);
    }

    query(sql: string): SqliteStatement {
      return this.#db.prepare(sql);
    }

    close(): void {
      this.#db.close();
    }
  };
};

const readMigrationSql = async (): Promise<string> => {
  // @ts-expect-error This package intentionally does not include Node ambient types.
  const fs = (await import("node:fs")) as {
    readFileSync(path: URL | string, encoding: "utf8"): string;
  };

  return fs.readFileSync(new URL("../../../infra/cloudflare/migrations/0001_initial.sql", import.meta.url), "utf8");
};

describe("D1 repositories", () => {
  let db: TestD1Database;
  let sessions: D1SessionRepository;
  let levels: D1LevelRepository;

  beforeEach(async () => {
    const Database = await loadSqliteDatabase();
    const sqlite = new Database(":memory:");
    const migration = await readMigrationSql();
    sqlite.exec(migration);
    db = new TestD1Database(sqlite);
    sessions = new D1SessionRepository(db as unknown as D1Database);
    levels = new D1LevelRepository(db as unknown as D1Database);
  });

  afterEach(() => {
    db.close();
  });

  it("creates and refreshes anonymous sessions", async () => {
    const created = await sessions.createOrRefresh("session-a");

    expect(created).toMatchObject({
      id: "session-a",
      userId: null,
    });
    expect(created.createdAt).toEqual(expect.any(String));
    expect(created.lastSeenAt).toEqual(expect.any(String));
    expect(await sessions.exists("session-a")).toBe(true);

    const refreshed = await sessions.createOrRefresh("session-a");

    expect(refreshed.id).toBe("session-a");
    expect(await sessions.exists("missing-session")).toBe(false);
  });

  it("creates levels, selects the next playable level, and records attempts", async () => {
    const ownSession = await sessions.createOrRefresh("session-owner");
    const otherSession = await sessions.createOrRefresh("session-other");
    const ownLevelInput: NewLevelRecord = {
      creatorSessionId: ownSession.id,
      backgroundId: "studio-desk",
      poseId: "standing",
      rotation: 12,
      imageWidth: 1024,
      imageHeight: 768,
      sceneObjectKey: "scenes/own.png",
      maskObjectKey: "masks/own.png",
    };
    const otherLevelInput: NewLevelRecord = {
      creatorSessionId: otherSession.id,
      backgroundId: "garden-path",
      poseId: "crouching",
      rotation: -8,
      imageWidth: 800,
      imageHeight: 600,
      sceneObjectKey: "scenes/other.png",
      maskObjectKey: "masks/other.png",
    };

    const ownLevel = await levels.createLevel(ownLevelInput);
    const otherLevel = await levels.createLevel(otherLevelInput);

    expect(ownLevel).toMatchObject({
      creatorSessionId: ownSession.id,
      backgroundId: "studio-desk",
      poseId: "standing",
      sceneObjectKey: "scenes/own.png",
      maskObjectKey: "masks/own.png",
      status: "published",
    });
    expect(await levels.getLevel(ownLevel.id)).toEqual(ownLevel);

    const nextForOwner = await levels.getNextLevel(ownSession.id);
    expect(nextForOwner).toEqual({
      levelId: otherLevel.id,
      sceneUrl: "scenes/other.png",
      imageWidth: 800,
      imageHeight: 600,
      playTimeLimitSeconds: 300,
    });

    db.prepare("update levels set status = 'hidden' where id = ?").bind(otherLevel.id).run();

    const fallbackForOwner = await levels.getNextLevel(ownSession.id);
    expect(fallbackForOwner?.levelId).toBe(ownLevel.id);

    await levels.recordGuess({
      levelId: otherLevel.id,
      sessionId: ownSession.id,
      x: 21,
      y: 34,
      elapsedMs: 1500,
      hit: true,
    });
    await levels.recordSkip({
      levelId: ownLevel.id,
      sessionId: otherSession.id,
      elapsedMs: 2500,
    });

    const guess = db
      .prepare("select level_id, session_id, x, y, elapsed_ms, hit from guesses")
      .first<{ level_id: string; session_id: string; x: number; y: number; elapsed_ms: number; hit: number }>();
    expect(guess).toEqual({
      level_id: otherLevel.id,
      session_id: ownSession.id,
      x: 21,
      y: 34,
      elapsed_ms: 1500,
      hit: 1,
    });

    const skip = db
      .prepare("select level_id, session_id, elapsed_ms from skips")
      .first<{ level_id: string; session_id: string; elapsed_ms: number }>();
    expect(skip).toEqual({
      level_id: ownLevel.id,
      session_id: otherSession.id,
      elapsed_ms: 2500,
    });
  });
});
