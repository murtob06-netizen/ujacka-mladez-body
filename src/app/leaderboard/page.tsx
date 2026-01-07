"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function Leaderboard() {
  const [rows, setRows] = useState<Array<{ name: string; total: number }>>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      setErr("");

      // schválené žiadosti
      const { data: approved, error: e1 } = await supabase
        .from("point_requests")
        .select("user_id, points")
        .eq("status", "approved");

      if (e1) return setErr(e1.message);

      const totals = new Map<string, number>();
      (approved ?? []).forEach((r: any) => {
        totals.set(r.user_id, (totals.get(r.user_id) ?? 0) + r.points);
      });

      const userIds = Array.from(totals.keys());
      if (userIds.length === 0) {
        setRows([]);
        return;
      }

      const { data: profs, error: e2 } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      if (e2) return setErr(e2.message);

      const nameById = new Map<string, string>();
      (profs ?? []).forEach((p: any) => nameById.set(p.id, p.full_name || "Dobrovoľník"));

      const out = userIds
        .map((id) => ({ name: nameById.get(id) ?? "Dobrovoľník", total: totals.get(id) ?? 0 }))
        .sort((a, b) => b.total - a.total);

      setRows(out);
    })();
  }, []);

  return (
    <div style={{ background: "white", borderRadius: 12, padding: 16 }}>
      <h2>Celkový rebríček (schválené body)</h2>
      {err && <p style={{ color: "crimson" }}>{err}</p>}

      {rows.length === 0 ? (
        <p>Zatiaľ nie sú žiadne schválené body.</p>
      ) : (
        <ol style={{ paddingLeft: 20 }}>
          {rows.map((r, i) => (
            <li key={i} style={{ marginBottom: 8 }}>
              <b>{r.name}</b> — {r.total} bodov
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
