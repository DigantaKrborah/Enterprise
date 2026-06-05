import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── All mocks declared at module level (Vitest hoists vi.mock calls) ──────────

const mockRequireAuth = vi.fn();
const mockQuery       = vi.fn();

// Tracks the last eq() calls so tests can assert on dept filtering
const eqCalls: Array<{ column: string; value: unknown }> = [];

function makeChain() {
  const chain = {
    select:  () => chain,
    eq:      (col: string, val: unknown) => { eqCalls.push({ column: col, value: val }); return chain; },
    order:   () => chain,
    ilike:   () => chain,
    then:    (resolve: (v: unknown) => unknown) => mockQuery().then(resolve),
  };
  // Make chain thenable so `await query` works
  (chain as unknown as Promise<unknown>);
  return chain;
}

vi.mock("@/lib/rbac", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    from: (_table: string) => makeChain(),
  }),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    api:   vi.fn(),
    info:  vi.fn(),
    error: vi.fn(),
    warn:  vi.fn(),
  },
}));

vi.mock("@/lib/errors", () => ({
  serverError: () => new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 }),
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
  is_deleted:    false,
  parent_id:     null,
  uploaded_by:   "admin-1",
  departments:   { id: "dept-1", name: "Operations" },
  users:         { id: "admin-1", full_name: "Admin User", email: "admin@nrl.co" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(url = "http://localhost/api/documents") {
  return new NextRequest(url, { method: "GET" });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/documents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqCalls.length = 0;

    // Default: authenticated super_admin
    mockRequireAuth.mockResolvedValue({
      user:  { id: "admin-1", role: "super_admin", departmentId: "dept-1" },
      error: null,
    });

    // Default: query resolves with one document
    mockQuery.mockResolvedValue({ data: [mockDocument], error: null });
  });

  it("returns 401 when not authenticated", async () => {
    const errorResponse = new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    mockRequireAuth.mockResolvedValue({ user: null, error: errorResponse });

    const { GET } = await import("./route");
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it("returns 200 with list of documents for super_admin", async () => {
    const { GET } = await import("./route");
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json() as { data: typeof mockDocument[] };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data[0].id).toBe("doc-1");
  });

  it("employee user only sees their department's documents", async () => {
    mockRequireAuth.mockResolvedValue({
      user:  { id: "emp-1", role: "employee", departmentId: "dept-2" },
      error: null,
    });

    const { GET } = await import("./route");
    const res = await GET(makeReq());
    expect(res.status).toBe(200);

    // Verify that the query was filtered by the employee's department_id
    const deptFilter = eqCalls.find(
      (c) => c.column === "department_id" && c.value === "dept-2"
    );
    expect(deptFilter).toBeDefined();
  });
});
