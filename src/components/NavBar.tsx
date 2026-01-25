"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { getMyProfile } from "../lib/auth";

export default function NavBar() {
  const [role, setRole] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { profile } = await getMyProfile();
      setRole(profile?.role ?? "");
    })();
  }, []);

  const canPos = role === "admin" || role === "cashier";

  return (
    <nav className="nav nav-hero">
      <a href="/" style={{ color: "white" }}>Dashboard</a>
      <a href="/leaderboard" style={{ color: "white" }}>Rebríček</a>
      <a href="/rewards" style={{ color: "white" }}>Odmeny</a>

      {canPos && (
        <>
          <a href="/pos" style={{ color: "white" }}>Pokladňa</a>
          <a href="/pos/products" style={{ color: "white" }}>POS Produkty</a>
        </>
      )}

      {role === "admin" && (
        <>
          <a href="/reports" style={{ color: "white" }}>Reporty</a>
          <a href="/admin" style={{ color: "white" }}>Admin</a>
        </>
      )}

      <a href="/auth" style={{ color: "white" }}>Login</a>
    </nav>
  );
}
