import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { forbidden, unauthorized } from "./errors";

export type Role = "super_admin" | "dept_admin" | "manager" | "employee" | "read_only";

const ROLE_RANK: Record<Role, number> = {
  super_admin: 5,
  dept_admin:  4,
  manager:     3,
  employee:    2,
  read_only:   1,
};

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  departmentId: string | null;
  fullName: string | null;
  isActive: boolean;
}

export function hasRole(userRole: Role, required: Role): boolean {
  return ROLE_RANK[userRole] >= ROLE_RANK[required];
}

// Extracts the authenticated user from the request cookies.
// Returns null if the session is missing or invalid.
export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {}, // read-only in API routes — middleware handles refresh
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("id, email, full_name, role, department_id, is_active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.is_active) return null;

  return {
    id: profile.id,
    email: profile.email,
    role: profile.role as Role,
    departmentId: profile.department_id,
    fullName: profile.full_name,
    isActive: profile.is_active,
  };
}

// Convenience: resolve auth user + enforce minimum role in one call.
// Returns the user on success, or a NextResponse error to return immediately.
export async function requireAuth(request: NextRequest, minRole?: Role) {
  const user = await getAuthUser(request);
  if (!user) return { user: null, error: unauthorized() };
  if (minRole && !hasRole(user.role, minRole)) return { user: null, error: forbidden() };
  return { user, error: null };
}
