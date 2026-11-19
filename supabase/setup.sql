-- Acharya Lab: self-learning skill store (R&D only). Run once in Supabase → SQL Editor.
-- Tables are prefixed lab_ and only the server (secret key) can read or write them.

create table if not exists lab_skill_versions (
  id          bigint generated always as identity primary key,
  name        text not null check (name ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$'),
  version     int  not null,
  description text not null,
  content     text not null,
  -- active: in use · candidate: being tested · superseded: replaced by a newer version
  -- rejected: failed the test check · proposed: waits for a human · retired: switched off
  status      text not null check (status in ('active','candidate','superseded','rejected','proposed','retired')),
  reason      text,
  created_by  text not null default 'human',   -- seed | gardener | human
  run_id      bigint,
  created_at  timestamptz not null default now(),
  unique (name, version)
);
create unique index if not exists lab_skill_one_active on lab_skill_versions (name) where status = 'active';

create table if not exists lab_skill_events (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  session_id  text,
  kind        text not null check (kind in ('tool_error','tool_ok','lesson_saved','skill_loaded')),
  tool        text,
  detail      text,
  input       jsonb
);
create index if not exists lab_skill_events_time on lab_skill_events (created_at);

create table if not exists lab_gardener_runs (
  id          bigint generated always as identity primary key,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  status      text not null default 'running' check (status in ('running','applied','no_change','rejected','failed')),
  summary     text,
  report      jsonb
);

alter table lab_skill_versions enable row level security;
alter table lab_skill_events   enable row level security;
alter table lab_gardener_runs  enable row level security;
-- No policies on purpose: only the secret (service) key used by the agent can access these tables.

-- Starting skills (version 1). The agent also seeds these itself if the table is empty.
insert into lab_skill_versions (name, version, description, content, status, created_by, reason) values
('task-management', 1, 'Use when creating, listing, updating or completing karigar tasks.',
$$# Task management

1. If the assignee is unclear, call `list_karigars` and match the name.
2. Create one task per job with `create_task`, using the job text as the title.
3. To see work, call `list_tasks` (optionally for one assignee).
4. To complete a task, call `complete_task` with a proof note. A supervisor must approve it.
5. If a tool returns an error, read the message, fix the input and try again once.$$,
 'active', 'seed', 'Initial skill'),
('teaching-style', 1, 'Use when explaining to a karigar how to do a job or learn a skill.',
$$# Teaching style

- Start from what the karigar already knows (check `karigar` memory).
- Give at most 3 numbered steps, each one sentence, with one safety tip if relevant.
- Use simple words in their language. Avoid English jargon for Hindi speakers.
- End with one check question, like "Pehla step kya hoga?"$$,
 'active', 'seed', 'Initial skill')
on conflict (name, version) do nothing;
