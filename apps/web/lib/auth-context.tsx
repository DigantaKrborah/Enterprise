"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "./supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Role } from "./rbac";

export interface UserProfile {
  id: string;
  email: string;
  fullName: string | null;
  role: Role;
  departmentId: string | null;
  departmentName: string | null;
  isActive: boolean;
}

interface AuthContextValue {
  profile: UserProfile | null;
  loading: boolean;
  supabase: SupabaseClient;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  async function fetchProfile(userId: string): Promise<void> {
    const { data, error } = await supabase
      .from("users")
      .select("id, email, full_name, role, is_active, department_id, departments(id, name)")
      .eq("id", userId)
      .single();

    if (error || !data) {
      setProfile(null);
    } else {
      const dept = Array.isArray(data.departments) ? data.departments[0] : data.departments;
      setProfile({
        id:             data.id,
        email:          data.email,
        fullName:       data.full_name,
        role:           data.role as Role,
        departmentId:   data.department_id,
        departmentName: dept?.name ?? null,
        isActive:       data.is_active,
      });
    }
    setLoading(false);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        fetchProfile(user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider value={{ profile, loading, supabase }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
