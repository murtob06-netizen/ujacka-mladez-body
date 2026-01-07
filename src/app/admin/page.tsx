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
      <div className="card">
        <h2>Admin</h2>
        <p>
          Najprv sa prihlás: <a href="/auth">Login</a>
        </p>
      </div>
    );
  }

  if (role !== "admin") {
    return (
      <div className="card">
        <h2>Admin</h2>
        <p className="error">Nemáš admin práva. (role: {role})</p>
        <p className="muted">Admina nastavíš v Supabase → Table Editor → profiles → role = admin.</p>
      </div>
    );
  }

  return (
    <div className="grid">
      <section className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>Schvaľovanie žiadostí</h2>
          <button className="btn btn-ghost" onClick={load}>Obnoviť</button>
        </div>

        {err && <p className="error">{err}</p>}

        {requests.length === 0 ? (
          <p className="muted">Nie sú žiadne čakajúce žiadosti 🎉</p>
        ) : (
          <div className="list" style={{ marginTop: 10 }}>
            {requests.map((r) => (
              <AdminCard key={r.id} r={r} name={names[r.user_id] ?? "Dobrovoľník"} onDecide={decide} />
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
    <div className="item">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <b>{name}</b> • {r.activity_date} • <span className="muted">{r.category}</span>
        </div>
        <span className="badge pending">pending</span>
      </div>

      {r.note && <div style={{ marginTop: 8 }}>{r.note}</div>}

      <div className="row" style={{ marginTop: 10 }}>
        <label className="label" style={{ width: 160 }}>
          Body (môžeš upraviť)
          <input
            className="input"
            type="number"
            min={1}
            max={1000}
            value={points}
            onChange={(e) => setPoints(Number(e.target.value))}
          />
        </label>

        <label className="label" style={{ flex: 1, minWidth: 240 }}>
          Komentár admina
          <input
            className="input"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="napr. schválené / upravené body…"
          />
        </label>
      </div>

      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn btn-primary" onClick={() => onDecide(r.id, "approved", comment, points)}>
          Schváliť
        </button>
        <button className="btn btn-danger" onClick={() => onDecide(r.id, "rejected", comment)}>
          Zamietnuť
        </button>
      </div>
    </div>
  );
}
