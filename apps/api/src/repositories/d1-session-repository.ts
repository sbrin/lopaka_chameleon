import type { AnonymousSession } from "@lopaka/game-core";

import type { SessionRepository } from "./types";

type SessionRow = {
  id: string;
  created_at: string;
  last_seen_at: string;
  user_id: string | null;
};

const mapSession = (row: SessionRow): AnonymousSession => ({
  id: row.id,
  createdAt: row.created_at,
  lastSeenAt: row.last_seen_at,
  userId: row.user_id,
});

export class D1SessionRepository implements SessionRepository {
  constructor(private readonly db: D1Database) {}

  async createOrRefresh(sessionId: string = crypto.randomUUID()): Promise<AnonymousSession> {
    const row = await this.db
      .prepare(
        `
        insert into sessions (id)
        values (?)
        on conflict(id) do update set
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
          last_seen_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        returning id, created_at, last_seen_at, user_id
        `,
      )
      .bind(sessionId)
      .first<SessionRow>();

    if (!row) {
      throw new Error("Failed to create or refresh session.");
    }

    return mapSession(row);
  }

  async exists(sessionId: string): Promise<boolean> {
    const row = await this.db.prepare("select id from sessions where id = ?").bind(sessionId).first<{ id: string }>();
    return row !== null;
  }
}
