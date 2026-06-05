-- Cosine similarity search over document_chunks.
-- Called from the RAG retriever to find semantically similar chunks.
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(768),
  match_count     int     DEFAULT 5,
  filter_dept_id  uuid    DEFAULT NULL
)
RETURNS TABLE (
  id           uuid,
  document_id  uuid,
  chunk_index  int,
  content      text,
  page_number  int,
  metadata     jsonb,
  similarity   float,
  doc_name     text,
  dept_id      uuid,
  doc_version  int
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.chunk_index,
    dc.content,
    dc.page_number,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) AS similarity,
    d.name                                  AS doc_name,
    d.department_id                         AS dept_id,
    d.version                               AS doc_version
  FROM document_chunks dc
  JOIN documents d ON d.id = dc.document_id
  WHERE
    d.is_deleted = FALSE
    AND d.status  = 'indexed'
    AND dc.embedding IS NOT NULL
    AND (filter_dept_id IS NULL OR d.department_id = filter_dept_id)
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
