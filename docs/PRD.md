# Product Requirements Document (PRD)
## Enterprise Refinery AI Platform

> Version: 0.1.0-draft  
> Date: 2026-06-04  
> Status: Draft — Pending Demo Timeline  
> Author: DigantaKrborah + Claude (AI Architect)

---

## 1. Executive Summary

The Enterprise Refinery AI Platform is a single-tenant, AI-first enterprise application that enables refinery employees to query organizational documents through a conversational interface. It replaces manual document search with a multi-agent RAG system, supporting HR and Operations departments at MVP, with a design that scales to the full organization.

---

## 2. Goals & Success Metrics

### Goals
1. Enable any employee to get accurate, cited answers from internal documents in < 5 seconds
2. Automate document ingestion (zero manual indexing steps after upload)
3. Surface email sentiment trends for HR/management
4. Provide admins full visibility into usage, logs, and system health

### Success Metrics (MVP Demo)
| Metric | Target |
|--------|--------|
| RAG answer accuracy | > 80% relevant responses (human eval) |
| Ingestion latency | < 60s from upload to queryable |
| Chat response time | < 5s (streaming starts in < 1s) |
| Supported file types | PDF, Scanned PDF, DOCX, XLSX, PNG/TIFF |
| Concurrent users | 10+ without degradation |
| Citation coverage | 100% of RAG answers include source citation |

---

## 3. Users & Roles

### User Personas

**Refinery Employee (Primary)**
- Needs quick answers to policy or operational questions
- Not technical, uses chat interface only
- Department: HR or Operations (MVP)

**Department Manager**
- Reviews analytics, monitors document freshness
- Can upload documents and manage department users

**Department Admin**
- Manages users, roles, and document library for their dept
- Reviews ingestion status and bug reports

**Super Admin (IT/System)**
- Full system access
- Configures LLMs, monitors system health, manages all departments

### RBAC Matrix

| Permission | Super Admin | Dept Admin | Manager | Employee | Read Only |
|-----------|-------------|-----------|---------|----------|-----------|
| Chat (own dept) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Chat (all depts) | ✓ | — | — | — | — |
| Upload document | ✓ | ✓ | ✓ | ✓ | — |
| Delete document | ✓ | ✓ | — | — | — |
| View analytics | ✓ | ✓ | ✓ | — | — |
| Manage users | ✓ | ✓ (dept) | — | — | — |
| Admin panel | ✓ | Partial | — | — | — |
| LLM config | ✓ | — | — | — | — |
| Bug reporting | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## 4. Functional Requirements

### 4.1 Authentication
- FR-AUTH-01: Users log in via email + password (Supabase Auth)
- FR-AUTH-02: Email invitations sent via Resend
- FR-AUTH-03: JWT-based session management
- FR-AUTH-04: Password reset via email
- FR-AUTH-05: Session timeout after inactivity (configurable, default 8h)

### 4.2 Document Management
- FR-DOC-01: Users can upload PDF, DOCX, XLSX, PNG, TIFF, JPEG files
- FR-DOC-02: Upload triggers auto-ingestion pipeline (async, non-blocking)
- FR-DOC-03: Each upload shows real-time ingestion status (queued / processing / indexed / failed)
- FR-DOC-04: Documents are versioned — re-uploading same filename creates v2, v3, etc.
- FR-DOC-05: Previous versions remain queryable unless explicitly archived
- FR-DOC-06: Document metadata: name, department, uploader, upload date, version, type, size, status
- FR-DOC-07: Documents can be tagged by department and document type
- FR-DOC-08: Soft-delete only — documents are never permanently deleted without Super Admin action

