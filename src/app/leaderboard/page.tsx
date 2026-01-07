"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function Leaderboard() {
  const [rows, setRows] = useState<Array<{ name: string; total: number }>>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      setErr("");

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
    <div className="card">
      <h2>Celkový rebríček</h2>
      <p className="muted">Počítajú sa iba schválené body.</p>

      {err && <p className="error">{err}</p>}

      {rows.length === 0 ? (
        <p className="muted">Zatiaľ nie sú žiadne schválené body.</p>
      ) : (
        <div className="list" style={{ marginTop: 10 }}>
          {rows.map((r, i) => (
            <div className="item" key={i}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div>
                  <b>#{i + 1}</b> {r.name}
                </div>
                <span className="badge approved">{r.total} bodov</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
