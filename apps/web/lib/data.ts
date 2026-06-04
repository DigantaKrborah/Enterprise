export interface Doc {
  id: string;
  name: string;
  dept: "Operations" | "HR";
  type: "PDF" | "DOCX" | "XLSX";
  version: string;
  status: "Indexed" | "Processing" | "Failed";
  by: string;
  date: string;
  pages: number;
  size: string;
  error?: string;
  versions: { v: string; date: string; by: string; note: string }[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  dept: string;
  active: boolean;
  last: string;
}

export interface Conversation {
  id: string;
  title: string;
  dept: "Operations" | "HR" | "All";
  time: string;
  active?: boolean;
}

export interface Citation {
  doc: string;
  page: string;
  v: string;
  dept: string;
}

export interface Message {
  role: "user" | "ai";
  text: string;
  citations?: Citation[];
  model?: string;
  done?: boolean;
  _id?: number;
}

export interface LLM {
  id: string;
  name: string;
  model: string;
  desc: string;
  active: boolean;
  budget: number;
  host: string;
  tag: string;
}

export interface Bug {
  id: string;
  title: string;
  sev: "Critical" | "High" | "Medium" | "Low";
  status: "Open" | "In progress" | "Closed";
  by: string;
  date: string;
}

export interface HealthService {
  name: string;
  detail: string;
  status: "ok" | "warn";
  meta: string;
  latency: string;
}

export const DOCS: Doc[] = [
  { id: "d1", name: "Crude Distillation Unit — Startup SOP", dept: "Operations", type: "PDF", version: "v4.2", status: "Indexed", by: "M. Okonkwo", date: "2026-05-28", pages: 42, size: "3.1 MB",
    versions: [{ v: "v4.2", date: "2026-05-28", by: "M. Okonkwo", note: "Added cold-start interlock checklist" }, { v: "v4.1", date: "2026-03-14", by: "M. Okonkwo", note: "Revised reflux drum levels" }, { v: "v4.0", date: "2025-11-02", by: "R. Adeyemi", note: "Full rewrite for Unit 2 revamp" }] },
  { id: "d2", name: "Process Safety Management Manual", dept: "Operations", type: "PDF", version: "v2.0", status: "Indexed", by: "Safety Office", date: "2026-05-12", pages: 188, size: "11.4 MB",
    versions: [{ v: "v2.0", date: "2026-05-12", by: "Safety Office", note: "OSHA 1910.119 alignment" }, { v: "v1.6", date: "2025-09-30", by: "Safety Office", note: "Hot-work permit appendix" }] },
  { id: "d3", name: "Employee Handbook 2026", dept: "HR", type: "DOCX", version: "v1.3", status: "Indexed", by: "A. Sharma", date: "2026-04-30", pages: 96, size: "2.2 MB",
    versions: [{ v: "v1.3", date: "2026-04-30", by: "A. Sharma", note: "Updated remote-work policy" }, { v: "v1.2", date: "2026-01-15", by: "A. Sharma", note: "New parental leave terms" }] },
  { id: "d4", name: "Shift Rotation Schedule — Q3 2026", dept: "HR", type: "XLSX", version: "v1.0", status: "Processing", by: "Workforce Planning", date: "2026-06-03", pages: 8, size: "640 KB",
    versions: [{ v: "v1.0", date: "2026-06-03", by: "Workforce Planning", note: "Initial Q3 draft" }] },
  { id: "d5", name: "Hydrocracker Emergency Shutdown Procedure", dept: "Operations", type: "PDF", version: "v3.1", status: "Indexed", by: "K. Mensah", date: "2026-02-19", pages: 24, size: "1.8 MB",
    versions: [{ v: "v3.1", date: "2026-02-19", by: "K. Mensah", note: "Added depressurization timing" }] },
  { id: "d6", name: "Contractor Safety Onboarding Packet", dept: "HR", type: "PDF", version: "v2.4", status: "Failed", by: "Safety Office", date: "2026-06-02", pages: 31, size: "4.7 MB", error: "OCR failed on scanned pages 12–18",
    versions: [{ v: "v2.4", date: "2026-06-02", by: "Safety Office", note: "Re-scanned packet" }] },
  { id: "d7", name: "Flare Gas Recovery — Operating Limits", dept: "Operations", type: "PDF", version: "v1.2", status: "Indexed", by: "M. Okonkwo", date: "2026-03-22", pages: 16, size: "980 KB",
    versions: [{ v: "v1.2", date: "2026-03-22", by: "M. Okonkwo", note: "Updated knockout drum limits" }] },
  { id: "d8", name: "Benefits & Compensation Policy", dept: "HR", type: "PDF", version: "v3.0", status: "Indexed", by: "A. Sharma", date: "2026-01-09", pages: 54, size: "2.9 MB",
    versions: [{ v: "v3.0", date: "2026-01-09", by: "A. Sharma", note: "2026 plan-year rates" }] },
  { id: "d9", name: "Tank Farm Inspection Checklist", dept: "Operations", type: "DOCX", version: "v1.1", status: "Indexed", by: "K. Mensah", date: "2026-05-05", pages: 12, size: "420 KB",
    versions: [{ v: "v1.1", date: "2026-05-05", by: "K. Mensah", note: "API 653 references" }] },
  { id: "d10", name: "Workplace Harassment Reporting Policy", dept: "HR", type: "PDF", version: "v2.1", status: "Processing", by: "A. Sharma", date: "2026-06-03", pages: 18, size: "1.1 MB",
    versions: [{ v: "v2.1", date: "2026-06-03", by: "A. Sharma", note: "Anonymous channel added" }] },
];

export const USERS: User[] = [
  { id: "u1", name: "Mara Okonkwo",  email: "m.okonkwo@nrl.co", role: "Admin",    dept: "Operations", active: true,  last: "2 min ago" },
  { id: "u2", name: "Aisha Sharma",  email: "a.sharma@nrl.co",  role: "HR Lead",  dept: "HR",         active: true,  last: "18 min ago" },
  { id: "u3", name: "Kwame Mensah",  email: "k.mensah@nrl.co",  role: "Operator", dept: "Operations", active: true,  last: "1 hr ago" },
  { id: "u4", name: "Ravi Adeyemi",  email: "r.adeyemi@nrl.co", role: "Engineer", dept: "Operations", active: true,  last: "3 hr ago" },
  { id: "u5", name: "Lena Park",     email: "l.park@nrl.co",    role: "Analyst",  dept: "HR",         active: false, last: "12 days ago" },
  { id: "u6", name: "Tom Becker",    email: "t.becker@nrl.co",  role: "Operator", dept: "Operations", active: false, last: "1 month ago" },
];

export const CONVERSATIONS: Conversation[] = [
  { id: "c1", title: "CDU cold-start interlock sequence",      dept: "Operations", time: "Now",       active: true },
  { id: "c2", title: "Parental leave eligibility window",      dept: "HR",         time: "2h" },
  { id: "c3", title: "Flare KO drum high-level alarm",         dept: "Operations", time: "Yesterday" },
  { id: "c4", title: "Contractor PPE requirements",            dept: "HR",         time: "Yesterday" },
  { id: "c5", title: "Hydrocracker depressurization rate",     dept: "Operations", time: "Mon" },
  { id: "c6", title: "Overtime accrual for night shift",       dept: "HR",         time: "Mon" },
  { id: "c7", title: "Tank 7 inspection interval (API 653)",   dept: "Operations", time: "Last week" },
];

export const DEMO_ANSWER = {
  text: `During a cold start of the Crude Distillation Unit, the interlock sequence must complete in a fixed order before feed is introduced.

First, confirm the fired-heater purge cycle has run for a minimum of 5 minutes with the stack damper at 100% open. The cold-start interlock will not clear until firebox O₂ reads below 8%.

Next, establish reflux drum level at 40–60% and verify the overhead condenser cooling-water flow exceeds 1,200 m³/h. Only after both permissives are satisfied does the feed pump interlock release.

Finally, ramp crude feed no faster than 8% per hour until the tower reaches normal operating pressure. Exceeding this rate trips the high-rate-of-change interlock and forces a controlled hold.`,
  citations: [
    { doc: "Crude Distillation Unit — Startup SOP", page: "p. 14", v: "v4.2", dept: "Operations" },
    { doc: "Crude Distillation Unit — Startup SOP", page: "p. 17", v: "v4.2", dept: "Operations" },
    { doc: "Process Safety Management Manual",       page: "p. 88", v: "v2.0", dept: "Operations" },
  ],
};

export const HR_ANSWER = {
  text: `Under the 2026 Employee Handbook, parental leave eligibility opens once an employee has completed 90 days of continuous service.

Eligible employees receive 16 weeks of paid leave for a primary caregiver and 6 weeks for a secondary caregiver. Leave must begin within 12 months of the birth or placement.

To request leave, submit Form HR-204 through the portal at least 30 days in advance where foreseeable. Workforce Planning will confirm coverage against the active shift rotation before approval.`,
  citations: [
    { doc: "Employee Handbook 2026",       page: "p. 31", v: "v1.3", dept: "HR" },
    { doc: "Benefits & Compensation Policy", page: "p. 9", v: "v3.0", dept: "HR" },
  ],
};

export const SEED_MESSAGES: Message[] = [
  { role: "user", text: "What's the interlock sequence for a cold start on the CDU?" },
  { role: "ai",  text: DEMO_ANSWER.text, citations: DEMO_ANSWER.citations, done: true },
];

export const SENTIMENT_SAMPLE = `Team,

I want to flag that the Q3 shift rotation draft has the night crew working 6 consecutive 12-hour shifts with only one day off before rotating back. This is the third quarter in a row and morale on the floor is genuinely suffering — two operators have already asked about transferring out of Unit 2.

I appreciate the staffing constraints, but we need to revisit this before it goes final on June 15th. Happy to help build an alternative.

— Kwame`;

export const HEALTH: HealthService[] = [
  { name: "Elasticsearch",    detail: "Vector + keyword index",       status: "ok",   meta: "9 nodes · 1.2M chunks",      latency: "12ms" },
  { name: "Supabase",         detail: "Auth + metadata store",        status: "ok",   meta: "Postgres 15 · 99.99%",       latency: "8ms" },
  { name: "Ollama",           detail: "Local LLM runtime",            status: "ok",   meta: "llama3.2:3b · GPU 0–3",      latency: "—" },
  { name: "Embedding worker", detail: "Document ingestion queue",     status: "warn", meta: "3 jobs queued · 1 retrying", latency: "—" },
];

export const LLMS: LLM[] = [
  { id: "ollama", name: "Ollama",  model: "llama3.2:3b",          desc: "On-prem, air-gapped. No data leaves the refinery network.",     active: true,  budget: 8000,  host: "Local GPU cluster", tag: "On-prem" },
  { id: "claude", name: "Claude",  model: "claude-sonnet-4-6",    desc: "Cloud reasoning for complex multi-doc synthesis.",              active: true,  budget: 20000, host: "Anthropic API",     tag: "Cloud" },
  { id: "gemini", name: "Gemini",  model: "gemini-2.5-pro",       desc: "Fallback provider for long-context summarization.",             active: false, budget: 12000, host: "Google Vertex",     tag: "Cloud" },
];

export const BUGS: Bug[] = [
  { id: "ISS-142", title: "Citation chip links to wrong page on multi-part PDFs", sev: "High",   status: "Open",        by: "K. Mensah",   date: "2026-06-03" },
  { id: "ISS-139", title: "Sentiment analysis times out on emails > 4k words",    sev: "Medium", status: "Open",        by: "L. Park",     date: "2026-06-01" },
  { id: "ISS-131", title: "Processing badge stuck after failed OCR",               sev: "Low",    status: "In progress", by: "A. Sharma",   date: "2026-05-29" },
  { id: "ISS-128", title: "Dark theme flash on first login",                       sev: "Low",    status: "Closed",      by: "M. Okonkwo",  date: "2026-05-24" },
];

export function pickAnswer(q: string): typeof DEMO_ANSWER {
  const s = q.toLowerCase();
  if (/leave|benefit|hr|polic|harass|overtime|shift|vacation|pay|salary|onboard|handbook/.test(s)) {
    return HR_ANSWER;
  }
  return DEMO_ANSWER;
}
