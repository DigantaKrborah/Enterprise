-- Drop everything in reverse-dependency order for a clean slate
-- Safe to run multiple times

-- Triggers
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists conversations_updated_at on conversations;

-- Functions
drop function if exists handle_new_auth_user() cascade;
drop function if exists update_updated_at() cascade;
drop function if exists current_user_role() cascade;
drop function if exists current_user_dept() cascade;

-- Tables (in FK-safe order)
drop table if exists audit_log          cascade;
drop table if exists sentiment_analyses cascade;
drop table if exists bug_reports        cascade;
drop table if exists logs               cascade;
drop table if exists messages           cascade;
drop table if exists conversations      cascade;
drop table if exists document_chunks    cascade;
drop table if exists documents          cascade;
drop table if exists users              cascade;
drop table if exists departments        cascade;

-- Enums
drop type if exists user_role       cascade;
drop type if exists document_status cascade;
drop type if exists file_type       cascade;
drop type if exists message_role    cascade;
drop type if exists feedback_value  cascade;
drop type if exists log_level       cascade;
drop type if exists bug_severity    cascade;
drop type if exists bug_status      cascade;
drop type if exists sentiment_value cascade;
