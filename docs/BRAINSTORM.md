# Enterprise Refinery AI Platform — Brainstorm

> Phase: SDLC Phase 1 — Brainstorm  
> Date: 2026-06-04  
> Status: Active

---

## 1. Problem Statement

Refinery operations generate massive volumes of documents across departments (HR, Operations, Safety, Finance). These documents — policies, SOPs, maintenance manuals, scanned drawings, compliance reports — are siloed, hard to search, and require expert navigation. Employees waste time hunting for answers that exist somewhere in the document pile.

**Core pain points:**
- No unified interface to query across departments
- Scanned/legacy documents are unsearchable
- HR policy questions require manual lookup
- No institutional memory or context-aware responses
- Email communication lacks sentiment visibility for management
- Document updates don't propagate to people who need them

---

## 2. Vision

An AI-first enterprise platform where any refinery employee can ask a question in plain language and receive an accurate, cited answer drawn from the organization's own documents — regardless of department, document format, or whether the document was scanned decades ago.

---

## 3. Core Modules (MVP)

### 3.1 Chat Interface (AI-First)
- Conversational RAG — query documents in natural language
- Context memory (multi-turn conversation)
- Multi-query decomposition (complex questions split into sub-queries)
- Citation-based responses (every answer links back to source document + page)
- Department-aware routing (HR queries → HR docs, Ops queries → Ops docs)
- Glimmer effects (subtle AI animation cues on generation)

### 3.2 Document Management & Ingestion Pipeline
- File upload: PDF, Scanned PDF, Word (.docx), Excel (.xlsx), Drawings (PNG/TIFF)
- Auto-ingestion: upload triggers the full pipeline immediately
- OCR via Gemini API for scanned PDFs and drawings
- Chunking strategy: semantic + fixed-size hybrid
- Embedding: stored in Supabase pgvector
- Full-text index: Elasticsearch (Docker)
- File versioning: new upload of same doc creates a new version; old version preserved
- Metadata: department, uploader, date, version, doc type

### 3.3 Multi-Agent Architecture
| Agent | Responsibility |
|-------|---------------|
| Ingestion Agent | Triggered on upload: OCR → chunk → embed → index |
| RAG Agent | Query → hybrid retrieval (vector + keyword) → LLM → cited response |
| Sentiment Agent | Email text → Gemini/Claude → polarity + summary |
| Log Monitor Agent | Watch logs → detect anomalies → alert / create bug ticket |
| Orchestrator | Route user queries to the right agent and LLM |

### 3.4 Multi-LLM Harness
- **Local (fast, private):** Ollama → llama3.2:3b — for non-sensitive, quick Q&A
- **Cloud (capable):** Anthropic Claude — for complex reasoning, long docs, citations
- **OCR/Vision:** Google Gemini — for scanned documents and drawings
- **Routing logic:** complexity score + doc sensitivity + token budget → pick LLM
- **LLM Caching:** cache embeddings and frequent query responses (Redis or in-memory)
- **Token optimization:** query compression, context window management, streaming

### 3.5 Dashboard
- Document library view (filter by dept, type, date, version)
- Ingestion status (processing / indexed / failed)
- Usage analytics (queries per day, top documents, LLM token spend)
- Department overview

### 3.6 Admin Panel
- User management (invite, deactivate, assign roles)
- Role & permission management (RBAC)
- Department configuration
- LLM configuration (toggle local vs cloud, set budget limits)
- Bug report viewer
- System health (Elasticsearch status, vector DB stats, agent status)

### 3.7 Email Sentiment Analysis
- Paste or upload email thread
- Sentiment classification: Positive / Neutral / Negative / Urgent
- Key entity extraction (names, dates, actions)
- Summary with tone analysis
- Useful for HR, management escalation tracking

### 3.8 RBAC & Multi-Department
| Role | Permissions |
|------|------------|
| Super Admin | Full access, all departments |
| Department Admin | Manage docs + users within their dept |
| Manager | Read all in dept + view analytics |
| Employee | Query + upload within their dept |
| Read Only | Query only, no upload |

Departments (MVP): **HR, Operations**

### 3.9 Bug Reporting System (In-Project)
- Any user can raise a bug/issue from within the app
- Linked to GitHub Issues via API
- Fields: title, description, severity, screenshot, steps to reproduce
- Bug dashboard in Admin Panel
- Severity: Critical / High / Medium / Low

### 3.10 Logging System
- Structured logs: every agent action, LLM call, ingestion step logged
- Log levels: INFO, WARN, ERROR, DEBUG
- Log storage: file-based (local) + Supabase table for queryable logs
- Log Monitor Agent: polls error logs, auto-creates bug tickets for repeated errors
- Audit log: who accessed what document, when

---

