"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyProfile } from "@/lib/auth";

type Reward = { id: number; name: string; category: string; cost_points: number; stock_qty: number; is_active: boolean };
type RequestRow = {
  id: number;
  reward_id: number;
  qty: number;
  points_cost: number;
  status: "pending" | "approved" | "rejected" | "fulfilled";
  user_note: string;
  admin_comment: string;
  created_at: string;
  rewards?: { name: string; category: string; cost_points: number } | null;
};

export default function RewardsPage() {
  const [profile, setProfile] = useState<any>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [myReqs, setMyReqs] = useState<RequestRow[]>([]);
  const [selRewardId, setSelRewardId] = useState<string>("");
  const [qty, setQty] = useState<number>(1);
  const [note, setNote] = useState<string>("");
  const [err, setErr] = useState<string>("");

  const selectedReward = useMemo(
    () => rewards.find(r => String(r.id) === selRewardId) ?? null,
    [rewards, selRewardId]
  );

  const cost = useMemo(() => {
    if (!selectedReward) return 0;
    return qty * Number(selectedReward.cost_points);
  }, [qty, selectedReward]);

  async function load() {
    setErr("");
    const { profile } = await getMyProfile();
    setProfile(profile ?? null);

    const { data: rws, error: rerr } = await supabase
      .from("rewards")
      .select("id, name, category, cost_points, stock_qty, is_active")
      .eq("is_active", true)
      .order("category", { ascending: true })
      .order("name", { ascending: true });

    if (rerr) setErr(rerr.message);
    setRewards((rws ?? []) as Reward[]);
    if (!selRewardId && (rws?.length ?? 0) > 0) setSelRewardId(String((rws as any)[0].id));

    const { data: reqs, error: qerr } = await supabase
      .from("reward_requests")
      .select("id, reward_id, qty, points_cost, status, user_note, admin_comment, created_at, rewards(name, category, cost_points)")
      .order("created_at", { ascending: false })
      .limit(30);

    if (qerr) setErr(qerr.message);
    setMyReqs((reqs ?? []) as any);
  }

  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!profile) return setErr("Najprv sa prihlás.");
    if (!selectedReward) return setErr("Vyber odmenu.");
    if (qty <= 0) return setErr("Množstvo musí byť > 0.");
    if (selectedReward.stock_qty < qty) return setErr("Nie je dosť kusov na sklade.");

    const { error } = await supabase.from("reward_requests").insert({
      user_id: profile.id,
      reward_id: selectedReward.id,
      qty,
      points_cost: cost,
      status: "pending",
      user_note: note || "",
    });

    if (error) return setErr(error.message);

    setQty(1);
    setNote("");
    await load();
  }

  return (
    <div className="grid">
      <section className="card">
        <h2>Odmeny</h2>
        <p className="muted">Vyber si odmenu a pošli žiadosť. Admin ju schváli a vydá.</p>
        {err && <p className="error">{err}</p>}

        <form onSubmit={submit} className="grid" style={{ maxWidth: 520 }}>
          <label className="label">
            Odmena
            <select className="select" value={selRewardId} onChange={(e) => setSelRewardId(e.target.value)}>
              {rewards.map(r => (
                <option key={r.id} value={String(r.id)}>
                  {r.category}: {r.name} — {r.cost_points} b (sklad: {r.stock_qty})
                </option>
              ))}
            </select>
          </label>

          <label className="label">
            Množstvo
            <input className="input" type="number" min={1} step={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
          </label>

          <div className="muted">Cena spolu: <b>{cost}</b> bodov</div>

          <label className="label">
            Poznámka (voliteľné)
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="napr. veľkosť trička M..." />
          </label>

          <button className="btn btn-primary" type="submit">Požiadať o odmenu</button>
        </form>
      </section>

      <section className="card">
        <h3>Moje žiadosti</h3>
        {myReqs.length === 0 ? (
          <p className="muted">Zatiaľ nič.</p>
        ) : (
          <div className="list" style={{ marginTop: 10 }}>
            {myReqs.map(r => (
              <div className="item" key={r.id}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div>
                    <b>{r.rewards?.name ?? "Odmena"}</b> • qty {r.qty} • {r.points_cost} b
                    <div className="muted" style={{ marginTop: 4 }}>{r.rewards?.category}</div>
                  </div>
                  <span className={`badge ${r.status}`}>{r.status}</span>
                </div>
                {r.user_note && <div style={{ marginTop: 8 }}>{r.user_note}</div>}
                {r.admin_comment && <div style={{ marginTop: 8 }}><small>Admin: {r.admin_comment}</small></div>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
