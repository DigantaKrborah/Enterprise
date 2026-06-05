-- Enable pgvector for semantic search
create extension if not exists vector;

-- Enable pg_cron for scheduled jobs (log monitor agent)
-- create extension if not exists pg_cron; -- uncomment if available on your Supabase plan
