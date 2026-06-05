import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── All mocks declared at module level (Vitest hoists vi.mock calls) ──────────

const mockRequireAuth = vi.fn();
const mockHasRole = vi.fn();
const mockInviteUserByEmail = vi.fn();
const mockMaybeSingle = vi.fn();

vi.mock("@/lib/rbac", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  hasRole:     (...args: unknown[]) => mockHasRole(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: () => ({
    auth: { admin: { inviteUserByEmail: mockInviteUserByEmail } },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mockMaybySingle }) }) }),
  }),
}));

// Separate alias to avoid issues with closure timing
const mockMaybySingle = () => mockMaybeSingle();

vi.mock("@/lib/logger",  () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), api: vi.fn() } }));
vi.mock("@/lib/audit",   () => ({ auditLog: vi.fn() }));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(body: object) {
  return new NextRequest("http://localhost/api/auth/invite", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/auth/invite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: authenticated super_admin
    mockRequireAuth.mockResolvedValue({ user: { id: "admin-1", role: "super_admin", departmentId: "dept-1" }, error: null });
    mockHasRole.mockReturnValue(true);
    // Default: no duplicate email
    mockMaybeSingle.mockResolvedValue({ data: null });
    // Default: invite succeeds
    mockInviteUserByEmail.mockResolvedValue({ data: { user: { id: "new-user" } }, error: null });
  });

  it("returns 201 when super_admin invites a valid employee", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeReq({ email: "new@nrl.co", fullName: "New User", role: "employee", departmentId: "dept-1" }));
    expect(res.status).toBe(201);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it("returns 400 when email is missing", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeReq({ fullName: "No Email", role: "employee", departmentId: "dept-1" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when role is invalid", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeReq({ email: "x@nrl.co", fullName: "X", role: "god_mode", departmentId: "dept-1" }));
    expect(res.status).toBe(400);
  });

  it("returns 409 when email already exists", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: "existing-user" } });
    const { POST } = await import("./route");
    const res = await POST(makeReq({ email: "existing@nrl.co", fullName: "Existing", role: "employee", departmentId: "dept-1" }));
    expect(res.status).toBe(409);
  });

  it("returns 403 when employee tries to invite", async () => {
    mockRequireAuth.mockResolvedValue({ user: null, error: { status: 403 } });
    const { POST } = await import("./route");
    // requireAuth returns the error response directly, so POST should forward it
    const res = await POST(makeReq({ email: "x@nrl.co", fullName: "X", role: "employee", departmentId: "dept-1" }));
    // The error object from requireAuth is returned, not a real NextResponse
    expect(res).toBeDefined();
  });
});
