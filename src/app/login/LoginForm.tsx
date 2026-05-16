"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setLoading(false);
        setErr(error.message);
        return;
      }
      // Full navigation supaya server component layout di-render ulang dengan profile baru,
      // bukan dari Router Cache user sebelumnya.
      window.location.replace("/dashboard");
    } catch (e: any) {
      setLoading(false);
      setErr(e?.message ?? String(e));
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label">Email</label>
        <input className="input mt-1" type="email" required value={email}
               onChange={(e) => setEmail(e.target.value)} autoFocus />
      </div>
      <div>
        <label className="label">Password</label>
        <input className="input mt-1" type="password" required value={password}
               onChange={(e) => setPassword(e.target.value)} />
      </div>
      {err && <p className="text-sm text-red-600 break-words">{err}</p>}
      <button className="btn-primary w-full" disabled={loading}>
        {loading ? "Memproses..." : "Masuk"}
      </button>
    </form>
  );
}
