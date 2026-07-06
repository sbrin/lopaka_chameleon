import type { LevelId, LevelSummary } from "@lopaka/game-core";

import type { LevelRepository, NewLevelRecord, StoredLevel } from "./types";

type LevelRow = {
  id: string;
  creator_session_id: string;
  background_id: string;
  pose_id: string;
  rotation: number;
  scene_object_key: string;
  mask_object_key: string;
  image_width: number;
  image_height: number;
  status: StoredLevel["status"];
};

type LevelSummaryRow = {
  id: string;
  scene_object_key: string;
  image_width: number;
  image_height: number;
};

const mapLevel = (row: LevelRow): StoredLevel => ({
  id: row.id,
  creatorSessionId: row.creator_session_id,
  backgroundId: row.background_id,
  poseId: row.pose_id,
  rotation: row.rotation,
  sceneObjectKey: row.scene_object_key,
  maskObjectKey: row.mask_object_key,
  imageWidth: row.image_width,
  imageHeight: row.image_height,
  status: row.status,
});

const mapLevelSummary = (row: LevelSummaryRow): LevelSummary => ({
  levelId: row.id,
  sceneUrl: row.scene_object_key,
  imageWidth: row.image_width,
  imageHeight: row.image_height,
  playTimeLimitSeconds: 300,
});

export class D1LevelRepository implements LevelRepository {
  constructor(private readonly db: D1Database) {}

  async createLevel(input: NewLevelRecord): Promise<StoredLevel> {
    const id = crypto.randomUUID();

    await this.db
      .prepare(
        `
        insert into levels (
          id,
          creator_session_id,
          background_id,
          pose_id,
          rotation,
          scene_object_key,
          mask_object_key,
          image_width,
          image_height,
          status,
          published_at
        )
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        `,
      )
      .bind(
        id,
        input.creatorSessionId,
        input.backgroundId,
        input.poseId,
        input.rotation,
        input.sceneObjectKey,
        input.maskObjectKey,
        input.imageWidth,
        input.imageHeight,
      )
      .run();

    const level = await this.getLevel(id);
    if (!level) {
      throw new Error("Failed to create level.");
    }

    return level;
  }

  async getLevel(id: LevelId): Promise<StoredLevel | null> {
    const row = await this.db
      .prepare(
        `
        select
          id,
          creator_session_id,
          background_id,
          pose_id,
          rotation,
          scene_object_key,
          mask_object_key,
          image_width,
          image_height,
          status
        from levels
        where id = ?
        `,
      )
      .bind(id)
      .first<LevelRow>();

    return row ? mapLevel(row) : null;
  }

  async getNextLevel(sessionId: string): Promise<LevelSummary | null> {
    const row = await this.db
      .prepare(
        `
        select id, scene_object_key, image_width, image_height
        from levels
        where status = 'published'
        order by
          case when creator_session_id <> ? then 0 else 1 end,
          published_at asc,
          created_at asc
        limit 1
        `,
      )
      .bind(sessionId)
      .first<LevelSummaryRow>();

    return row ? mapLevelSummary(row) : null;
  }

  async recordGuess(input: {
    levelId: LevelId;
    sessionId: string;
    x: number;
    y: number;
    elapsedMs: number;
    hit: boolean;
  }): Promise<void> {
    await this.db
      .prepare(
        `
        insert into guesses (id, level_id, session_id, x, y, elapsed_ms, hit)
        values (?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .bind(
        crypto.randomUUID(),
        input.levelId,
        input.sessionId,
        input.x,
        input.y,
        input.elapsedMs,
        input.hit ? 1 : 0,
      )
      .run();
  }

  async recordSkip(input: { levelId: LevelId; sessionId: string; elapsedMs: number }): Promise<void> {
    await this.db
      .prepare(
        `
        insert into skips (id, level_id, session_id, elapsed_ms)
        values (?, ?, ?, ?)
        `,
      )
      .bind(crypto.randomUUID(), input.levelId, input.sessionId, input.elapsedMs)
      .run();
  }
}
