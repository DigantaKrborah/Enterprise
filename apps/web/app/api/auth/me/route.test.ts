import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Module-level mocks ────────────────────────────────────────────────────────

const mockRequireAuth = vi.fn();
const mockSingle = vi.fn();
const mockUpdateUser = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/rbac", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { updateUser: mockUpdateUser },
    from: () => ({
      select: () => ({ eq: () => ({ single: mockSingle }) }),
      update: () => ({ eq: () => mockUpdate() }),
    }),
  }),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), api: vi.fn() },
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/auth/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ user: { id: "u1", role: "super_admin" }, error: null });
  });

  it("returns the current user profile", async () => {
    mockSingle.mockResolvedValue({
      data: { id: "u1", email: "m@nrl.co", full_name: "Mara", role: "super_admin", is_active: true, department_id: "d1", departments: { id: "d1", name: "Operations" } },
      error: null,
    });

    const { GET } = await import("./route");
    const res = await GET(new NextRequest("http://localhost/api/auth/me"));

    expect(res.status).toBe(200);
    const body = await res.json() as { data: { email: string; role: string } };
    expect(body.data.email).toBe("m@nrl.co");
    expect(body.data.role).toBe("super_admin");
  });

  it("returns 500 when DB query fails", async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: "DB error" } });

    const { GET } = await import("./route");
    const res = await GET(new NextRequest("http://localhost/api/auth/me"));
    expect(res.status).toBe(500);
  });
});

describe("PATCH /api/auth/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ user: { id: "u1", role: "employee" }, error: null });
  });

  it("updates fullName successfully", async () => {
    mockUpdate.mockResolvedValue({ error: null });

    const { PATCH } = await import("./route");
    const req = new NextRequest("http://localhost/api/auth/me", {
      method: "PATCH",
      body: JSON.stringify({ fullName: "Updated Name" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
  });

  it("returns 400 when password is fewer than 8 characters", async () => {
    const { PATCH } = await import("./route");
    const req = new NextRequest("http://localhost/api/auth/me", {
      method: "PATCH",
      body: JSON.stringify({ password: "short" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when fullName is an empty string", async () => {
    const { PATCH } = await import("./route");
    const req = new NextRequest("http://localhost/api/auth/me", {
      method: "PATCH",
      body: JSON.stringify({ fullName: "   " }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });
});
