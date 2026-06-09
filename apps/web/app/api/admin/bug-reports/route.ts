export const revalidate = 0;
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { auditLog } from "@/lib/audit";
import { badRequest, serverError } from "@/lib/errors";

const GITHUB_API = "https://api.github.com";

function githubHeaders(): HeadersInit {
  return {
    Authorization: "Bearer " + process.env.GITHUB_TOKEN,
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "Enterprise-RAG-Platform",
  };
}

interface GitHubLabel {
  name: string;
}

interface GitHubUser {
  login: string;
}

interface GitHubIssue {
  number: number;
  title: string;
  state: string;
  labels: GitHubLabel[];
  html_url: string;
  user: GitHubUser;
  created_at: string;
}

interface GitHubCreatedIssue {
  number: number;
  html_url: string;
}

export async function GET(request: NextRequest) {
  const start = Date.now();
  const { user, error } = await requireAuth(request, "super_admin");
  if (error) return error;

  if (!process.env.GITHUB_TOKEN) {
    return NextResponse.json({ data: [] });
  }

  const res = await fetch(
    `${GITHUB_API}/repos/${process.env.GITHUB_REPO}/issues?state=all&per_page=30&labels=bug`,
    { headers: githubHeaders() }
  );

  if (!res.ok) {
    logger.error("api", "GitHub issues fetch failed", { status: res.status });
    return serverError();
  }

  const issues = (await res.json()) as GitHubIssue[];

  logger.api({
    method: "GET",
    endpoint: "/api/admin/bug-reports",
    statusCode: 200,
    latencyMs: Date.now() - start,
    userId: user!.id,
  });

  return NextResponse.json({
    data: issues.map((i) => ({
      number: i.number,
      title: i.title,
      state: i.state,
      labels: i.labels,
      html_url: i.html_url,
      user: i.user,
      created_at: i.created_at,
    })),
  });
}

export async function POST(request: NextRequest) {
  const start = Date.now();
  const { user, error } = await requireAuth(request, "super_admin");
  if (error) return error;

  const body = (await request.json()) as { title?: string; body?: string; severity?: string };

  if (!body.title?.trim()) {
    return badRequest("title is required");
  }

  if (!process.env.GITHUB_TOKEN) {
    return serverError();
  }

  const labels = ["bug", (body.severity ?? "medium").toLowerCase()];

  const res = await fetch(`${GITHUB_API}/repos/${process.env.GITHUB_REPO}/issues`, {
    method: "POST",
    headers: { ...githubHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ title: body.title, body: body.body ?? "", labels }),
  });

  if (!res.ok) {
    logger.error("api", "GitHub issue creation failed", { status: res.status });
    return serverError();
  }

  const issue = (await res.json()) as GitHubCreatedIssue;

  auditLog({
    userId: user!.id,
    action: "create_bug_report",
    metadata: { title: body.title },
  });

  logger.api({
    method: "POST",
    endpoint: "/api/admin/bug-reports",
    statusCode: 201,
    latencyMs: Date.now() - start,
    userId: user!.id,
  });

  return NextResponse.json(
    { ok: true, issueUrl: issue.html_url, issueNumber: issue.number },
    { status: 201 }
  );
}
