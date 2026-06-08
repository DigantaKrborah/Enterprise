import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { forbidden, notFound } from "@/lib/errors";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const start = Date.now();
  const { user, error } = await requireAuth(request);
  if (error) return error;

  const supabase = createClient();

  // Get the target doc first to find root of version chain
  const { data: doc } = await supabase
    .from("documents")
    .select("id, parent_id, department_id, original_name")
    .eq("id", params.id)
    .single();

  if (!doc) return notFound("Document");

  if (user!.role !== "super_admin" && doc.department_id !== user!.departmentId) {
    return forbidden();
  }

  // Find all versions with the same original_name in the same department
  const { data: versions } = await supabase
    .from("documents")
    .select(`
      id, version, status, size_bytes, page_count, created_at,
      users!documents_uploaded_by_fkey(full_name, email)
    `)
    .eq("department_id", doc.department_id)
    .eq("original_name", doc.original_name)
    .eq("is_deleted", false)
    .order("version", { ascending: false });

  logger.api({ method: "GET", endpoint: `/api/documents/${params.id}/versions`, statusCode: 200,
    latencyMs: Date.now() - start, userId: user!.id });

  return NextResponse.json({ data: versions ?? [] });
}

export async function generateStaticParams() { return []; }
