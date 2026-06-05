import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ── Module-level mocks ────────────────────────────────────────────────────────

const mockRequireAuth = vi.fn();

vi.mock("@/lib/rbac", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

vi.mock("@/lib/audit", () => ({ auditLog: vi.fn() }));

vi.mock("@/lib/logger", () => ({
  logger: { api: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SUPER_ADMIN = { id: "admin-1", role: "super_admin" as const };

const GITHUB_ISSUE = {
  number: 42,
  title: "Test Bug",
  state: "open",
  labels: [{ name: "bug" }, { name: "high" }],
  html_url: "https://github.com/test/repo/issues/42",
  user: { login: "user1" },
  created_at: "2026-01-01T00:00:00Z",
};

const CREATED_ISSUE = {
  number: 43,
  title: "New Bug",
  state: "open",
  html_url: "https://github.com/test/repo/issues/43",
  user: { login: "user1" },
  created_at: "2026-01-01T00:00:00Z",
};

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  process.env.GITHUB_TOKEN = "test-token";
  process.env.GITHUB_REPO  = "test/repo";

  mockRequireAuth.mockResolvedValue({ user: SUPER_ADMIN, error: null });

  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      const method = init?.method?.toUpperCase() ?? "GET";

      if (method === "POST") {
        return Promise.resolve({
          ok:   true,
          json: () => Promise.resolve(CREATED_ISSUE),
        } as Response);
      }

      // GET
      return Promise.resolve({
        ok:   true,
        json: () => Promise.resolve([GITHUB_ISSUE]),
      } as Response);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GITHUB_TOKEN;
  delete process.env.GITHUB_REPO;
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeGetReq() {
  return new NextRequest("http://localhost/api/admin/bug-reports");
}

function makePostReq(body: object) {
  return new NextRequest("http://localhost/api/admin/bug-reports", {
    method: "POST",
    body:    JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// ── GET /api/admin/bug-reports ────────────────────────────────────────────────

describe("GET /api/admin/bug-reports", () => {
  it("returns 403 when non-admin calls the route", async () => {
    const forbidden = new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    mockRequireAuth.mockResolvedValue({ user: null, error: forbidden });

    const { GET } = await import("./route");
    const res = await GET(makeGetReq());
    expect(res.status).toBe(403);
  });

  it("returns 200 with issues array", async () => {
    const { GET } = await import("./route");
    const res = await GET(makeGetReq());

    expect(res.status).toBe(200);
    const body = await res.json() as { data: typeof GITHUB_ISSUE[] };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data[0].number).toBe(42);
    expect(body.data[0].title).toBe("Test Bug");
  });

  it("returns empty array when GITHUB_TOKEN is not set", async () => {
    delete process.env.GITHUB_TOKEN;

    const { GET } = await import("./route");
    const res = await GET(makeGetReq());

    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[] };
    expect(body.data).toEqual([]);
  });
});

// ── POST /api/admin/bug-reports ───────────────────────────────────────────────

describe("POST /api/admin/bug-reports", () => {
  it("returns 201 when creating a valid issue", async () => {
    const { POST } = await import("./route");
    const res = await POST(makePostReq({ title: "New Bug", body: "Detailed description" }));

    expect(res.status).toBe(201);
    const json = await res.json() as { ok: boolean; issueNumber: number; issueUrl: string };
    expect(json.ok).toBe(true);
    expect(json.issueNumber).toBe(43);
  });

  it("returns 400 when title is missing", async () => {
    const { POST } = await import("./route");
    const res = await POST(makePostReq({ body: "No title provided" }));
    expect(res.status).toBe(400);
  });
});
