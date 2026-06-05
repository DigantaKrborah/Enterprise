import { getAdminClient } from "./supabase/admin";

type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

type Service =
  | "api"
  | "auth"
  | "ingest_agent"
  | "rag_agent"
  | "sentiment_agent"
  | "log_monitor_agent"
  | "llm_router"
  | "ocr"
  | "chunker"
  | "embedder"
  | "search";

interface LogEntry {
  level: LogLevel;
  service: Service;
  message: string;
  metadata?: Record<string, unknown>;
  user_id?: string;
}

export interface LLMLogData {
  userId: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  cacheHit: boolean;
  endpoint?: string;
}

export interface APILogData {
  userId?: string;
  method: string;
  endpoint: string;
  statusCode: number;
  latencyMs: number;
  ip?: string;
}

export interface AgentLogData {
  userId?: string;
  agentName: Service;
  inputSummary: string;
  outputSummary: string;
  durationMs: number;
  success: boolean;
  error?: string;
}

export interface IngestLogData {
  userId?: string;
  documentId: string;
  step: string;
  durationMs: number;
  success: boolean;
  detail?: string;
}

function formatForConsole(entry: LogEntry): string {
  const ts = new Date().toISOString();
  const meta = entry.metadata ? ` ${JSON.stringify(entry.metadata)}` : "";
  return `[${ts}] [${entry.level}] [${entry.service}] ${entry.message}${meta}`;
}

// Writes to Supabase logs table asynchronously — never blocks a request.
function persistToDb(entry: LogEntry): void {
  const admin = getAdminClient();
  admin
    .from("logs")
    .insert({
      level: entry.level,
      service: entry.service,
      message: entry.message,
      metadata: entry.metadata ?? null,
      user_id: entry.user_id ?? null,
    })
    .then()
    .catch(() => {
      // Silently suppress — logging must never crash the app
      console.error("[logger] Failed to persist log to DB");
    });
}

function log(level: LogLevel, service: Service, message: string, metadata?: Record<string, unknown>, userId?: string): void {
  const entry: LogEntry = { level, service, message, metadata, user_id: userId };

  if (process.env.NODE_ENV === "development") {
    const fn = level === "ERROR" ? console.error : level === "WARN" ? console.warn : console.log;
    fn(formatForConsole(entry));
  } else {
    console.log(JSON.stringify({ ...entry, ts: new Date().toISOString() }));
  }

  // Skip DB writes in test environment to keep tests fast
  if (process.env.NODE_ENV !== "test") {
    persistToDb(entry);
  }
}

export const logger = {
  info:  (service: Service, message: string, meta?: Record<string, unknown>, userId?: string) => log("INFO",  service, message, meta, userId),
  warn:  (service: Service, message: string, meta?: Record<string, unknown>, userId?: string) => log("WARN",  service, message, meta, userId),
  error: (service: Service, message: string, meta?: Record<string, unknown>, userId?: string) => log("ERROR", service, message, meta, userId),
  debug: (service: Service, message: string, meta?: Record<string, unknown>, userId?: string) => log("DEBUG", service, message, meta, userId),

  llm(data: LLMLogData): void {
    log("INFO", "llm_router", `LLM call completed`, {
      model:             data.model,
      prompt_tokens:     data.promptTokens,
      completion_tokens: data.completionTokens,
      total_tokens:      data.promptTokens + data.completionTokens,
      latency_ms:        data.latencyMs,
      cache_hit:         data.cacheHit,
      endpoint:          data.endpoint,
    }, data.userId);
  },

  api(data: APILogData): void {
    const level: LogLevel = data.statusCode >= 500 ? "ERROR" : data.statusCode >= 400 ? "WARN" : "INFO";
    log(level, "api", `${data.method} ${data.endpoint} → ${data.statusCode}`, {
      status_code: data.statusCode,
      latency_ms:  data.latencyMs,
      ip:          data.ip,
    }, data.userId);
  },

  agent(data: AgentLogData): void {
    const level: LogLevel = data.success ? "INFO" : "ERROR";
    log(level, data.agentName, data.success ? "Agent run completed" : "Agent run failed", {
      input_summary:  data.inputSummary,
      output_summary: data.outputSummary,
      duration_ms:    data.durationMs,
      success:        data.success,
      error:          data.error,
    }, data.userId);
  },

  ingest(data: IngestLogData): void {
    const level: LogLevel = data.success ? "INFO" : "ERROR";
    log(level, "ingest_agent", `Ingest step: ${data.step}`, {
      document_id: data.documentId,
      step:        data.step,
      duration_ms: data.durationMs,
      success:     data.success,
      detail:      data.detail,
    }, data.userId);
  },
};
