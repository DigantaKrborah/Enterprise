export const revalidate = 0;
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { badRequest, serverError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  const start = Date.now();
  const { user, error } = await requireAuth(request);
  if (error) return error;

  const supabase = createClient();
  const { data, error: dbErr } = await supabase
    .from("conversations")
    .select("id, title, department_filter, created_at, updated_at")
    .eq("user_id", user!.id)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (dbErr) {
    logger.error("api", "Conversations list failed", { error: dbErr.message }, user!.id);
    return serverError();
  }

  logger.api({ method: "GET", endpoint: "/api/chat/conversations", statusCode: 200,
    latencyMs: Date.now() - start, userId: user!.id });

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const start = Date.now();
  const { user, error } = await requireAuth(request);
  if (error) return error;

  const body = await request.json() as { title?: string; departmentFilter?: string };

  const admin = getAdminClient();
  const { data, error: dbErr } = await admin
    .from("conversations")
    .insert({
      user_id:           user!.id,
      title:             body.title?.slice(0, 100) ?? "New conversation",
      department_filter: body.departmentFilter ?? null,
    })
    .select("id, title, department_filter, created_at, updated_at")
    .single();

  if (dbErr) {
    logger.error("api", "Conversation create failed", { error: dbErr.message }, user!.id);
    return serverError();
  }

  logger.api({ method: "POST", endpoint: "/api/chat/conversations", statusCode: 201,
    latencyMs: Date.now() - start, userId: user!.id });

  return NextResponse.json({ data }, { status: 201 });
}