### 4.3 Ingestion Pipeline
- FR-ING-01: Scanned PDFs and images → Gemini Vision API for OCR text extraction
- FR-ING-02: Native PDFs → pdf-parse text extraction
- FR-ING-03: DOCX → mammoth text extraction
- FR-ING-04: XLSX → structured text representation (sheet → row/column text)
- FR-ING-05: Text → semantic chunking (target: 512 tokens, 50-token overlap)
- FR-ING-06: Chunks → embedding via Ollama (local) or Anthropic (cloud, configurable)
- FR-ING-07: Embeddings stored in Supabase pgvector with metadata
- FR-ING-08: Full text + metadata indexed in Elasticsearch
- FR-ING-09: Failed ingestions are retried up to 3 times; then marked failed with error log
- FR-ING-10: PII detected in chunks before storage (SSN, phone, email patterns masked)

### 4.4 Chat Interface
- FR-CHAT-01: Users can start a new conversation at any time
- FR-CHAT-02: Conversation history is persisted per user (last 30 days)
- FR-CHAT-03: Multi-turn context memory (last 10 turns injected into LLM context)
- FR-CHAT-04: Multi-query decomposition for complex questions
- FR-CHAT-05: Every response includes citations (document name + page/chunk reference)
- FR-CHAT-06: Department filter on chat (query HR docs only, Ops only, or all)
- FR-CHAT-07: Streaming responses (tokens appear as generated)
- FR-CHAT-08: Users can give thumbs up/down feedback on any response
- FR-CHAT-09: "Thinking" indicator with AI glimmer animation during generation
- FR-CHAT-10: Conversation can be exported as PDF or copied as text

### 4.5 Multi-Agent System
- FR-AGENT-01: Orchestrator routes queries to appropriate agent based on intent
- FR-AGENT-02: RAG Agent performs hybrid retrieval (pgvector + Elasticsearch)
- FR-AGENT-03: Ingestion Agent runs as background worker on document upload
- FR-AGENT-04: Sentiment Agent analyzes pasted/uploaded email content
- FR-AGENT-05: Log Monitor Agent polls error logs every 5 minutes; creates GitHub Issue on threshold breach
- FR-AGENT-06: All agent actions are logged to structured log store

### 4.6 LLM Routing
- FR-LLM-01: Default routing: Ollama (llama3.2:3b) for simple Q&A
- FR-LLM-02: Complex / long-context queries → Anthropic Claude API
- FR-LLM-03: OCR tasks → Google Gemini Vision API
- FR-LLM-04: LLM responses cached by query hash (TTL: 1 hour) to reduce token spend
- FR-LLM-05: Admin can configure which LLM is active and set token budget limits
- FR-LLM-06: Token usage logged per user, per session, per LLM

### 4.7 Email Sentiment Analysis
- FR-SENT-01: User pastes email text or uploads .eml / .txt file
- FR-SENT-02: Sentiment classification: Positive / Neutral / Negative / Urgent / Mixed
- FR-SENT-03: Key entity extraction: names, dates, action items
- FR-SENT-04: Tone summary in 2–3 sentences
- FR-SENT-05: Results exportable as PDF report
- FR-SENT-06: History of analyses stored per user (last 30 days)

### 4.8 Dashboard
- FR-DASH-01: Document library with filters (dept, type, date, version, status)
- FR-DASH-02: Ingestion queue status
- FR-DASH-03: Query analytics (queries/day, top 10 questions, avg response time)
- FR-DASH-04: LLM token consumption chart (daily, per LLM)
- FR-DASH-05: Recent activity feed

### 4.9 Admin Panel
- FR-ADMIN-01: User list with role assignment and activation toggle
- FR-ADMIN-02: Invite user by email (Resend)
- FR-ADMIN-03: Department management (add/rename departments)
- FR-ADMIN-04: LLM configuration (toggle, model selection, budget)
- FR-ADMIN-05: Bug report list with status tracking
- FR-ADMIN-06: System health panel (ES status, Supabase quota, Ollama status)
- FR-ADMIN-07: Audit log viewer (who accessed what, when)

### 4.10 Bug Reporting
- FR-BUG-01: Any logged-in user can submit a bug report from any page
- FR-BUG-02: Fields: title, description, severity (Critical/High/Medium/Low), steps to reproduce, optional screenshot
- FR-BUG-03: Bug is created as a GitHub Issue via GitHub API
- FR-BUG-04: Reporter receives email confirmation via Resend
- FR-BUG-05: Super Admin can view all bugs; users see only their own submissions
- FR-BUG-06: Bug status synced from GitHub Issue (open/closed)

