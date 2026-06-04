# Architecture Document
## Enterprise Refinery AI Platform

> Version: 0.1.0-draft  
> Date: 2026-06-04  
> Status: Draft

---

## 1. System Overview

Single-tenant, single-stack architecture. Next.js handles both frontend rendering and API logic via serverless API routes. All persistence is through Supabase. Search is via Elasticsearch (Docker). LLMs are routed dynamically between local (Ollama) and cloud (Anthropic, Gemini).

---

## 2. Component Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                           │
│                    Next.js React (App Router)                     │
│         Chat UI | Dashboard | Admin Panel | Document Library      │
└───────────────────────────┬──────────────────────────────────────┘
                            │ HTTPS
┌───────────────────────────▼──────────────────────────────────────┐
│                  NEXT.JS API ROUTES (Cloudflare Workers)          │
│                                                                    │
│  /api/auth/*        /api/documents/*    /api/chat/*               │
│  /api/ingest/*      /api/agents/*       /api/admin/*              │
│  /api/sentiment/*   /api/bugs/*         /api/health               │
└──────┬──────────────────┬──────────────────────┬─────────────────┘
       │                  │                      │
┌──────▼──────┐  ┌────────▼────────┐  ┌──────────▼───────────┐
│  Supabase   │  │  Elasticsearch  │  │     LLM Router        │
│  Postgres   │  │   (Docker)      │  │                       │
│  pgvector   │  │  Full-text +    │  │  ┌─────────────────┐  │
│  Auth       │  │  metadata idx   │  │  │ Ollama          │  │
│  Storage    │  └─────────────────┘  │  │ llama3.2:3b     │  │
└─────────────┘                       │  │ (local Docker)  │  │
                                      │  ├─────────────────┤  │
                                      │  │ Anthropic Claude│  │
                                      │  │ (cloud API)     │  │
                                      │  ├─────────────────┤  │
                                      │  │ Google Gemini   │  │
                                      │  │ (OCR + vision)  │  │
                                      │  └─────────────────┘  │
                                      └──────────────────────┘
```

---

## 3. Database Schema

### 3.1 Supabase PostgreSQL Tables

```sql
-- Users (managed by Supabase Auth, extended)
users
  id            uuid PK (auth.users FK)
  email         text UNIQUE NOT NULL
  full_name     text
  role          enum('super_admin','dept_admin','manager','employee','read_only')
  department_id uuid FK → departments
  is_active     boolean DEFAULT true
  created_at    timestamptz DEFAULT now()

-- Departments
departments
  id            uuid PK DEFAULT gen_random_uuid()
  name          text UNIQUE NOT NULL
  description   text
  created_at    timestamptz DEFAULT now()

-- Documents
documents
  id            uuid PK DEFAULT gen_random_uuid()
  name          text NOT NULL
  original_name text NOT NULL
  department_id uuid FK → departments
  uploaded_by   uuid FK → users
  file_type     enum('pdf','scanned_pdf','docx','xlsx','image','drawing')
  storage_path  text NOT NULL
  version       integer DEFAULT 1
  parent_id     uuid FK → documents (NULL for v1)
  status        enum('queued','processing','indexed','failed')
  error_msg     text
  size_bytes    bigint
  page_count    integer
  created_at    timestamptz DEFAULT now()

-- Document Chunks (vector store)
document_chunks
  id            uuid PK DEFAULT gen_random_uuid()
  document_id   uuid FK → documents
  chunk_index   integer NOT NULL
  content       text NOT NULL
  embedding     vector(1536)            -- pgvector
  page_number   integer
  metadata      jsonb
  created_at    timestamptz DEFAULT now()

-- Conversations
conversations
  id            uuid PK DEFAULT gen_random_uuid()
  user_id       uuid FK → users
  title         text
  department_filter uuid FK → departments (nullable)
  created_at    timestamptz DEFAULT now()
  updated_at    timestamptz DEFAULT now()

-- Messages
messages
  id            uuid PK DEFAULT gen_random_uuid()
  conversation_id uuid FK → conversations
  role          enum('user','assistant')
  content       text NOT NULL
  citations     jsonb    -- [{doc_id, doc_name, chunk_index, page}]
  llm_used      text
  token_count   integer
  feedback      enum('up','down') (nullable)
  created_at    timestamptz DEFAULT now()

-- Logs
logs
  id            uuid PK DEFAULT gen_random_uuid()
  level         enum('INFO','WARN','ERROR','DEBUG')
  service       text NOT NULL    -- 'api', 'ingest_agent', 'rag_agent', etc.
  message       text NOT NULL
  metadata      jsonb
  user_id       uuid FK → users (nullable)
  created_at    timestamptz DEFAULT now()

-- Bug Reports
bug_reports
  id            uuid PK DEFAULT gen_random_uuid()
  title         text NOT NULL
  description   text NOT NULL
  severity      enum('critical','high','medium','low')
  reporter_id   uuid FK → users
  github_issue_number integer
  github_issue_url    text
  status        enum('open','in_progress','closed') DEFAULT 'open'
  created_at    timestamptz DEFAULT now()

-- Sentiment Analysis History
sentiment_analyses
  id            uuid PK DEFAULT gen_random_uuid()
  user_id       uuid FK → users
  input_text    text NOT NULL
  sentiment     enum('positive','neutral','negative','urgent','mixed')
  summary       text
  entities      jsonb
  llm_used      text
  created_at    timestamptz DEFAULT now()

-- Audit Log
audit_log
  id            uuid PK DEFAULT gen_random_uuid()
  user_id       uuid FK → users
  action        text NOT NULL    -- 'view_document', 'upload', 'delete', 'query', etc.
  resource_type text
  resource_id   uuid
  ip_address    text
  created_at    timestamptz DEFAULT now()
```

### 3.2 Elasticsearch Index Schema

```json
{
  "index": "enterprise_documents",
  "mappings": {
    "properties": {
      "document_id":    { "type": "keyword" },
      "chunk_id":       { "type": "keyword" },
      "department_id":  { "type": "keyword" },
      "content":        { "type": "text", "analyzer": "english" },
      "page_number":    { "type": "integer" },
      "doc_name":       { "type": "text", "fields": { "keyword": { "type": "keyword" } } },
      "doc_type":       { "type": "keyword" },
      "version":        { "type": "integer" },
      "created_at":     { "type": "date" }
    }
  }
}
```

---

## 4. Agent Design

### 4.1 Ingestion Agent
```
Trigger: POST /api/ingest (document upload)
Steps:
  1. Fetch file from Supabase Storage
  2. Determine type → select extractor
  3. Extract text (pdf-parse / mammoth / xlsx / Gemini OCR)
  4. PII scan → mask before storing
  5. Chunk text (512 tokens, 50 overlap)
  6. Generate embeddings (Ollama nomic-embed-text)
  7. Upsert chunks → Supabase pgvector
  8. Index chunks → Elasticsearch
  9. Update document status → 'indexed'
 10. Log completion
```

### 4.2 RAG Agent
```
Trigger: POST /api/chat (user message)
Steps:
  1. PII scan on query
  2. Query decomposition (if complex → split to sub-queries)
  3. Department filter applied
  4. Parallel retrieval:
     a. pgvector semantic search (top-5 per sub-query)
     b. Elasticsearch keyword search (top-5 per sub-query)
  5. Merge + deduplicate + re-rank results
  6. Build prompt: system + context chunks + conversation history + query
  7. LLM Router → select model
  8. LLM call (streaming)
  9. Build citations array from retrieved chunks
 10. Return streamed response + citations
 11. Log tokens used
```

### 4.3 LLM Router
```
Input: query, context_size, user_dept, sensitivity_flag
Logic:
  - If context_size > 8000 tokens → Anthropic
  - If sensitivity_flag (PII-adjacent) → Ollama (local only)
  - If simple factual → Ollama
  - Else → Anthropic
  - OCR tasks → always Gemini
Output: selected_llm, model_name
```

### 4.4 Log Monitor Agent
```
Schedule: every 5 minutes (n8n cron or Next.js cron route)
Steps:
  1. Query logs table: errors in last 5 min
  2. If error_count >= 3 → create GitHub Issue (severity: high)
  3. If ingestion failure_rate > 20% → create GitHub Issue (severity: critical)
  4. Log agent run result
```

---

## 5. API Routes Structure

```
/api/
├── health                GET   System health check
├── auth/
│   ├── login             POST  Supabase auth
│   ├── logout            POST
│   └── invite            POST  Send Resend invite email
├── documents/
│   ├── index             GET   List documents (with filters)
│   ├── [id]              GET   Get document metadata
│   ├── [id]/versions     GET   Get all versions
│   └── [id]              DELETE Soft delete
├── ingest/
│   └── upload            POST  Upload + trigger ingestion pipeline
├── chat/
│   ├── conversations     GET   List user conversations
│   ├── conversations     POST  Create new conversation
│   ├── [id]/messages     GET   Get conversation messages
│   └── [id]/messages     POST  Send message → RAG → stream response
├── sentiment/
│   └── analyze           POST  Analyze email sentiment
├── agents/
│   └── status            GET   Agent health / last run status
├── admin/
│   ├── users             GET/POST/PATCH
│   ├── departments       GET/POST/PATCH
│   ├── llm-config        GET/PATCH
│   └── system-health     GET
├── bugs/
│   ├── index             GET   List bugs
│   └── index             POST  Create bug report
└── logs/
    └── index             GET   Query logs (admin only)
```

---

## 6. CI/CD Pipeline

```yaml
# On PR → develop: lint + unit tests
# On merge → staging: build + integration tests + deploy staging
# On merge → main: full suite + deploy prod + create release tag

Stages:
  1. Lint (ESLint, TypeScript check)
  2. Unit tests (Jest/Vitest)
  3. Integration tests (DB + ES)
  4. Build (next build)
  5. Deploy (Cloudflare Pages)
  6. Post-deploy health check
  7. Notify (GitHub status)
```

---

## 7. Security Architecture

- All API routes protected by Supabase JWT middleware
- RBAC enforced at API route level (not just UI)
- PII regex scan on all text before cloud LLM calls
- Supabase Row Level Security (RLS) on all tables
- Secrets stored in Cloudflare Workers environment variables
- GitHub Actions secrets for CI/CD credentials
- Rate limiting on chat API (10 req/min per user)
- Input sanitization on all user inputs

---

## 8. Local Development Setup

```bash
# Prerequisites
# - Docker Desktop
# - Node.js 20+
# - Ollama (already installed)

# Clone and install
git clone https://github.com/DigantaKrborah/Enterprise
cd Enterprise
npm install

# Start infrastructure
docker-compose up -d  # Starts Elasticsearch

# Pull Ollama models
ollama pull llama3.2:3b
ollama pull nomic-embed-text

# Configure environment
cp .env.example .env.local
# Fill in: SUPABASE_URL, SUPABASE_ANON_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, RESEND_API_KEY

# Run migrations
npm run db:migrate

# Start dev server
npm run dev
```
