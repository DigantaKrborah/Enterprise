import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Module-level mocks ────────────────────────────────────────────────────────

const mockRequireAuth   = vi.fn();
const mockContainsPII   = vi.fn();
const mockScanAndMask   = vi.fn();
// chatRateLimit(userId) → boolean (true = allowed, false = rate limited)
const mockChatRateLimit = vi.fn();
const mockStreamOllama  = vi.fn();
const mockStreamClaude  = vi.fn();

vi.mock("@/lib/rbac", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

vi.mock("@/lib/pii", () => ({
  containsPII:   (...args: unknown[]) => mockContainsPII(...args),
  scanAndMaskPII: (...args: unknown[]) => mockScanAndMask(...args),
}));

// The real chatRateLimit returns a boolean — mock mirrors that signature.
vi.mock("@/lib/rate-limit", () => ({
  chatRateLimit: (...args: unknown[]) => mockChatRateLimit(...args),
}));

vi.mock("@/lib/llm/ollama", () => ({
  streamOllamaChat: (...args: unknown[]) => mockStreamOllama(...args),
}));

vi.mock("@/lib/llm/claude", () => ({
  streamClaudeChat: (...args: unknown[]) => mockStreamClaude(...args),
}));

vi.mock("@/lib/audit", () => ({ auditLog: vi.fn() }));

vi.mock("@/lib/logger", () => ({
  logger: { api: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const EMPLOYEE = { id: "user-1", role: "employee" as const, departmentId: "dept-1" };

const SENTIMENT_JSON =
  '{"sentiment":"Positive","tone":"Upbeat and clear","confidence":0.9,' +
  '"summary":"The text expresses a positive, clear message.",' +
  '"scores":[{"label":"Frustration","value":0.1,"color":"var(--red)"},' +
  '{"label":"Urgency","value":0.2,"color":"var(--amber)"},' +
  '{"label":"Constructiveness","value":0.8,"color":"var(--green)"}],' +
  '"entities":[]}';

// Shared LLM mock: calls onChunk with valid JSON then resolves
function makeLLMImpl() {
  return vi.fn(async (opts: { onChunk: (text: string) => void }) => {
    opts.onChunk(SENTIMENT_JSON);
    return { inputTokens: 10, outputTokens: 50, durationMs: 200 };
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  mockRequireAuth.mockResolvedValue({ user: EMPLOYEE, error: null });
  mockContainsPII.mockReturnValue(false);
  mockScanAndMask.mockReturnValue({ maskedText: "test text", hasPII: false, detectedTypes: [] });
  // chatRateLimit returns true when the request is allowed
  mockChatRateLimit.mockReturnValue(true);

  mockStreamOllama.mockImplementation(makeLLMImpl());
  mockStreamClaude.mockImplementation(makeLLMImpl());
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(body: object) {
  return new NextRequest("http://localhost/api/sentiment", {
    method:  "POST",
    body:    JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// ── POST /api/sentiment ───────────────────────────────────────────────────────

describe("POST /api/sentiment", () => {
  it("returns 400 when text is missing from body", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when text is empty string", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeReq({ text: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 429 when rate limited", async () => {
    mockChatRateLimit.mockReturnValue(false);

    const { POST } = await import("./route");
    const res = await POST(makeReq({ text: "Some valid text" }));
    expect(res.status).toBe(429);
  });

  it("returns 200 with parsed sentiment result for valid text", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeReq({ text: "This is a great day at the refinery." }));

    expect(res.status).toBe(200);
    // Route returns { data: SentimentResult }
    const body = await res.json() as { data: { sentiment: string; confidence: number } };
    expect(body.data.sentiment).toBe("Positive");
    expect(body.data.confidence).toBe(0.9);
  });

  it("routes to Ollama when PII is detected", async () => {
    mockContainsPII.mockReturnValue(true);
    mockScanAndMask.mockReturnValue({ maskedText: "[EMAIL] works here", hasPII: true, detectedTypes: ["email"] });

    const { POST } = await import("./route");
    const res = await POST(makeReq({ text: "Contact john@example.com for details." }));

    expect(res.status).toBe(200);
    expect(mockStreamOllama).toHaveBeenCalled();
    expect(mockStreamClaude).not.toHaveBeenCalled();
  });
});
