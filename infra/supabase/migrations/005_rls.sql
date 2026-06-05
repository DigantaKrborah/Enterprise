-- ============================================================
-- Row Level Security — defence-in-depth (primary enforcement
-- is in API route RBAC; RLS is the safety net)
-- ============================================================

alter table users              enable row level security;
alter table documents          enable row level security;
alter table document_chunks    enable row level security;
alter table conversations      enable row level security;
alter table messages           enable row level security;
alter table logs               enable row level security;
alter table bug_reports        enable row level security;
alter table sentiment_analyses enable row level security;
alter table audit_log          enable row level security;
alter table departments        enable row level security;

-- Helper: get the role of the current user
create or replace function current_user_role()
returns user_role language sql security definer stable as $$
  select role from public.users where id = auth.uid()
$$;

-- Helper: get the department_id of the current user
create or replace function current_user_dept()
returns uuid language sql security definer stable as $$
  select department_id from public.users where id = auth.uid()
$$;

-- ---- departments (all authenticated users can read) ----
create policy "dept_read_all" on departments for select
  using (auth.uid() is not null);

create policy "dept_write_superadmin" on departments for all
  using (current_user_role() = 'super_admin');

-- ---- users ----
-- Users can read their own row; dept_admin+ can read their dept; super_admin reads all
create policy "users_read_own" on users for select
  using (id = auth.uid());

create policy "users_read_dept_admin" on users for select
  using (
    current_user_role() in ('super_admin', 'dept_admin')
    and (
      current_user_role() = 'super_admin'
      or department_id = current_user_dept()
    )
  );

create policy "users_write_superadmin" on users for all
  using (current_user_role() = 'super_admin');

-- ---- documents ----
create policy "docs_read_own_dept" on documents for select
  using (
    not is_deleted
    and (
      current_user_role() = 'super_admin'
      or department_id = current_user_dept()
    )
  );

create policy "docs_insert_employee" on documents for insert
  with check (
    uploaded_by = auth.uid()
    and (
      current_user_role() in ('super_admin', 'dept_admin', 'manager', 'employee')
    )
  );

create policy "docs_delete_admin" on documents for update
  using (
    current_user_role() in ('super_admin', 'dept_admin')
    and (
      current_user_role() = 'super_admin'
      or department_id = current_user_dept()
    )
  );

-- ---- document_chunks ----
create policy "chunks_read_own_dept" on document_chunks for select
  using (
    exists (
      select 1 from documents d
      where d.id = document_id
        and not d.is_deleted
        and (
          current_user_role() = 'super_admin'
          or d.department_id = current_user_dept()
        )
    )
  );

-- ---- conversations ----
create policy "convos_own" on conversations for all
  using (user_id = auth.uid());

create policy "convos_read_superadmin" on conversations for select
  using (current_user_role() = 'super_admin');

-- ---- messages ----
create policy "messages_own_convo" on messages for all
  using (
    exists (
      select 1 from conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

create policy "messages_read_superadmin" on messages for select
  using (current_user_role() = 'super_admin');

-- ---- logs ---- (super_admin only)
create policy "logs_superadmin" on logs for all
  using (current_user_role() = 'super_admin');

-- ---- bug_reports ----
create policy "bugs_read_own" on bug_reports for select
  using (reporter_id = auth.uid());

create policy "bugs_insert_all" on bug_reports for insert
  with check (reporter_id = auth.uid());

create policy "bugs_read_admin" on bug_reports for select
  using (current_user_role() in ('super_admin', 'dept_admin'));

-- ---- sentiment_analyses ----
create policy "sentiment_own" on sentiment_analyses for all
  using (user_id = auth.uid());

-- ---- audit_log ---- (super_admin read only; append via service role)
create policy "audit_superadmin_read" on audit_log for select
  using (current_user_role() = 'super_admin');
