import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { serverError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  const start = Date.now();
  const { user, error } = await requireAuth(request, "super_admin");
  if (error) return error;

  const supabase = createClient();

  const { data, error: dbErr } = await supabase
    .from("users")
    .select("id, email, full_name, role, department_id, is_active, created_at, departments(id, name)")
    .order("created_at", { ascending: false });

  if (dbErr) {
    logger.error("api", "Users list failed", { error: dbErr.message }, user!.id);
    return serverError();
  }

  logger.api({ method: "GET", endpoint: "/api/admin/users", statusCode: 200, latencyMs: Date.now() - start, userId: user!.id });

  return NextResponse.json({ data });
}
