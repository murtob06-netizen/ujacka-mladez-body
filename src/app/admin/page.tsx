"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyProfile } from "@/lib/auth";

type Req = {
  id: number;
  user_id: string;
  activity_date: string;
  category: string;
  points: number;
  note: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

export default function AdminPage() {
  const [role, setRole] = useState<string>("");
  const [requests, setRequests] = useState<Req[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string>("");

  async function load() {
    setErr("");

    const { profile } = await getMyProfile();
    if (!profile) {
      setRole("");
      setRequests([]);
      return;
    }
    setRole(profile.role);

    // pending žiadosti (admin cez RLS uvidí všetko)
    const { data, error } = await supabase
      .from("point_requests")
      .select("id, user_id, activity_date, category, points, note, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (error) {
      setErr(error.message);
      setRequests([]);
      return;
    }

    const reqs = (data ?? []) as Req[];
    setRequests(reqs);

    // mená užívateľov pre zobrazenie
    const userIds = Array.from(new Set(reqs.map((r) => r.user_id)));
    if (userIds.length > 0) {
      const { data: profs, error: e2 } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      if (!e2) {
        const map: Record<string, string> = {};
        (profs ?? []).forEach((p: any) => (map[p.id] = p.full_name || "Dobrovoľník"));
        setNames(map);
      }
    } else {
      setNames({});
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function decide(id: number, status: "approved" | "rejected", admin_comment: string, newPoints?: number) {
    setErr("");

    const patch: any = {
      status,
      admin_comment,
      decided_at: new Date().toISOString(),
    };
    if (typeof newPoints === "number") patch.points = newPoints;

    const { error } = await supabase.from("point_requests").update(patch).eq("id", id);
    if (error) return setErr(error.message);

    await load();
  }

  if (!role) {
    return (
      <div style={{ background: "white", borderRadius: 12, padding: 16 }}>
        <h2>Admin</h2>
        <p>
          Najprv sa prihlás: <a href="/auth">Login</a>
        </p>
      </div>
    );
  }

  if (role !== "admin") {
    return (
      <div style={{ background: "white", borderRadius: 12, padding: 16 }}>
        <h2>Admin</h2>
        <p>Nemáš admin práva. (role: {role})</p>
        <p>Admina nastavíš v Supabase → Table Editor → profiles → role = admin.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section style={{ background: "white", borderRadius: 12, padding: 16 }}>
        <h2>Schvaľovanie žiadostí</h2>
        {err && <p style={{ color: "crimson" }}>{err}</p>}

        {requests.length === 0 ? (
          <p>Nie sú žiadne čakajúce žiadosti 🎉</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {requests.map((r) => (
              <AdminCard
                key={r.id}
                r={r}
                name={names[r.user_id] ?? r.user_id}
                onDecide={decide}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function AdminCard({
  r,
  name,
  onDecide,
}: {
  r: Req;
  name: string;
  onDecide: (id: number, status: "approved" | "rejected", admin_comment: string, newPoints?: number) => Promise<void>;
}) {
  const [comment, setComment] = useState("");
  const [points, setPoints] = useState<number>(r.points);

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <b>{name}</b> • {r.activity_date} • {r.category}
        </div>
        <div>
          Body:
          <input
            type="number"
            min={1}
            max={1000}
            value={points}
            onChange={(e) => setPoints(Number(e.target.value))}
            style={{ marginLeft: 8, width: 90, padding: 6 }}
          />
        </div>
      </div>

      {r.note && <div style={{ marginTop: 6 }}>{r.note}</div>}

      <label style={{ display: "block", marginTop: 10 }}>
        Komentár admina
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          style={{ width: "100%", padding: 8, marginTop: 4 }}
          placeholder="napr. schválené / upravené body…"
        />
      </label>

      <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
        <button onClick={() => onDecide(r.id, "approved", comment, points)} style={{ padding: "8px 10px", fontWeight: 800 }}>
          Schváliť
        </button>
        <button onClick={() => onDecide(r.id, "rejected", comment)} style={{ padding: "8px 10px" }}>
          Zamietnuť
        </button>
      </div>
    </div>
  );
}
