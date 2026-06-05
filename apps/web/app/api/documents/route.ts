import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { serverError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  const start = Date.now();
  const { user, error } = await requireAuth(request);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const dept   = searchParams.get("dept");
  const type   = searchParams.get("type");
  const status = searchParams.get("status");
  const q      = searchParams.get("q");

  const supabase = createClient();

  let query = supabase
    .from("documents")
    .select(`
      id, name, original_name, department_id, file_type, version, status,
      error_msg, size_bytes, page_count, created_at, is_deleted, parent_id,
      uploaded_by,
      departments!inner(id, name),
      users!documents_uploaded_by_fkey(id, full_name, email)
    `)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false });

  // super_admin sees all; others see only their dept
  if (user!.role !== "super_admin") {
    query = query.eq("department_id", user!.departmentId!);
  } else if (dept) {
    query = query.eq("department_id", dept);
  }

  if (type)   query = query.eq("file_type", type);
  if (status) query = query.eq("status", status);
  if (q)      query = query.ilike("name", `%${q}%`);

  const { data, error: dbErr } = await query;

  if (dbErr) {
    logger.error("api", "Documents list failed", { error: dbErr.message }, user!.id);
    return serverError();
  }

  logger.api({ method: "GET", endpoint: "/api/documents", statusCode: 200,
    latencyMs: Date.now() - start, userId: user!.id });

  return NextResponse.json({ data });
}