## 4. Non-Functional Requirements

| Concern | Approach |
|---------|---------|
| Security | RBAC, JWT, PII detection/masking before LLM calls |
| PII | Regex + NER scan on text before sending to cloud LLM |
| Scalability | Docker containers, stateless API routes, Elasticsearch sharding |
| Single Tenant | One org, one DB schema — no multi-tenancy overhead |
| Availability | Staging + Prod environments, health check endpoints |
| Performance | LLM response streaming, embedding cache, ES query cache |
| Versioning | Semantic versioning on docs + software releases |

---

## 5. Tech Stack (Finalized)

| Layer | Technology | Hosting |
|-------|-----------|---------|
| Frontend + API | Next.js 14 (App Router + API Routes) | Cloudflare Pages + Workers |
| Styling | Tailwind CSS + shadcn/ui | — |
| Database | Supabase PostgreSQL | Supabase (free tier) |
| Vector Store | Supabase pgvector | Supabase (free tier) |
| Search | Elasticsearch 8 | Docker (self-hosted) |
| Auth | Supabase Auth + Resend (email) | Supabase / Resend free |
| Local LLM | Ollama (llama3.2:3b) | Local Docker |
| Cloud LLM | Anthropic Claude API | Pay-per-use |
| OCR | Google Gemini API | Pay-per-use (free tier) |
| Automation | n8n (self-hosted) | Docker |
| Containers | Docker + Docker Compose | Local / VPS |
| CI/CD | GitHub Actions | Free tier |
| Monitoring | Custom log agent + GitHub Issues | In-project |

---

## 6. Data Flow

```
User Upload
    │
    ▼
Next.js API Route /api/ingest
    │
    ├── If scanned PDF/image → Gemini OCR → extracted text
    ├── If PDF → pdf-parse → text
    ├── If DOCX → mammoth → text
    └── If XLSX → xlsx → text
    │
    ▼
Chunking (semantic + fixed-size hybrid)
    │
    ▼
Embedding (Ollama local embeddings or Anthropic)
    │
    ├── → Supabase pgvector (semantic search)
    └── → Elasticsearch (full-text search)
    │
    ▼
Metadata → Supabase documents table
    │
    ▼
Ingestion complete → notify user
```

```
User Chat Query
    │
    ▼
PII scan on query
    │
    ▼
Orchestrator Agent
    │
    ├── Query decomposition (multi-query)
    ├── Department context injection
    │
    ▼
Hybrid Retrieval
    ├── pgvector semantic search (top-k)
    └── Elasticsearch keyword search (top-k)
    │
    ▼
Re-ranking (combine + deduplicate results)
    │
    ▼
LLM Router (local vs cloud based on complexity + sensitivity)
    │
    ▼
LLM call (streaming) with context + citations
    │
    ▼
PII masking on output
    │
    ▼
Response with citations → User
```

---

## 7. Environment Strategy

| Environment | Purpose | Deployment |
|------------|---------|-----------|
| `develop` branch | Active dev, local Docker | Local machine |
| `staging` branch | Pre-prod testing, integration tests | Staging Cloudflare + Supabase |
| `main` branch | Production | Prod Cloudflare + Supabase |

---

## 8. CI/CD Pipeline (GitHub Actions)

- **On PR to develop:** lint + unit tests
- **On merge to staging:** build + integration tests + deploy to staging
- **On merge to main:** full test suite + deploy to prod + tag release
- **Versioning:** semantic versioning (v1.0.0, v1.1.0, etc.)

---

## 9. Open Questions (Pending)

- [ ] Demo timeline / deadline?
- [ ] 4th LLM option (left blank in requirements)?
- [ ] Will emails be fetched from a real inbox (Gmail/Outlook API) or pasted manually?
- [ ] Drawings format: CAD exports (DXF/DWG) or raster images (PNG/TIFF)?
- [ ] Preferred embedding model: Ollama local or Anthropic?

---

## 10. MVP Phasing

### Phase 1 — Foundation (Weeks 1–2)
- Project scaffold, auth, RBAC, DB schema
- Document upload + basic ingestion pipeline
- Simple chat (single LLM, no RAG yet)

### Phase 2 — RAG Core (Weeks 3–4)
- Full ingestion: OCR, chunking, embedding, Elasticsearch
- Hybrid retrieval + citation responses
- Context memory in chat

### Phase 3 — Agents + Dashboard (Weeks 5–6)
- Multi-agent orchestration
- Dashboard + Admin panel
- Email sentiment analysis
- Bug reporting system

### Phase 4 — Polish + CI/CD (Week 7–8)
- AI glimmer effects, design system
- Multi-LLM routing + token optimization
- Full CI/CD, logging, PII masking
- Staging + production deployment
