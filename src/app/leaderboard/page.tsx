"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type BalanceRow = {
  user_id: string;
  full_name: string;
  points_earned: number;
  points_spent: number;
  balance: number;
};

export default function Leaderboard() {
  const [rows, setRows] = useState<BalanceRow[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      setErr("");

      const { data, error } = await supabase
        .from("user_balances")
        .select("user_id, full_name, points_earned, points_spent, balance")
        .order("balance", { ascending: false });

      if (error) return setErr(error.message);
      setRows((data ?? []) as BalanceRow[]);
    })();
  }, []);

  return (
    <div className="card">
      <h2>Rebríček podľa zostatku</h2>
      <p className="muted">Zostatok = schválené body mínus minuté body za odmeny.</p>

      {err && <p className="error">{err}</p>}

      {rows.length === 0 ? (
        <p className="muted">Zatiaľ nie sú žiadne údaje.</p>
      ) : (
        <div className="list" style={{ marginTop: 10 }}>
          {rows.map((r, i) => (
            <div className="item" key={r.user_id}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div>
                  <b>#{i + 1}</b> {r.full_name || "Dobrovoľník"}
                  <div className="muted" style={{ marginTop: 4 }}>
                    Zarobené: {r.points_earned} • Minuté: {r.points_spent}
                  </div>
                </div>
                <span className="badge approved">{r.balance} bodov</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
