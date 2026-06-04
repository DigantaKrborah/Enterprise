"use client";

import React, { useState } from "react";
import { TopNav } from "./top-nav";
import { Chat } from "./chat";
import { DocumentLibrary } from "./documents";
import { SentimentPage } from "./sentiment";
import { AdminPanel } from "./admin";
import { BugReportModal } from "./bug-report-modal";

type Tab = "chat" | "documents" | "sentiment" | "admin";

export function AppShell() {
  const [tab, setTab] = useState<Tab>("chat");
  const [bugOpen, setBugOpen] = useState(false);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <TopNav tab={tab} setTab={setTab} onBug={() => setBugOpen(true)} />
      <main style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {tab === "chat"      && <Chat layout="classic" />}
        {tab === "documents" && <DocumentLibrary />}
        {tab === "sentiment" && <SentimentPage />}
        {tab === "admin"     && <AdminPanel />}
      </main>
      <BugReportModal open={bugOpen} onClose={() => setBugOpen(false)} />
    </div>
  );
}
