// Quick RAG test — embeds a query and runs pgvector search
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, "../.env.local"), "utf8").split("\n")
    .filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => [l.split("=")[0].trim(), l.slice(l.indexOf("=") + 1).trim()])
);
Object.assign(process.env, env);

const { createClient } = require("@supabase/supabase-js");
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const query = process.argv[2] ?? "What is Human Bingo?";

async function embedText(text) {
  const res = await fetch(`${env.OLLAMA_BASE_URL}/api/embeddings`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "nomic-embed-text", prompt: text }),
    signal: AbortSignal.timeout(30000),
  });
  const data = await res.json();
  return data.embedding;
}

console.log(`\n🔍 Query: "${query}"\n`);
const embedding = await embedText(query);
const vectorLiteral = `[${embedding.join(",")}]`;
console.log(`   Embedding: ${embedding.length} dims`);

const { data, error } = await admin.rpc("match_document_chunks", {
  query_embedding: vectorLiteral,
  match_count: 3,
  filter_dept_id: null,
});

if (error) { console.error("RPC error:", error.message); process.exit(1); }

console.log(`\n📚 Retrieved ${data?.length ?? 0} chunks:\n`);
for (const chunk of (data ?? [])) {
  console.log(`  [${(chunk.similarity * 100).toFixed(1)}%] ${chunk.doc_name} — chunk ${chunk.chunk_index}`);
  console.log(`  "${chunk.content.slice(0, 120)}..."\n`);
}
