# CLAUDE.md — Enterprise Refinery AI Platform

## Project Context
Enterprise-grade single-tenant RAG platform for refinery operations.
MVP covers HR and Operations departments.
This is a tech capability demo — free-tier infra, local Docker.

## Stack (locked — do not suggest alternatives)
- **Frontend + Backend:** Next.js 14 App Router + API Routes (full Node.js via Docker)
- **Database:** Supabase PostgreSQL + pgvector
- **Search:** Elasticsearch 8 (Docker)
- **Auth:** Supabase Auth + Resend (email)
- **Local LLM:** Ollama llama3.2:3b
- **Cloud LLM:** Anthropic Claude API
- **OCR:** Google Gemini Vision API
- **Containers:** Docker + Docker Compose
- **CI/CD:** GitHub Actions
- **Bug tracking:** GitHub Issues via API
- **Styling:** Tailwind CSS + shadcn/ui

## SDLC Phase (update as we progress)
Current phase: **Analytics / PRD** → Design → Development → Testing → Deployment

## Coding Rules
- TypeScript everywhere — no `any`, no implicit types
- No comments unless the WHY is non-obvious
- No mock databases in tests — hit real Supabase test project
- Unit tests live next to the file: `lib/rag/chunker.ts` → `lib/rag/chunker.test.ts`
- E2E tests live in `/e2e`
- All API routes enforce RBAC at the route level, not just in UI
- PII scan runs before every cloud LLM call — never skip this
- LLM calls are always logged (model, tokens, latency, cache hit)
- Stream all LLM responses — never wait for full completion before sending

## File & Folder Conventions
- `apps/web/app/` — Next.js App Router pages and layouts
- `apps/web/app/api/` — API routes
- `apps/web/lib/` — business logic (agents, rag, llm, ocr, db, search, auth)
- `apps/web/components/` — React components
- `infra/docker/` — Docker Compose files
- `infra/supabase/migrations/` — DB migrations
- `docs/` — Architecture, PRD, brainstorm (lean — no fluff)
- `.github/workflows/` — CI/CD pipelines
- `e2e/` — Playwright E2E tests

## Environments
- `develop` branch → local Docker (dev)
- `staging` branch → auto-deploy staging
- `main` branch → manual gate, production

## What NOT to do
- Do not create documentation files unless explicitly asked
- Do not add error handling for impossible scenarios
- Do not introduce abstractions beyond what the current task requires
- Do not add multi-tenancy — this is single-tenant by design
- Do not suggest paid infra — this is a free-tier demo
- Do not mock the database in tests
