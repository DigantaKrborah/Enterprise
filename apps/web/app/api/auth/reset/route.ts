import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { logger } from "@/lib/logger";
import { badRequest } from "@/lib/errors";
import { authRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const start = Date.now();
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";

  if (!authRateLimit(ip)) {
    logger.warn("auth", "Rate limit hit on password reset", { ip });
    return NextResponse.json({ ok: true }); // Silent — don't reveal rate limit to attacker
  }

  const body = await request.json() as { email?: string };
  if (!body.email || typeof body.email !== "string") return badRequest("email is required");

  const email = body.email.trim().toLowerCase();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} } }
  );

  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm?type=recovery&next=/update-password`;
  await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  // Always return 200 — don't reveal whether the email exists
  logger.info("auth", "Password reset requested", { email: email.replace(/(.{2}).*@/, "$1***@") });
  logger.api({ method: "POST", endpoint: "/api/auth/reset", statusCode: 200, latencyMs: Date.now() - start, ip });

  return NextResponse.json({ ok: true });
}
