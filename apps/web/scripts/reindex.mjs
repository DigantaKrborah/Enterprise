// Direct re-ingestion script — run with: node scripts/reindex.mjs <documentId>
// Bypasses HTTP layer and calls the ingest agent directly.

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Load .env.local
const envPath = resolve(__dirname, "../.env.local");
const envVars = Object.fromEntries(
  readFileSync(envPath, "utf8").split("\n")
    .filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => [l.split("=")[0].trim(), l.slice(l.indexOf("=") + 1).trim()])
);
Object.assign(process.env, envVars);

const { createClient } = require("@supabase/supabase-js");

const docId   = process.argv[2] ?? "1ce6e20f-b39e-459f-bee1-212531412dfc";
const userId  = "264c1054-b96f-4e4d-945c-9f5cc2b9f075"; // super admin

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function embedText(text) {
  const res = await fetch(`${process.env.OLLAMA_BASE_URL}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "nomic-embed-text", prompt: text }),
    signal: AbortSignal.timeout(30000),
  });
  const data = await res.json();
  return data.embedding;
}

function chunkText(text) {
  const TARGET = 2000, OVERLAP = 200;
  const sentences = text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
  const chunks = [];
  let current = "", idx = 0;
  for (const s of sentences) {
    if (current.length + s.length + 1 > TARGET && current.length > 0) {
      chunks.push({ content: current.trim(), chunkIndex: idx++ });
      const overlapStart = Math.max(0, current.length - OVERLAP);
      current = current.slice(overlapStart).trim() + " " + s;
    } else {
      current = current ? current + " " + s : s;
    }
  }
  if (current.trim()) chunks.push({ content: current.trim(), chunkIndex: idx++ });
  return chunks;
}

async function run() {
  console.log(`\n📄 Re-indexing document: ${docId}\n`);

  // Get document
  const { data: doc, error: docErr } = await admin.from("documents")
    .select("*").eq("id", docId).single();
  if (docErr || !doc) { console.error("Document not found:", docErr?.message); process.exit(1); }
  console.log(`  Name: ${doc.name} | Type: ${doc.file_type} | Status: ${doc.status}`);

  // Reset
  await admin.from("documents").update({ status: "processing", error_msg: null }).eq("id", docId);
  await admin.from("document_chunks").delete().eq("document_id", docId);

  // Download file
  console.log(`\n⬇  Downloading from Storage: ${doc.storage_path}`);
  const { data: blob, error: dlErr } = await admin.storage.from("documents").download(doc.storage_path);
  if (dlErr || !blob) { console.error("Download failed:", dlErr?.message); process.exit(1); }
  const buffer = Buffer.from(await blob.arrayBuffer());
  console.log(`   ${buffer.byteLength} bytes downloaded`);

  // Extract text
  console.log(`\n📝 Extracting text (${doc.file_type})...`);
  let text = "";
  if (doc.file_type === "pdf") {
    const pdfParse = require("pdf-parse");
    const parsed = await pdfParse(buffer);
    text = parsed.text;
  } else if (doc.file_type === "docx") {
    const mammoth = require("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    text = result.value;
  } else if (doc.file_type === "xlsx") {
    const XLSX = require("xlsx");
    const wb = XLSX.read(buffer, { type: "buffer" });
    text = wb.SheetNames.map(n => `=== ${n} ===\n${XLSX.utils.sheet_to_csv(wb.Sheets[n])}`).join("\n");
  } else {
    console.log(`   Unsupported type for script: ${doc.file_type} — use the app to upload`);
    process.exit(1);
  }
  console.log(`   Extracted ${text.length} characters`);

  // Chunk
  console.log(`\n✂  Chunking...`);
  const chunks = chunkText(text);
  console.log(`   ${chunks.length} chunks`);
  if (chunks.length === 0) { console.error("No chunks extracted"); process.exit(1); }

  // Embed + upsert
  console.log(`\n🔢 Embedding and storing chunks...`);
  let stored = 0;
  for (const chunk of chunks) {
    process.stdout.write(`   chunk ${chunk.chunkIndex + 1}/${chunks.length}... `);
    const embedding = await embedText(chunk.content);
    const vectorLiteral = `[${embedding.join(",")}]`;

    const { error } = await admin.from("document_chunks").upsert({
      document_id: docId,
      chunk_index: chunk.chunkIndex,
      content:     chunk.content,
      embedding:   vectorLiteral,
      page_number: null,
      metadata:    { method: doc.file_type },
    }, { onConflict: "document_id,chunk_index" });

    if (error) {
      console.log(`FAILED: ${error.message}`);
    } else {
      console.log("✓");
      stored++;
    }
  }

  // Mark indexed
  await admin.from("documents").update({ status: "indexed", page_count: null, error_msg: null }).eq("id", docId);

  console.log(`\n✅ Done! ${stored}/${chunks.length} chunks stored in pgvector`);

  // Verify
  const { count } = await admin.from("document_chunks").select("*", { count: "exact", head: true }).eq("document_id", docId);
  console.log(`   Verified: ${count} chunks in database\n`);
}

run().catch(e => { console.error("Fatal:", e); process.exit(1); });
