"use client";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

export function LogoutButton() {
  const [loading, setLoading] = useState(false);
  async function logout() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    // Full reload supaya semua Router Cache + Server Component cache hilang
    window.location.replace("/login");
  }
  return (
    <button onClick={logout} disabled={loading} className="btn-outline">
      {loading ? "Keluar..." : "Logout"}
    </button>
  );
}
