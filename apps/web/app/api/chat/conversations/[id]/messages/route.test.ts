import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── All mocks declared at module level (Vitest hoists vi.mock calls) ──────────

const mockRequireAuth = vi.fn();

const mockSingle        = vi.fn();
const mockOrder         = vi.fn();
const mockLimit         = vi.fn();
const mockInsertSelect  = vi.fn();
const mockUpdate        = vi.fn();
const mockEqConv        = vi.fn();
const mockEqMsg         = vi.fn();

// Chainable supabase builder used for createClient()
function makeServerChain() {
  const chain: Record<string, unknown> = {};
  chain.select   = () => chain;
  chain.eq       = () => chain;
  chain.order    = () => chain;
  chain.limit    = () => mockLimit();
  chain.single   = () => mockSingle();
  chain.insert   = () => ({ select: () => ({ single: mockInsertSelect }) });
  chain.update   = () => ({ eq: () => mockUpdate() });
  return chain;
}

// Chainable supabase builder used for getAdminClient()
function makeAdminChain() {
  const chain: Record<string, unknown> = {};
  chain.select   = () => chain;
  chain.eq       = () => chain;
  chain.order    = () => chain;
  chain.limit    = () => mockLimit();
  chain.single   = () => mockSingle();
  chain.insert   = () => ({ select: () => ({ single: mockInsertSelect }) });
  chain.update   = () => ({ eq: () => mockUpdate() });
  chain.delete   = () => chain;
  return chain;
}

vi.mock("@/lib/rbac", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ from: (_table: string) => makeServerChain() }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: () => ({ from: (_table: string) => makeAdminChain() }),
}));

vi.mock("@/lib/pii", () => ({
  containsPII:    vi.fn().mockReturnValue(false),
  scanAndMaskPII: vi.fn().mockReturnValue({ masked: "text", hasPII: false }),
}));

vi.mock("@/lib/rate-limit", () => ({
  chatRateLimit: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/rag/retriever", () => ({
  hybridRetrieve: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/llm/router", () => ({
  routeLLM: vi.fn().mockReturnValue({ provider: "ollama", model: "llama3.2:3b", reason: "default" }),
}));

vi.mock("@/lib/llm/ollama", () => ({
  streamOllamaChat: vi.fn().mockImplementation(
    async (opts: { onChunk: (text: string) => void }) => {
      opts.onChunk("Hello");
      return { totalTokens: 30, durationMs: 100 };
    }
  ),
}));

vi.mock("@/lib/llm/claude", () => ({
  streamClaudeChat: vi.fn(),
}));

vi.mock("@/lib/llm/stream", () => ({
  sseChunk:    (text: string)   => `data: ${JSON.stringify({ type: "chunk", text })}\n\n`,
  sseDone:     (meta: unknown)  => `data: ${JSON.stringify({ type: "done", ...Object(meta) })}\n\n`,
  sseError:    (msg: string)    => `data: ${JSON.stringify({ type: "error", message: msg })}\n\n`,
  SSE_HEADERS: { "Content-Type": "text/event-stream" },
}));

vi.mock("@/lib/audit", () => ({
  auditLog: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    api:   vi.fn(),
    info:  vi.fn(),
    error: vi.fn(),
    warn:  vi.fn(),
    llm:   vi.fn(),
  },
}));

vi.mock("@/lib/errors", () => ({
  badRequest:  (msg: string) => new Response(JSON.stringify({ error: msg }), { status: 400 }),
  forbidden:   ()            => new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
  notFound:    (r: string)   => new Response(JSON.stringify({ error: `${r} not found` }), { status: 404 }),
  rateLimited: ()            => new Response(JSON.stringify({ error: "Too many requests" }), { status: 429 }),
  serverError: ()            => new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(method: string, body?: object) {
  return new NextRequest("http://localhost/api/chat/conversations/conv-1/messages", {
    method,
    ...(body
      ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }
      : {}),
  });
}

const routeCtx = { params: { id: "conv-1" } };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/chat/conversations/:id/messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockRequireAuth.mockResolvedValue({
      user:  { id: "user-1", role: "super_admin", departmentId: "dept-1" },
      error: null,
    });

    // .single() for the conversations lookup
    mockSingle.mockResolvedValue({
      data:  { id: "conv-1", user_id: "user-1" },
      error: null,
    });

    // .order() terminates the messages chain
    mockOrder.mockResolvedValue({ data: [], error: null });

    // .limit() terminates history chain
    mockLimit.mockResolvedValue({ data: [], error: null });
  });

  it("returns 200 with messages list", async () => {
    const { GET } = await import("./route");
    const res = await GET(makeReq("GET"), routeCtx);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("returns 403 when accessing another user's conversation", async () => {
    mockRequireAuth.mockResolvedValue({
      user:  { id: "user-1", role: "employee", departmentId: "dept-1" },
      error: null,
    });
    mockSingle.mockResolvedValue({
      data:  { id: "conv-1", user_id: "other-user" },
      error: null,
    });

    const { GET } = await import("./route");
    const res = await GET(makeReq("GET"), routeCtx);
    expect(res.status).toBe(403);
  });
});

describe("POST /api/chat/conversations/:id/messages", () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    mockRequireAuth.mockResolvedValue({
      user:  { id: "user-1", role: "super_admin", departmentId: "dept-1" },
      error: null,
    });

    // .single() for the conversations lookup — includes title for auto-title branch
    mockSingle.mockResolvedValue({
      data:  { id: "conv-1", user_id: "user-1", department_filter: "dept-1", title: "Some conversation" },
      error: null,
    });

    // insert → select → single for saving user message
    mockInsertSelect.mockResolvedValue({ data: { id: "msg-1" }, error: null });

    // update (auto-title) chain
    mockUpdate.mockResolvedValue({ error: null });

    // history fetch
    mockLimit.mockResolvedValue({ data: [], error: null });

    // Ensure rate limiter allows requests by default (clearAllMocks resets call counts
    // but not return values — explicitly reset here so the 429 test does not bleed over)
    const { chatRateLimit } = await import("@/lib/rate-limit");
    vi.mocked(chatRateLimit).mockReturnValue(true);
  });

  it("returns 400 when message content is empty or missing", async () => {
    const { POST } = await import("./route");

    const resEmpty   = await POST(makeReq("POST", { content: "" }), routeCtx);
    expect(resEmpty.status).toBe(400);

    const resMissing = await POST(makeReq("POST", {}), routeCtx);
    expect(resMissing.status).toBe(400);
  });

  it("returns 429 when rate limited", async () => {
    const { chatRateLimit } = await import("@/lib/rate-limit");
    vi.mocked(chatRateLimit).mockReturnValue(false);

    const { POST } = await import("./route");
    const res = await POST(makeReq("POST", { content: "What is the pressure limit?" }), routeCtx);
    expect(res.status).toBe(429);
  });

  it("returns 200 when valid message is posted", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeReq("POST", { content: "What is the pressure limit?" }), routeCtx);
    expect(res.status).toBe(200);
  });
});
