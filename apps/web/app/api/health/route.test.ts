import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock external dependencies so the health check is fast and deterministic
vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: () => ({
    from: () => ({ select: () => ({ limit: () => Promise.resolve({ error: null }) }) }),
  }),
}));

vi.mock("@/lib/logger", () => ({
  logger: { api: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

// Mock fetch for ES and Ollama
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    if (url.includes("_cluster/health")) {
      return Promise.resolve({ json: () => Promise.resolve({ status: "green" }) });
    }
    if (url.includes("/api/tags")) {
      return Promise.resolve({ ok: true });
    }
    return Promise.reject(new Error("unexpected fetch"));
  }));
});

describe("GET /api/health", () => {
  it("returns 200 with ok:true when all services are healthy", async () => {
    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json() as { ok: boolean; checks: Record<string, { ok: boolean }> };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.checks.supabase.ok).toBe(true);
    expect(body.checks.elasticsearch.ok).toBe(true);
    expect(body.checks.ollama.ok).toBe(true);
  });

  it("returns 503 when Elasticsearch is red", async () => {
    vi.mocked(fetch).mockImplementation((url: RequestInfo | URL) => {
      const u = url.toString();
      if (u.includes("_cluster/health")) {
        return Promise.resolve({ json: () => Promise.resolve({ status: "red" }) } as Response);
      }
      return Promise.resolve({ ok: true } as Response);
    });

    // Re-import to get fresh module (clear module cache in vitest)
    vi.resetModules();
    vi.mock("@/lib/supabase/admin", () => ({
      getAdminClient: () => ({
        from: () => ({ select: () => ({ limit: () => Promise.resolve({ error: null }) }) }),
      }),
    }));
    vi.mock("@/lib/logger", () => ({
      logger: { api: vi.fn(), info: vi.fn(), error: vi.fn() },
    }));

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json() as { ok: boolean };

    expect(response.status).toBe(503);
    expect(body.ok).toBe(false);
  });
});
