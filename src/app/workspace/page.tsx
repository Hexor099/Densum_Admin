"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const ExcelWorkspace = dynamic(
  () => import("@/components/ExcelWorkspace").then((mod) => mod.ExcelWorkspace),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center h-[80vh] text-foreground/60">
        <Loader2 className="w-8 h-8 animate-spin text-accent mb-4" />
        <p>Loading Workspace Editor...</p>
      </div>
    ),
  }
);

export default function WorkspacePage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6 flex flex-col h-[calc(100vh-6rem)]">
      <header className="mb-2 shrink-0">
        <h1 className="text-3xl font-bold text-white mb-2">Live Workspace</h1>
        <p className="text-foreground/70">
          Edit your daily records here. Click "Save to Cloud" when you're done to sync data across the app.
        </p>
      </header>

      <div className="flex-1 bg-panel rounded-xl border border-panel-border shadow-lg overflow-hidden flex flex-col relative">
        <ExcelWorkspace />
      </div>
    </div>
  );
}
