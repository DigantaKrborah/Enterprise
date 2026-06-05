import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── All mocks declared at module level (Vitest hoists vi.mock calls) ──────────

const mockRequireAuth      = vi.fn();
const mockSingle           = vi.fn();
const mockAdminUpdate      = vi.fn();
const mockAdminDelete      = vi.fn();
const mockDeleteDocChunks  = vi.fn().mockResolvedValue(undefined);

// Chainable builder for createClient() (read queries with .single())
function makeServerChain() {
  const chain: Record<string, unknown> = {};
  chain.select  = () => chain;
  chain.eq      = () => chain;
  chain.single  = () => mockSingle();
  return chain;
}

// Chainable builder for getAdminClient()
function makeAdminChain() {
  const chain: Record<string, unknown> = {};
  chain.select  = () => chain;
  chain.eq      = () => chain;
  chain.single  = () => mockSingle();
  chain.update  = () => ({ eq: () => mockAdminUpdate() });
  chain.delete  = () => ({ eq: () => mockAdminDelete() });
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

vi.mock("@/lib/audit", () => ({
  auditLog: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    api:   vi.fn(),
    info:  vi.fn(),
    error: vi.fn(),
    warn:  vi.fn(),
  },
}));

vi.mock("@/lib/search/elasticsearch", () => ({
  deleteDocumentChunks: (...args: unknown[]) => mockDeleteDocChunks(...args),
}));

vi.mock("@/lib/errors", () => ({
  forbidden:   ()            => new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
  notFound:    (r: string)   => new Response(JSON.stringify({ error: `${r} not found` }), { status: 404 }),
  serverError: ()            => new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 }),
}));

// ── Mock document ─────────────────────────────────────────────────────────────

const mockDocument = {
  id:            "doc-1",
  name:          "ops-manual-v1.pdf",
  original_name: "ops-manual-v1.pdf",
  department_id: "dept-1",
  file_type:     "pdf",
  version:       1,
  status:        "indexed",
  error_msg:     null,
  size_bytes:    204800,
  page_count:    42,
  created_at:    "2026-01-01T00:00:00Z",
  parent_id:     null,
  storage_path:  "documents/doc-1/ops-manual-v1.pdf",
  departments:   { id: "dept-1", name: "Operations" },
  users:         { id: "admin-1", full_name: "Admin User", email: "admin@nrl.co" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(method: string) {
  return new NextRequest("http://localhost/api/documents/doc-1", { method });
}

const routeCtx = { params: { id: "doc-1" } };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/documents/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockRequireAuth.mockResolvedValue({
      user:  { id: "user-1", role: "dept_admin", departmentId: "dept-1" },
      error: null,
    });

    mockSingle.mockResolvedValue({ data: mockDocument, error: null });
  });

  it("returns 200 for user in same department", async () => {
    const { GET } = await import("./route");
    const res = await GET(makeReq("GET"), routeCtx);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: typeof mockDocument };
    expect(body.data.id).toBe("doc-1");
  });

  it("returns 404 when document not found", async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: "not found" } });

    const { GET } = await import("./route");
    const res = await GET(makeReq("GET"), routeCtx);
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/documents/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: dept_admin in same department
    mockRequireAuth.mockResolvedValue({
      user:  { id: "admin-1", role: "dept_admin", departmentId: "dept-1" },
      error: null,
    });

    mockSingle.mockResolvedValue({ data: mockDocument, error: null });
    mockAdminUpdate.mockResolvedValue({ error: null });
    mockAdminDelete.mockResolvedValue({ error: null });
  });

  it("returns 200 when dept_admin deletes their department's document", async () => {
    const { DELETE } = await import("./route");
    const res = await DELETE(makeReq("DELETE"), routeCtx);
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it("returns 403 when employee tries to delete", async () => {
    const forbiddenResponse = new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    mockRequireAuth.mockResolvedValue({ user: null, error: forbiddenResponse });

    const { DELETE } = await import("./route");
    const res = await DELETE(makeReq("DELETE"), routeCtx);
    expect(res.status).toBe(403);
  });
});
