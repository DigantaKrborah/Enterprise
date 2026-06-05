-- ============================================================
-- Core tables for NRL RAGBot
-- Run in order after 001_extensions.sql
-- ============================================================

-- Departments
create table if not exists departments (
  id          uuid primary key default gen_random_uuid(),
  name        text unique not null,
  description text,
  created_at  timestamptz not null default now()
);

-- Seed default departments
insert into departments (name, description) values
  ('Operations', 'Refinery operations, SOPs and safety'),
  ('HR',         'Human resources, policies and benefits')
on conflict (name) do nothing;

-- Users (extends auth.users)
create type user_role as enum ('super_admin', 'dept_admin', 'manager', 'employee', 'read_only');

create table if not exists users (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text unique not null,
  full_name     text,
  role          user_role not null default 'employee',
  department_id uuid references departments(id) on delete set null,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- Documents
create type document_status as enum ('queued', 'processing', 'indexed', 'failed');
create type file_type as enum ('pdf', 'scanned_pdf', 'docx', 'xlsx', 'image', 'drawing');

create table if not exists documents (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  original_name text not null,
  department_id uuid not null references departments(id) on delete restrict,
  uploaded_by   uuid not null references users(id) on delete restrict,
  file_type     file_type not null,
  storage_path  text not null,
  version       integer not null default 1,
  parent_id     uuid references documents(id) on delete set null,
  status        document_status not null default 'queued',
  error_msg     text,
  size_bytes    bigint,
  page_count    integer,
  is_deleted    boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Document chunks (pgvector)
create table if not exists document_chunks (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references documents(id) on delete cascade,
  chunk_index  integer not null,
  content      text not null,
  embedding    vector(768),  -- nomic-embed-text produces 768-dim
  page_number  integer,
  metadata     jsonb,
  created_at   timestamptz not null default now(),
  unique (document_id, chunk_index)
);

-- Conversations
create table if not exists conversations (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references users(id) on delete cascade,
  title             text,
  department_filter uuid references departments(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Messages
create type message_role as enum ('user', 'assistant');
create type feedback_value as enum ('up', 'down');

create table if not exists messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role            message_role not null,
  content         text not null,
  citations       jsonb,     -- [{doc_id, doc_name, chunk_index, page}]
  llm_used        text,
  token_count     integer,
  feedback        feedback_value,
  created_at      timestamptz not null default now()
);

-- Logs
create type log_level as enum ('INFO', 'WARN', 'ERROR', 'DEBUG');

create table if not exists logs (
  id         uuid primary key default gen_random_uuid(),
  level      log_level not null,
  service    text not null,
  message    text not null,
  metadata   jsonb,
  user_id    uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Bug reports
create type bug_severity as enum ('critical', 'high', 'medium', 'low');
create type bug_status as enum ('open', 'in_progress', 'closed');

create table if not exists bug_reports (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  description         text not null,
  severity            bug_severity not null,
  steps               text,
  reporter_id         uuid not null references users(id) on delete restrict,
  github_issue_number integer,
  github_issue_url    text,
  status              bug_status not null default 'open',
  created_at          timestamptz not null default now()
);

-- Sentiment analyses
create type sentiment_value as enum ('positive', 'neutral', 'negative', 'urgent', 'mixed');

create table if not exists sentiment_analyses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  input_text text not null,
  sentiment  sentiment_value not null,
  summary    text,
  entities   jsonb,
  scores     jsonb,
  confidence real,
  llm_used   text,
  created_at timestamptz not null default now()
);

-- Audit log (immutable — no update/delete)
create table if not exists audit_log (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references users(id) on delete set null,
  action        text not null,
  resource_type text,
  resource_id   uuid,
  ip_address    text,
  metadata      jsonb,
  created_at    timestamptz not null default now()
);
