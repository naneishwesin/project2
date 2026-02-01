-- Minimal schema for the prototype (RDS Postgres in AWS).

create table if not exists users (
  id uuid primary key,
  username text unique not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists servers (
  id uuid primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists channels (
  id uuid primary key,
  server_id uuid not null references servers(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key,
  channel_id uuid not null references channels(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  username text not null,
  content text not null,
  created_at timestamptz not null default now()
);

-- Optional: metadata only (WebRTC media is P2P).
create table if not exists calls (
  id uuid primary key,
  channel_id uuid not null references channels(id) on delete cascade,
  created_by uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('voice','video')),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

