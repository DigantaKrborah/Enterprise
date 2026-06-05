import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Module-level mocks ────────────────────────────────────────────────────────

const mockRequireAuth = vi.fn();

// Supabase server client chain: from("users").select().order()
const mockOrder = vi.fn();
const mockSelect = vi.fn(() => ({ order: mockOrder }));
const mockServerFrom = vi.fn(() => ({ select: mockSelect }));

// Admin client chain: from("users").update().eq()
const mockAdminEq = vi.fn();
const mockAdminUpdate = vi.fn(() => ({ eq: mockAdminEq }));
const mockAdminFrom = vi.fn(() => ({ update: mockAdminUpdate }));

vi.mock("@/lib/rbac", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ from: mockServerFrom }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: () => ({ from: mockAdminFrom }),
}));

vi.mock("@/lib/audit", () => ({ auditLog: vi.fn() }));

vi.mock("@/lib/logger", () => ({
  logger: { api: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SUPER_ADMIN = { id: "admin-1", role: "super_admin" as const };

const USER_ROW = {
  id: "u1",
  email: "a@nrl.co",
  full_name: "Alice",
  role: "employee",
  department_id: "dept-1",
  is_active: true,
  created_at: "2026-01-01",
  departments: { id: "dept-1", name: "Operations" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePatchReq(body: object) {
  return new NextRequest("http://localhost/api/admin/users/u1", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// ── GET /api/admin/users ──────────────────────────────────────────────────────

describe("GET /api/admin/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ user: SUPER_ADMIN, error: null });
    mockOrder.mockResolvedValue({ data: [USER_ROW], error: null });
  });

  it("returns 403 when non-admin calls the route", async () => {
    const forbidden = new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    mockRequireAuth.mockResolvedValue({ user: null, error: forbidden });

    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost/api/admin/users");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("returns 200 with users list for super_admin", async () => {
    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost/api/admin/users");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json() as { data: typeof USER_ROW[] };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data[0].id).toBe("u1");
    expect(body.data[0].email).toBe("a@nrl.co");
  });
});

// ── PATCH /api/admin/users/:id ────────────────────────────────────────────────

describe("PATCH /api/admin/users/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ user: SUPER_ADMIN, error: null });
    mockAdminEq.mockResolvedValue({ error: null });
  });

  it("returns 200 when toggling is_active to false", async () => {
    const { PATCH } = await import("./[id]/route");
    // Route uses camelCase: isActive (maps to DB column is_active)
    const res = await PATCH(makePatchReq({ isActive: false }), { params: { id: "u1" } });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it("returns 400 when given an invalid role", async () => {
    const { PATCH } = await import("./[id]/route");
    const res = await PATCH(makePatchReq({ role: "god_mode" }), { params: { id: "u1" } });
    expect(res.status).toBe(400);
  });

  it("returns 400 when admin tries to modify their own account", async () => {
    // admin-1 is the authenticated user; id param is also admin-1
    const { PATCH } = await import("./[id]/route");
    const req = new NextRequest("http://localhost/api/admin/users/admin-1", {
      method: "PATCH",
      body: JSON.stringify({ isActive: false }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, { params: { id: "admin-1" } });
    expect(res.status).toBe(400);
  });
});
