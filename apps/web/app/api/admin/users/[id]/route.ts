export const revalidate = 0;
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import type { Role } from "@/lib/rbac";
import { getAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { auditLog } from "@/lib/audit";
import { badRequest, serverError } from "@/lib/errors";

const VALID_ROLES: Role[] = ["super_admin", "dept_admin", "manager", "employee", "read_only"];

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const start = Date.now();
  const { user, error } = await requireAuth(request, "super_admin");
  if (error) return error;

  const body = await request.json() as { isActive?: boolean; role?: Role };
  const { isActive, role } = body;

  if (role !== undefined && !VALID_ROLES.includes(role)) return badRequest("Invalid role");
  if (user!.id === params.id) return badRequest("Cannot modify your own account");

  const patch: Record<string, unknown> = {};
  if (isActive !== undefined) patch.is_active = isActive;
  if (role !== undefined) patch.role = role;

  const admin = getAdminClient();
  const { error: updateErr } = await admin.from("users").update(patch).eq("id", params.id);
  if (updateErr) {
    logger.error("api", "User update failed", { error: updateErr.message }, user!.id);
    return serverError();
  }

  auditLog({ userId: user!.id, action: "update_user", resourceType: "user", resourceId: params.id, metadata: { isActive, role } });
  logger.api({ method: "PATCH", endpoint: `/api/admin/users/${params.id}`, statusCode: 200, latencyMs: Date.now() - start, userId: user!.id });

  return NextResponse.json({ ok: true });
}

