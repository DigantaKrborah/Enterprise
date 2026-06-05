import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { logger } from "@/lib/logger";
import { auditLog } from "@/lib/audit";
import { getAuthUser } from "@/lib/rbac";

export async function POST(request: NextRequest) {
  const start = Date.now();
  const user = await getAuthUser(request);

  let response = NextResponse.json({ ok: true });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          response = NextResponse.json({ ok: true });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.signOut();

  if (user) {
    auditLog({ userId: user.id, action: "logout" });
    logger.info("auth", "User signed out", { userId: user.id }, user.id);
  }

  logger.api({
    method: "POST",
    endpoint: "/api/auth/logout",
    statusCode: 200,
    latencyMs: Date.now() - start,
    userId: user?.id,
  });

  return response;
}
