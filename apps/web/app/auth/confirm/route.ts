import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { logger } from "@/lib/logger";

// Handles Supabase email confirmation callbacks:
// - type=invite  → user accepted invitation
// - type=recovery → user clicked password reset link
// - type=email   → user confirmed email change
//
// Supabase redirects here with ?token_hash=...&type=...&next=...
// Configure in Supabase Dashboard → Auth → URL Configuration:
//   Site URL: http://localhost:3000
//   Redirect URL: http://localhost:3000/auth/confirm
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as "invite" | "recovery" | "email" | null;
  const next = searchParams.get("next") ?? "/";

  if (!tokenHash || !type) {
    logger.warn("auth", "Auth confirm called with missing params", { tokenHash: !!tokenHash, type });
    return NextResponse.redirect(`${origin}/login?error=invalid_link`);
  }

  const cookieStore = cookies();
  let response = NextResponse.redirect(`${origin}${next}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          response = NextResponse.redirect(`${origin}${next}`);
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

  if (error) {
    logger.warn("auth", "Token verification failed", { error: error.message, type });
    return NextResponse.redirect(`${origin}/login?error=invalid_or_expired_link`);
  }

  logger.info("auth", "Email confirmation successful", { type });
  return response;
}
