"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Loader2, Lock, Mail, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success("Successfully logged in!");
    } catch (err: any) {
      console.error(err);
      setError("Invalid email or password. Please try again.");
      toast.error("Failed to login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
      <div className="w-full max-w-md bg-panel border border-panel-border rounded-2xl shadow-2xl p-8 animate-in fade-in zoom-in-95 duration-500">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/10 mb-4">
            <Lock className="w-8 h-8 text-accent" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Densum Admin</h1>
          <p className="text-foreground/60">Enter your credentials to access the lab dashboard.</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-3">
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/80 pl-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground/40" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-black/40 border border-panel-border rounded-xl pl-10 pr-4 py-3.5 text-white focus:outline-none focus:border-accent transition-colors shadow-inner"
                placeholder="admin@densum.com"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/80 pl-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground/40" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-black/40 border border-panel-border rounded-xl pl-10 pr-4 py-3.5 text-white focus:outline-none focus:border-accent transition-colors shadow-inner"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-accent hover:bg-accent-glow text-panel font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(0,194,255,0.3)] hover:shadow-[0_0_30px_rgba(0,194,255,0.5)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
          >
            {loading ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Authenticating...</>
            ) : (
              "Login to Dashboard"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
