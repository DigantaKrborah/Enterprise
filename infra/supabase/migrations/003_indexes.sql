-- Performance indexes

-- Vector similarity search (IVFFlat for cosine distance)
-- lists=100 is appropriate for ~100k-1M vectors
create index if not exists idx_chunks_embedding
  on document_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Conversation lookups
create index if not exists idx_conversations_user    on conversations (user_id, updated_at desc);
create index if not exists idx_messages_conversation on messages      (conversation_id, created_at asc);

-- Document lookups
create index if not exists idx_documents_dept       on documents (department_id, created_at desc);
create index if not exists idx_documents_status     on documents (status);
create index if not exists idx_chunks_document      on document_chunks (document_id, chunk_index);

-- Logs (time-series access pattern)
create index if not exists idx_logs_created   on logs (created_at desc);
create index if not exists idx_logs_level     on logs (level, created_at desc);
create index if not exists idx_logs_service   on logs (service, created_at desc);

-- Audit log
create index if not exists idx_audit_user    on audit_log (user_id, created_at desc);
create index if not exists idx_audit_action  on audit_log (action, created_at desc);

-- Sentiment history
create index if not exists idx_sentiment_user on sentiment_analyses (user_id, created_at desc);

-- Updated_at trigger for conversations
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger conversations_updated_at
  before update on conversations
  for each row execute function update_updated_at();