### 4.11 Logging
- FR-LOG-01: All API calls logged (endpoint, user, latency, status)
- FR-LOG-02: All LLM calls logged (model, token count, latency, cache hit/miss)
- FR-LOG-03: All agent actions logged (agent name, input, output summary, duration)
- FR-LOG-04: Logs written to structured JSON files + Supabase `logs` table
- FR-LOG-05: Log Monitor Agent creates alerts on: 3+ errors in 5 min, ingestion failure rate > 20%

---

## 5. Non-Functional Requirements

| Category | Requirement |
|---------|------------|
| Security | HTTPS everywhere, JWT auth, RBAC enforced at API level |
| PII | PII detected and masked before any cloud LLM call |
| Performance | Chat streaming starts within 1s; ingestion < 60s |
| Scalability | Stateless API routes, Docker containers, ES horizontal scaling |
| Availability | Staging + Prod; health check at `/api/health` |
| Data Retention | Logs: 90 days. Conversations: 30 days. Documents: indefinite |
| Accessibility | WCAG 2.1 AA for all UI components |

---

## 6. Technical Architecture Summary

```
┌─────────────────────────────────────────────────────┐
│                  Cloudflare Pages                    │
│              Next.js 14 (App Router)                 │
│         Frontend + API Routes (Serverless)           │
└──────────────────────┬──────────────────────────────┘
                       │
          ┌────────────┼────────────┐
          │            │            │
    ┌─────▼─────┐ ┌────▼────┐ ┌────▼────────┐
    │ Supabase  │ │ Elastic │ │   Ollama    │
    │ Postgres  │ │ search  │ │ llama3.2:3b │
    │ pgvector  │ │(Docker) │ │  (Docker)   │
    └───────────┘ └─────────┘ └─────────────┘
          │
    ┌─────▼─────────────────────────┐
    │         External APIs         │
    │  Anthropic Claude | Gemini    │
    │  Resend | GitHub API          │
    └───────────────────────────────┘
```

---

## 7. Design System

- **Framework:** Tailwind CSS + shadcn/ui components
- **Theme:** Dark-first, neutral palette with electric blue AI accents
- **AI Glimmer:** Shimmer/pulse animations on chat generation, skeleton loaders, streaming cursor
- **Typography:** Inter (system fallback)
- **Icons:** Lucide React
- **Responsive:** Mobile-aware but desktop-primary (internal enterprise tool)

---

## 8. Environments & Deployment

| Environment | Branch | Trigger | Notes |
|------------|--------|---------|-------|
| Development | `develop` | Local | Docker Compose, local Ollama |
| Staging | `staging` | Auto on merge | Cloudflare preview, Supabase staging project |
| Production | `main` | Manual gate | Cloudflare prod, Supabase prod |

---

## 9. Out of Scope (MVP)

- Multi-tenancy
- Mobile app
- Real-time collaboration
- Email inbox integration (Gmail/Outlook API) — manual paste only at MVP
- DWG/DXF CAD file parsing
- Fine-tuning of LLMs
- Offline mode

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Gemini OCR quality on old scans | High | Pre-process with image enhancement; fallback to EasyOCR |
| Ollama latency on complex queries | Medium | LLM router falls back to Anthropic above complexity threshold |
| Supabase free tier limits | Medium | Monitor quota; optimize query frequency; cache aggressively |
| PII leakage to cloud LLM | High | PII scan mandatory before any cloud API call |
| Elasticsearch memory on Docker | Medium | Configure JVM heap limit in docker-compose |

---

## 11. Open Items

- [ ] Demo deadline / timeline confirmation
- [ ] Confirm embedding model (Ollama nomic-embed-text vs Anthropic embeddings)
- [ ] Email sentiment: manual paste only or connect to inbox at MVP?
- [ ] Drawings: raster images only, or need DWG/DXF support?
