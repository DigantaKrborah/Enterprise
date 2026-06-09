export const revalidate = 0;
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { badRequest, serverError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  const start = Date.now();
  const { user, error } = await requireAuth(request);
  if (error) return error;

  const supabase = createClient();
  const { data: profile, error: dbErr } = await supabase
    .from("users")
    .select("id, email, full_name, role, is_active, department_id, departments(id, name)")
    .eq("id", user!.id)
    .single();

  if (dbErr) {
    logger.error("auth", "Failed to fetch user profile", { error: dbErr.message }, user!.id);
    return serverError("Failed to load profile");
  }

  logger.api({ method: "GET", endpoint: "/api/auth/me", statusCode: 200, latencyMs: Date.now() - start, userId: user!.id });

  return NextResponse.json({ data: profile });
}

export async function PATCH(request: NextRequest) {
  const start = Date.now();
  const { user, error } = await requireAuth(request);
  if (error) return error;

  const body = await request.json() as { fullName?: string; password?: string };
  const supabase = createClient();
  const updates: Record<string, unknown> = {};

  if (body.fullName !== undefined) {
    if (typeof body.fullName !== "string" || body.fullName.trim().length === 0) {
      return badRequest("fullName must be a non-empty string");
    }
    updates.full_name = body.fullName.trim();
  }

  if (body.password !== undefined) {
    if (typeof body.password !== "string" || body.password.length < 8) {
      return badRequest("Password must be at least 8 characters");
    }
    const { error: pwErr } = await supabase.auth.updateUser({ password: body.password });
    if (pwErr) {
      logger.error("auth", "Password update failed", { error: pwErr.message }, user!.id);
      return serverError("Password update failed");
    }
  }

  if (Object.keys(updates).length > 0) {
    const { error: upErr } = await supabase.from("users").update(updates).eq("id", user!.id);
    if (upErr) {
      logger.error("auth", "Profile update failed", { error: upErr.message }, user!.id);
      return serverError("Profile update failed");
    }
  }

  logger.info("auth", "User updated profile", { fields: Object.keys(updates) }, user!.id);
  logger.api({ method: "PATCH", endpoint: "/api/auth/me", statusCode: 200, latencyMs: Date.now() - start, userId: user!.id });

  return NextResponse.json({ ok: true });
}
