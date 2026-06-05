// Cloudflare Pages Advanced Mode worker.
// Handles POST /api/ingest/upload; proxies everything else to static assets.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/ingest/upload" && request.method === "POST") {
      return handleUpload(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleUpload(request, env) {
  const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY;
  const ANON_KEY     = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    return json({ error: { message: "Server not configured — set Cloudflare Pages env vars" } }, 503);
  }

  // ── Auth ────────────────────────────────────────────────────────────────────
  // Client sends token as Authorization header (set by UploadZone)
  let accessToken = request.headers.get("Authorization")?.replace("Bearer ", "").trim() ?? null;

  // Fallback: parse Supabase SSR cookie (sb-<ref>-auth-token or chunked .0/.1)
  if (!accessToken) {
    const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
    if (projectRef) {
      const cookieHeader = request.headers.get("cookie") ?? "";
      const base = `sb-${projectRef}-auth-token`;

      // Try chunked cookies (.0, .1, …)
      const chunks = [];
      for (let i = 0; ; i++) {
        const m = cookieHeader.match(new RegExp(`${base}\\.${i}=([^;]+)`));
        if (!m) break;
        chunks.push(decodeURIComponent(m[1]));
      }
      const raw = chunks.length
        ? chunks.join("")
        : cookieHeader.match(new RegExp(`${base}=([^;]+)`))?.[1] ?? null;

      if (raw) {
        try { accessToken = JSON.parse(decodeURIComponent(raw)).access_token ?? null; } catch {}
      }
    }
  }

  if (!accessToken) return json({ error: { message: "Authentication required" } }, 401);

  // Validate token via Supabase Auth
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${accessToken}`, apikey: ANON_KEY },
  });
  if (!userRes.ok) return json({ error: { message: "Invalid or expired session" } }, 401);
  const { id: userId } = await userRes.json();

  // Load user profile
  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/users?id=eq.${userId}&select=id,role,department_id,is_active&limit=1`,
    { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } },
  );
  const [profile] = await profileRes.json();
  if (!profile?.is_active) return json({ error: { message: "Account not found or inactive" } }, 403);

  // ── Parse form ──────────────────────────────────────────────────────────────
  let formData;
  try { formData = await request.formData(); } catch {
    return json({ error: { message: "Invalid multipart form data" } }, 400);
  }

  const file         = formData.get("file");
  const departmentId = formData.get("departmentId") ?? profile.department_id;

  if (!file)         return json({ error: { message: "file is required" } }, 400);
  if (!departmentId) return json({ error: { message: "departmentId is required" } }, 400);

  const ALLOWED = new Set([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "image/png", "image/jpeg", "image/tiff",
  ]);
  if (!ALLOWED.has(file.type)) return json({ error: { message: `Unsupported file type: ${file.type}` } }, 400);
  if (file.size > 52_428_800) return json({ error: { message: "File exceeds 50 MB limit" } }, 400);

  // dept_admin / non-admin can only upload to their own dept
  if (profile.role !== "super_admin" && profile.department_id !== departmentId) {
    return json({ error: { message: "You can only upload to your own department" } }, 400);
  }

  // ── Version logic ───────────────────────────────────────────────────────────
  const existRes = await fetch(
    `${SUPABASE_URL}/rest/v1/documents?department_id=eq.${encodeURIComponent(departmentId)}&original_name=eq.${encodeURIComponent(file.name)}&is_deleted=eq.false&select=id,version&order=version.desc&limit=1`,
    { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } },
  );
  const existing = await existRes.json();
  const version  = existing[0] ? existing[0].version + 1 : 1;
  const parentId = existing[0]?.id ?? null;

  const docId    = crypto.randomUUID();
  const ext      = file.name.split(".").pop()?.toLowerCase() ?? "";
  const typeMap  = { pdf: "pdf", docx: "docx", xlsx: "xlsx", png: "image", jpg: "image", jpeg: "image", tiff: "image" };
  const fileType = typeMap[ext] ?? (file.type === "application/pdf" ? "pdf" : "image");
  const storagePath = `${departmentId}/${docId}/${file.name}`;

  // ── Upload to Supabase Storage ──────────────────────────────────────────────
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

  // ── Insert document record ──────────────────────────────────────────────────
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
      department_id: departmentId,
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
    // Clean up orphaned storage object
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
