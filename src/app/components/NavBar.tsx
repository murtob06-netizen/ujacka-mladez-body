"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function NavBar() {
  const [pendingCount, setPendingCount] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;

    async function loadCount() {
      const { count, error } = await supabase
        .from("point_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");

      if (!cancelled) {
        if (error) setPendingCount(0);
        else setPendingCount(count ?? 0);
      }
    }

    loadCount();

    // refresh každých 20s (aby admin videl nové žiadosti bez reloadu)
    const t = setInterval(loadCount, 20000);

    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  return (
    <nav className="nav nav-hero">
      <a href="/" style={{ color: "white" }}>Dashboard</a>
      <a href="/leaderboard" style={{ color: "white" }}>Rebríček</a>

      <a href="/admin" style={{ color: "white" }}>
        Admin
        {pendingCount > 0 && (
          <span
            style={{
              marginLeft: 6,
              background: "#dc2626",
              color: "white",
              borderRadius: 999,
              padding: "2px 8px",
              fontSize: 12,
              fontWeight: 900,
            }}
          >
            {pendingCount}
          </span>
        )}
      </a>

      <a href="/auth" style={{ color: "white" }}>Login</a>
    </nav>
  );
}
