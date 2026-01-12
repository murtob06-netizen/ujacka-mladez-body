"use client";

import { useEffect, useMemo, useState } from "react";
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

type ProfileMini = { id: string; full_name: string | null };
type Reward = { id: number; name: string; category: string; cost_points: number; is_active: boolean };
type RedemptionRow = {
  id: number;
  user_id: string;
  reward_id: number;
  qty: number;
  points_spent: number;
  note: string;
  created_at: string;
  rewards?: { name: string; category: string; cost_points: number } | null;
};

export default function AdminPage() {
  const [role, setRole] = useState<string>("");
  const [err, setErr] = useState<string>("");

  // pending requests
  const [requests, setRequests] = useState<Req[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});

  // rewards + users for redemption
  const [users, setUsers] = useState<ProfileMini[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<RedemptionRow[]>([]);

  // redemption form
  const [selUserId, setSelUserId] = useState<string>("");
  const [selRewardId, setSelRewardId] = useState<string>("");
  const [qty, setQty] = useState<number>(1);
  const [note, setNote] = useState<string>("");

  const selectedReward = useMemo(() => rewards.find(r => String(r.id) === selRewardId) ?? null, [rewards, selRewardId]);
  const computedSpend = useMemo(() => {
    if (!selectedReward) return 0;
    return Number(qty) * Number(selectedReward.cost_points);
  }, [qty, selectedReward]);

  async function load() {
    setErr("");

    const { profile } = await getMyProfile();
    if (!profile) {
      setRole("");
      setRequests([]);
      return;
    }
    setRole(profile.role);

    // pending requests
    const { data, error } = await supabase
      .from("point_requests")
      .select("id, user_id, activity_date, category, points, note, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (error) {
      setErr(error.message);
      setRequests([]);
    } else {
      const reqs = (data ?? []) as Req[];
      setRequests(reqs);

      // name map for pending list
      const userIds = Array.from(new Set(reqs.map(r => r.user_id)));
      if (userIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
        const map: Record<string, string> = {};
        (profs ?? []).forEach((p: any) => (map[p.id] = p.full_name || "Dobrovoľník"));
        setNames(map);
      } else {
        setNames({});
      }
    }

    // users (for redemption dropdown)
    const { data: allUsers, error: uerr } = await supabase
      .from("profiles")
      .select("id, full_name")
      .order("full_name", { ascending: true });

    if (uerr) setErr(uerr.message);
    setUsers((allUsers ?? []) as ProfileMini[]);
    if (!selUserId && (allUsers?.length ?? 0) > 0) setSelUserId((allUsers as any)[0].id);

    // rewards
    const { data: rws, error: rerr } = await supabase
      .from("rewards")
      .select("id, name, category, cost_points, is_active")
      .eq("is_active", true)
      .order("category", { ascending: true })
      .order("name", { ascending: true });

    if (rerr) setErr(rerr.message);
    setRewards((rws ?? []) as Reward[]);
    if (!selRewardId && (rws?.length ?? 0) > 0) setSelRewardId(String((rws as any)[0].id));

    // last redemptions
    const { data: reds, error: redErr } = await supabase
      .from("redemptions")
      .select("id, user_id, reward_id, qty, points_spent, note, created_at, rewards(name, category, cost_points)")
      .order("created_at", { ascending: false })
      .limit(20);

    if (redErr) setErr(redErr.message);
    setRedemptions((reds ?? []) as any);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function addRedemption(e: React.FormEvent) {
    e.preventDefault();
    setErr("");

    if (!selUserId) return setErr("Vyber dobrovoľníka.");
    if (!selectedReward) return setErr("Vyber odmenu.");
    if (qty <= 0) return setErr("Množstvo musí byť > 0.");

    const points_spent = Number(qty) * Number(selectedReward.cost_points);

    const { error } = await supabase.from("redemptions").insert({
      user_id: selUserId,
      reward_id: selectedReward.id,
      qty,
      points_spent,
      note: note || "",
    });

    if (error) return setErr(error.message);

    setQty(1);
    setNote("");
    await load();
  }

  async function deleteRedemption(id: number) {
    setErr("");
    const { error } = await supabase.from("redemptions").delete().eq("id", id);
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
        <p className="muted">Admina nastavíš v Supabase → profiles → role = admin.</p>
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

      <section className="card">
        <h2>Odpočet bodov za odmeny</h2>
        <p className="muted">Tu zapíšeš, čo si dobrovoľník “kúpil” za body. Body sa mu tým odpočítajú.</p>

        {err && <p className="error">{err}</p>}

        <form onSubmit={addRedemption} className="grid" style={{ maxWidth: 520 }}>
          <label className="label">
            Dobrovoľník
            <select className="select" value={selUserId} onChange={(e) => setSelUserId(e.target.value)}>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.full_name || u.id}</option>
              ))}
            </select>
          </label>

          <label className="label">
            Položka (odmena)
            <select className="select" value={selRewardId} onChange={(e) => setSelRewardId(e.target.value)}>
              {rewards.map(r => (
                <option key={r.id} value={String(r.id)}>
                  {r.category}: {r.name} ({r.cost_points} b)
                </option>
              ))}
            </select>
          </label>

          <label className="label">
            Množstvo
            <input className="input" type="number" min={1} step={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
          </label>

          <div className="muted">
            Odpočet bodov: <b>{computedSpend}</b>
          </div>

          <label className="label">
            Poznámka (voliteľné)
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="napr. vydané na akcii..." />
          </label>

          <button className="btn btn-primary" type="submit">Odpočítať body</button>
        </form>

        <h3 style={{ marginTop: 18 }}>Posledné odpočty</h3>
        {redemptions.length === 0 ? (
          <p className="muted">Zatiaľ nič.</p>
        ) : (
          <div className="list" style={{ marginTop: 10 }}>
            {redemptions.map((r) => (
              <div className="item" key={r.id}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div>
                    <b>{users.find(u => u.id === r.user_id)?.full_name ?? "Dobrovoľník"}</b>
                    <div className="muted" style={{ marginTop: 4 }}>
                      {r.rewards?.category}: {r.rewards?.name} • qty {r.qty} • -{r.points_spent} b
                    </div>
                    {r.note && <div style={{ marginTop: 6 }}>{r.note}</div>}
                    <small className="muted">{new Date(r.created_at).toLocaleString()}</small>
                  </div>

                  <button className="btn btn-danger" onClick={() => deleteRedemption(r.id)}>
                    Zmazať
                  </button>
                </div>
              </div>
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
