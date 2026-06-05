import { createClient } from "@supabase/supabase-js";

// Service-role client — only for server-side admin operations.
// Never expose to the browser.
let _admin: ReturnType<typeof createClient> | null = null;

export function getAdminClient() {
  if (!_admin) {
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return _admin;
}
