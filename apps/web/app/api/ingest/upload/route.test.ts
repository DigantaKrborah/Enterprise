import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Module-level mocks ────────────────────────────────────────────────────────

const mockRequireAuth  = vi.fn();
const mockUploadLimit  = vi.fn();
const mockStorageUpload = vi.fn();
const mockDbInsert     = vi.fn();
const mockDbSelect     = vi.fn();

vi.mock("@/lib/rbac",          () => ({ requireAuth: (...a: unknown[]) => mockRequireAuth(...a) }));
vi.mock("@/lib/rate-limit",    () => ({ uploadRateLimit: (...a: unknown[]) => mockUploadLimit(...a) }));
vi.mock("@/lib/logger",        () => ({ logger: { info: vi.fn(), error: vi.fn(), api: vi.fn(), warn: vi.fn() } }));
vi.mock("@/lib/audit",         () => ({ auditLog: vi.fn() }));
vi.mock("@/lib/agents/ingest-agent", () => ({ runIngestAgent: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/extractor",     () => ({ resolveFileType: vi.fn().mockReturnValue("pdf") }));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: () => ({
    from: (table: string) => {
      if (table === "documents") return {
        // Chains: .select().eq(dept).eq(name).eq(deleted).order().limit().maybeSingle()
        select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: mockDbSelect }) }) }) }) }) }),
        insert: mockDbInsert,
      };
      return { select: vi.fn(), insert: vi.fn() };
    },
    storage: { from: () => ({ upload: mockStorageUpload, remove: vi.fn().mockResolvedValue({}) }) },
  }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeUploadReq(fileType = "application/pdf", size = 1000) {
  const file = new File(["a".repeat(size)], "test.pdf", { type: fileType });
  const form = new FormData();
  form.append("file", file);
  form.append("departmentId", "dept-1");
  return new NextRequest("http://localhost/api/ingest/upload", { method: "POST", body: form });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/ingest/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ user: { id: "u1", role: "employee", departmentId: "dept-1" }, error: null });
    mockUploadLimit.mockReturnValue(true);
    mockDbSelect.mockResolvedValue({ data: null });              // no existing version
    mockStorageUpload.mockResolvedValue({ error: null });
    mockDbInsert.mockResolvedValue({ error: null });
  });

  it("returns 201 on a valid PDF upload", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeUploadReq());
    expect(res.status).toBe(201);
    const body = await res.json() as { ok: boolean; status: string };
    expect(body.ok).toBe(true);
    expect(body.status).toBe("queued");
  });

  it("returns 429 when rate limit is exceeded", async () => {
    mockUploadLimit.mockReturnValue(false);
    const { POST } = await import("./route");
    const res = await POST(makeUploadReq());
    expect(res.status).toBe(429);
  });

  it("returns 400 for unsupported MIME type", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeUploadReq("text/plain"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when file exceeds 50 MB", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeUploadReq("application/pdf", 60_000_000));
    expect(res.status).toBe(400);
  });

  it("returns 500 when storage upload fails", async () => {
    mockStorageUpload.mockResolvedValue({ error: { message: "storage error" } });
    const { POST } = await import("./route");
    const res = await POST(makeUploadReq());
    expect(res.status).toBe(500);
  });

  it("increments version when same filename exists in dept", async () => {
    mockDbSelect.mockResolvedValue({ data: { id: "old-doc", version: 2 } });
    const { POST } = await import("./route");
    const res = await POST(makeUploadReq());
    expect(res.status).toBe(201);
    const body = await res.json() as { version: number };
    expect(body.version).toBe(3);
  });
});
