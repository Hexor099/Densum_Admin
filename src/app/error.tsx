"use client";

import { AlertTriangle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 animate-in fade-in duration-500">
      <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.15)]">
        <AlertTriangle size={36} className="text-red-400" />
      </div>
      <h1 className="text-3xl font-bold text-white mb-3">Something went wrong!</h1>
      <p className="text-foreground/70 max-w-md mb-8">
        We apologize for the inconvenience. An unexpected error occurred while loading this page.
      </p>
      
      <div className="bg-black/40 p-4 rounded-lg border border-red-500/20 text-left mb-8 max-w-2xl w-full overflow-auto text-sm">
        <p className="text-red-400 font-mono break-words">{error.message || "Unknown Application Error"}</p>
      </div>

      <button
        onClick={() => reset()}
        className="px-8 py-3 bg-accent text-panel font-bold rounded-lg hover:bg-accent-glow transition-all shadow-[0_0_15px_rgba(0,194,255,0.3)] flex items-center gap-2"
      >
        Try again
      </button>
    </div>
  );
}
