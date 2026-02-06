"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyProfile } from "@/lib/auth";

type Row = {
  user_id: string;
  full_name: string;
  month: string; // ISO
  earned_points: number;
  spent_points: number;
  net_points: number;
};

function toMonthKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01T00:00:00.000Z`; // približne, stačí na porovnanie stringom
}

export default function ReportsPage() {
  const [role, setRole] = useState<string>("");
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState("");
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const monthStart = useMemo(() => `${month}-01`, [month]);

  async function load() {
    setErr("");

    const { profile } = await getMyProfile();
    if (!profile) { setRole(""); setRows([]); return; }
    setRole(profile.role);

    const { data, error } = await supabase
      .from("monthly_user_summary")
      .select("user_id, full_name, month, earned_points, spent_points, net_points")
      .eq("month", new Date(monthStart).toISOString())  // porovnanie na začiatok mesiaca
      .order("full_name", { ascending: true });

    if (error) return setErr(error.message);
    setRows((data ?? []) as any);
  }

  useEffect(() => { load(); }, [month]);

  function downloadCSV() {
    const header = ["Meno", "Mesiac", "Zarobené", "Minuté", "Čisté"];
    const lines = rows.map(r => [
      r.full_name,
      month,
      String(r.earned_points),
      String(r.spent_points),
      String(r.net_points),
    ].map(v => `"${String(v).replaceAll('"', '""')}"`).join(","));

    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!role) {
    return <div className="card"><h2>Reporty</h2><p>Najprv sa prihlás: <a href="/auth">Login</a></p></div>;
  }
  if (role !== "admin") {
    return <div className="card"><h2>Reporty</h2><p className="error">Len pre adminov.</p></div>;
  }

  return (
    <div className="grid">
      <section className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <h2>Mesačný report</h2>
            <p className="muted">Zarobené/minuté body za zvolený mesiac.</p>
          </div>

          <div className="row">
            <input
              className="input"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              style={{ width: 170 }}
            />
            <button className="btn btn-primary" onClick={downloadCSV} disabled={rows.length === 0}>
              Export CSV
            </button>
          </div>
        </div>

        {err && <p className="error">{err}</p>}

        {rows.length === 0 ? (
          <p className="muted">Žiadne dáta pre tento mesiac.</p>
        ) : (
          <div className="list" style={{ marginTop: 10 }}>
            {rows.map((r) => (
              <div className="item" key={r.user_id}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div>
                    <b>{r.full_name}</b>
                    <div className="muted" style={{ marginTop: 4 }}>
                      Zarobené: {r.earned_points} • Minuté: {r.spent_points}
                    </div>
                  </div>
                  <span className="badge approved">{r.net_points} čisté</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
