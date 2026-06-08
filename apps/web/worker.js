// Cloudflare Pages Advanced Mode worker.
// Handles document API routes; proxies everything else to static assets.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === "/api/ingest/upload" && request.method === "POST") {
        return await handleUpload(request, env);
      }
      if (path === "/api/documents" && request.method === "GET") {
        return await handleDocumentsList(request, env);
      }
      // DELETE /api/documents/:id
      const deleteMatch = path.match(/^\/api\/documents\/([^/]+)$/);
      if (deleteMatch && request.method === "DELETE") {
        return await handleDocumentDelete(request, env, deleteMatch[1]);
      }
    } catch (err) {
      return json({ error: { message: `Worker exception: ${String(err)}` } }, 500);
    }

    return env.ASSETS.fetch(request);
  },
};

// ── Shared helpers ────────────────────────────────────────────────────────────

function getConfig(env) {
  const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL?.replace(/^﻿/, "").trim();
  const SERVICE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY?.replace(/^﻿/, "").trim();
  const ANON_KEY     = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.replace(/^﻿/, "").trim();
  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    return { error: json({ error: { message: "Server not configured" } }, 503) };
  }
  return { SUPABASE_URL, SERVICE_KEY, ANON_KEY };
}

function getAccessTokenFromRequest(request, SUPABASE_URL) {
  // 1. Authorization header
  const header = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (header) return header;

  // 2. Supabase SSR cookie
  const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  if (projectRef) {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const base = `sb-${projectRef}-auth-token`;
    const findCookie = (name) => {
      const re = new RegExp(`(?:^|;)\\s*${name.replace(/\./g, "\\.")}=([^;]+)`);
      return cookieHeader.match(re)?.[1] ?? null;
    };
    const chunks = [];
    for (let i = 0; ; i++) {
      const chunk = findCookie(`${base}.${i}`);
      if (!chunk) break;
      chunks.push(chunk);
    }
    const raw = chunks.length ? chunks.join("") : findCookie(base);
    if (raw) {
      try { const t = JSON.parse(decodeURIComponent(raw)).access_token; if (t) return t; } catch {}
      try { const t = JSON.parse(raw).access_token; if (t) return t; } catch {}
    }
  }
  return null;
}

async function authenticate(request, env) {
  const cfg = getConfig(env);
  if (cfg.error) return { response: cfg.error };
  const { SUPABASE_URL, SERVICE_KEY, ANON_KEY } = cfg;

  const accessToken = getAccessTokenFromRequest(request, SUPABASE_URL);
  if (!accessToken) return { response: json({ error: { message: "Authentication required" } }, 401) };

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${accessToken}`, apikey: ANON_KEY },
  });
  if (!userRes.ok) return { response: json({ error: { message: "Invalid or expired session" } }, 401) };
  const { id: userId } = await userRes.json();

  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/users?id=eq.${userId}&select=id,role,department_id,is_active&limit=1`,
    { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } },
  );
  const [profile] = await profileRes.json();
  if (!profile?.is_active) return { response: json({ error: { message: "Account not found or inactive" } }, 403) };

  return { SUPABASE_URL, SERVICE_KEY, ANON_KEY, userId, profile };
}

// ── GET /api/documents ────────────────────────────────────────────────────────

async function handleDocumentsList(request, env) {
  const auth = await authenticate(request, env);
  if (auth.response) return auth.response;
  const { SUPABASE_URL, SERVICE_KEY, profile } = auth;

  const url = new URL(request.url);
  const dept   = url.searchParams.get("dept");
  const type   = url.searchParams.get("type");
  const status = url.searchParams.get("status");
  const q      = url.searchParams.get("q");

  const params = new URLSearchParams({
    select: "id,name,original_name,department_id,file_type,version,status,error_msg,size_bytes,page_count,created_at,is_deleted,parent_id,uploaded_by,departments!inner(id,name),users!documents_uploaded_by_fkey(id,full_name,email)",
    is_deleted: "eq.false",
    order: "created_at.desc",
  });
  if (profile.role !== "super_admin") {
    params.set("department_id", `eq.${profile.department_id}`);
  } else if (dept) {
    params.set("department_id", `eq.${dept}`);
  }
  if (type)   params.set("file_type", `eq.${type}`);
  if (status) params.set("status",    `eq.${status}`);
  if (q)      params.set("name",      `ilike.*${q}*`);

  const docsRes = await fetch(`${SUPABASE_URL}/rest/v1/documents?${params}`, {
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
  });
  if (!docsRes.ok) return json({ error: { message: "Failed to fetch documents" } }, 500);

  const data = await docsRes.json();
  return json({ data });
}

// ── DELETE /api/documents/:id ─────────────────────────────────────────────────

