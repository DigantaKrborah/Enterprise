import { getAdminClient } from "./supabase/admin";

interface AuditEntry {
  userId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}

// Fire-and-forget — never block a request on audit writes
export function auditLog(entry: AuditEntry): void {
  getAdminClient()
    .from("audit_log")
    .insert({
      user_id:       entry.userId ?? null,
      action:        entry.action,
      resource_type: entry.resourceType ?? null,
      resource_id:   entry.resourceId ?? null,
      ip_address:    entry.ipAddress ?? null,
      metadata:      entry.metadata ?? null,
    })
    .then()
    .catch(() => {
      console.error("[audit] Failed to write audit log entry");
    });
}
