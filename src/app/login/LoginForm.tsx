"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, Lock, Mail, MessageCircle } from "lucide-react";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    } catch (e: unknown) {
      setLoading(false);
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label">Email</label>
        <div className="relative mt-1">
          <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
          <input
            className="input pl-9"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            placeholder="email@contoh.com"
          />
        </div>
      </div>
      <div>
        <label className="label">Password</label>
        <div className="relative mt-1">
          <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
          <input
            className="input px-9"
            type={showPassword ? "text" : "password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Masukkan password"
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-[var(--hover)]"
            style={{ color: "var(--muted)" }}
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Sembunyikan password" : "Lihat password"}
            title={showPassword ? "Sembunyikan password" : "Lihat password"}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>
      {err && <p className="text-sm text-red-600 break-words">{err}</p>}
      <button className="btn-primary w-full h-10" disabled={loading}>
        {loading ? "Memproses..." : "Masuk"}
      </button>
      <a
        href="https://wa.me/6285374748881?text=Halo%2C%20saya%20ingin%20buat%20akun%20Rajaklana%20Sales%20Recap."
        target="_blank"
        rel="noreferrer"
        className="btn-outline w-full h-10"
      >
        <MessageCircle size={16} />
        Buat akun
      </a>
    </form>
  );
}
