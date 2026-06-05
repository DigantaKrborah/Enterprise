import { AppShell } from "@/components/app-shell";

// Middleware protects this route — unauthenticated users are redirected to /login
export default function Home() {
  return <AppShell />;
}