async function handleDocumentDelete(request, env, docId) {
  const auth = await authenticate(request, env);
  if (auth.response) return auth.response;
  const { SUPABASE_URL, SERVICE_KEY, userId, profile } = auth;

  const docRes = await fetch(
    `${SUPABASE_URL}/rest/v1/documents?id=eq.${docId}&select=id,department_id&limit=1`,
    { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } },
  );
  const [doc] = await docRes.json();
  if (!doc) return json({ error: { message: "Document not found" } }, 404);

  const canDelete = profile.role === "super_admin" || profile.role === "dept_admin";
  if (!canDelete) return json({ error: { message: "Forbidden" } }, 403);
  if (profile.role !== "super_admin" && doc.department_id !== profile.department_id) {
    return json({ error: { message: "Forbidden" } }, 403);
  }

  const patchRes = await fetch(
    `${SUPABASE_URL}/rest/v1/documents?id=eq.${docId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ is_deleted: true }),
    },
  );
  if (!patchRes.ok) return json({ error: { message: "Delete failed" } }, 500);
  return json({ ok: true });
}

// ── POST /api/ingest/upload ───────────────────────────────────────────────────

async function handleUpload(request, env) {
  const cfg = getConfig(env);
  if (cfg.error) return cfg.error;
  const { SUPABASE_URL, SERVICE_KEY, ANON_KEY } = cfg;

  let formData;
  try { formData = await request.formData(); } catch {
    return json({ error: { message: "Invalid multipart form data" } }, 400);
  }

  const file         = formData.get("file");
  const departmentId = formData.get("departmentId") ?? null;

  if (!file) return json({ error: { message: "file is required" } }, 400);

  // Auth: __token form field → Authorization header → cookie
  let accessToken = formData.get("__token")?.toString().trim() ?? null;
  if (!accessToken) accessToken = getAccessTokenFromRequest(request, SUPABASE_URL);
  if (!accessToken) return json({ error: { message: "Authentication required" } }, 401);

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${accessToken}`, apikey: ANON_KEY },
  });
  if (!userRes.ok) return json({ error: { message: "Invalid or expired session" } }, 401);
  const { id: userId } = await userRes.json();

  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/users?id=eq.${userId}&select=id,role,department_id,is_active&limit=1`,
    { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } },
  );
  const [profile] = await profileRes.json();
  if (!profile?.is_active) return json({ error: { message: "Account not found or inactive" } }, 403);

  const effectiveDeptId = departmentId ?? profile.department_id;
  if (!effectiveDeptId) return json({ error: { message: "departmentId is required" } }, 400);

  const ALLOWED = new Set([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "image/png", "image/jpeg", "image/tiff",
  ]);
  if (!ALLOWED.has(file.type)) return json({ error: { message: `Unsupported file type: ${file.type}` } }, 400);
  if (file.size > 52_428_800)  return json({ error: { message: "File exceeds 50 MB limit" } }, 400);

  if (profile.role !== "super_admin" && profile.department_id !== effectiveDeptId) {
    return json({ error: { message: "You can only upload to your own department" } }, 400);
  }

  const existRes = await fetch(
    `${SUPABASE_URL}/rest/v1/documents?department_id=eq.${encodeURIComponent(effectiveDeptId)}&original_name=eq.${encodeURIComponent(file.name)}&is_deleted=eq.false&select=id,version&order=version.desc&limit=1`,
    { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } },
  );
  const existing = await existRes.json();
  const version  = existing[0] ? existing[0].version + 1 : 1;
  const parentId = existing[0]?.id ?? null;

  const docId    = crypto.randomUUID();
  const ext      = file.name.split(".").pop()?.toLowerCase() ?? "";
  const typeMap  = { pdf: "pdf", docx: "docx", xlsx: "xlsx", png: "image", jpg: "image", jpeg: "image", tiff: "image" };
  const fileType = typeMap[ext] ?? (file.type === "application/pdf" ? "pdf" : "image");
  const storagePath = `${effectiveDeptId}/${docId}/${file.name}`;

  const buffer    = await file.arrayBuffer();
  const uploadRes = await fetch(
    `${SUPABASE_URL}/storage/v1/object/documents/${storagePath}`,
    {
      method:  "POST",
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": file.type },
      body:    buffer,
    },
  );
  if (!uploadRes.ok) {
    const e = await uploadRes.text();
    return json({ error: { message: `Storage upload failed: ${e}` } }, 500);
  }

  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/documents`, {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${SERVICE_KEY}`,
      apikey:         SERVICE_KEY,
      "Content-Type": "application/json",
      Prefer:         "return=minimal",
    },
    body: JSON.stringify({
      id:            docId,
      name:          file.name.replace(/\.[^.]+$/, ""),
      original_name: file.name,
      department_id: effectiveDeptId,
      uploaded_by:   userId,
      file_type:     fileType,
      storage_path:  storagePath,
      version,
      parent_id:     parentId,
      status:        "queued",
      size_bytes:    file.size,
    }),
  });

  if (!insertRes.ok) {
    const e = await insertRes.text();
    await fetch(`${SUPABASE_URL}/storage/v1/object/documents/${storagePath}`, {
      method:  "DELETE",
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
    });
    return json({ error: { message: `Record creation failed: ${e}` } }, 500);
  }

  return json({ ok: true, documentId: docId, version, status: "queued" }, 201);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
