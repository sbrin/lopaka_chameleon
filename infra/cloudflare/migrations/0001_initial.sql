create table if not exists sessions (
  id text primary key,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_seen_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  user_id text
);

create table if not exists levels (
  id text primary key,
  creator_session_id text not null references sessions(id),
  creator_user_id text,
  background_id text not null,
  pose_id text not null,
  rotation real not null,
  scene_object_key text not null,
  mask_object_key text not null,
  image_width integer not null,
  image_height integer not null,
  status text not null check (status in ('published', 'hidden', 'deleted')),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  published_at text
);

create index if not exists idx_levels_public_queue on levels(status, published_at, created_at);
create index if not exists idx_levels_creator_session on levels(creator_session_id);

create table if not exists guesses (
  id text primary key,
  level_id text not null references levels(id),
  session_id text not null references sessions(id),
  x integer not null,
  y integer not null,
  elapsed_ms integer not null,
  hit integer not null check (hit in (0, 1)),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists idx_guesses_session_level on guesses(session_id, level_id);

create table if not exists skips (
  id text primary key,
  level_id text not null references levels(id),
  session_id text not null references sessions(id),
  elapsed_ms integer not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
