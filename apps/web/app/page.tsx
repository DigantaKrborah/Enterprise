"use client";

import { useAuth } from "@/lib/auth-context";
import { LoginPage } from "@/components/login";
import { AppShell } from "@/components/app-shell";

export default function Home() {
  const { authed } = useAuth();
  if (!authed) return <LoginPage />;
  return <AppShell />;
}
