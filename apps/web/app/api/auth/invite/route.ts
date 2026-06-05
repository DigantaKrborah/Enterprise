import { NextRequest, NextResponse } from "next/server";
import { requireAuth, hasRole, type Role } from "@/lib/rbac";
import { getAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { auditLog } from "@/lib/audit";
import { badRequest, serverError, conflict } from "@/lib/errors";

const VALID_ROLES: Role[] = ["super_admin", "dept_admin", "manager", "employee", "read_only"];

export async function POST(request: NextRequest) {
  const start = Date.now();

  // Only dept_admin and above can invite
  const { user, error } = await requireAuth(request, "dept_admin");
  if (error) return error;

  const body = await request.json() as {
    email?: string;
    fullName?: string;
    role?: string;
    departmentId?: string;
  };

  // Validate required fields
  if (!body.email || typeof body.email !== "string") return badRequest("email is required");
  if (!body.fullName || typeof body.fullName !== "string") return badRequest("fullName is required");
  if (!body.role || !VALID_ROLES.includes(body.role as Role)) return badRequest(`role must be one of: ${VALID_ROLES.join(", ")}`);

  const inviteRole = body.role as Role;

  // dept_admin can only invite roles below their own
  if (!hasRole(user!.role, inviteRole) && user!.role !== "super_admin") {
    return badRequest("You cannot invite a user with a higher role than your own");
  }

  // dept_admin can only invite into their own department
  const departmentId = user!.role === "super_admin"
    ? (body.departmentId ?? null)
    : user!.departmentId;

  if (!departmentId) return badRequest("departmentId is required");

  const admin = getAdminClient();

  // Check for existing user with this email
  const { data: existing } = await admin.from("users").select("id").eq("email", body.email.trim().toLowerCase()).maybeSingle();
  if (existing) return conflict("A user with this email already exists");

  logger.info("auth", "Sending user invite", {
    invitedEmail: body.email,
    inviteRole,
    departmentId,
    invitedBy: user!.id,
  }, user!.id);

  const { data, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
    body.email.trim().toLowerCase(),
    {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm?type=invite&next=/`,
      data: {
        full_name:     body.fullName.trim(),
        role:          inviteRole,
        department_id: departmentId,
      },
    }
  );

  if (inviteErr) {
    logger.error("auth", "Failed to send invite", { error: inviteErr.message }, user!.id);
    return serverError("Failed to send invitation");
  }

  auditLog({
    userId: user!.id,
    action: "invite_user",
    resourceType: "user",
    resourceId: data.user?.id,
    metadata: { invitedEmail: body.email, role: inviteRole, departmentId },
  });

  logger.api({ method: "POST", endpoint: "/api/auth/invite", statusCode: 201, latencyMs: Date.now() - start, userId: user!.id });

  return NextResponse.json({ ok: true, invitedEmail: body.email }, { status: 201 });
}
