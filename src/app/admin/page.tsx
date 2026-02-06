"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyProfile } from "@/lib/auth";

type PointReq = {
  id: number;
  user_id: string;
  activity_date: string;
  category: string;
  points: number;
  note: string;
  status: "pending" | "approved" | "rejected";
  admin_comment: string;
  created_at: string;
};

type ProfileMini = { id: string; full_name: string | null };

type Reward = {
  id: number;
  name: string;
  category: string;
  cost_points: number;
  stock_qty: number;
  is_active: boolean;
  created_at: string;
};

type RewardReq = {
  id: number;
  user_id: string;
  reward_id: number;
  qty: number;
  points_cost: number;
  status: "pending" | "approved" | "rejected" | "fulfilled";
  user_note: string;
  admin_comment: string;
  decided_at: string | null;
  fulfilled_at: string | null;
  created_at: string;
  rewards?: { name: string; category: string; cost_points: number; stock_qty: number } | null;
};

type AuditRow = {
  id: number;
  actor_id: string | null;
  action: string;
  table_name: string;
  row_id: string;
  details: any;
  created_at: string;
};

function skStatus(s: string) {
  if (s === "pending") return "Čaká";
  if (s === "approved") return "Schválené";
  if (s === "rejected") return "Zamietnuté";
  if (s === "fulfilled") return "Vydané";
  return s;
}

function badgeClassByStatus(s: string) {
  if (s === "pending") return "badge pending";
  if (s === "approved") return "badge approved";
  if (s === "rejected") return "badge rejected";
  // fulfilled – použijeme approved štýl, len iný text
  if (s === "fulfilled") return "badge approved";
  return "badge";
}

export default function AdminPage() {
  const [role, setRole] = useState<string>("");
  const [err, setErr] = useState<string>("");
  const [busy, setBusy] = useState(false);

  // profiles for name lookup
  const [users, setUsers] = useState<ProfileMini[]>([]);
  const userNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    users.forEach((u) => (m[u.id] = u.full_name || "Dobrovoľník"));
    return m;
  }, [users]);

  // point requests
  const [pendingReqs, setPendingReqs] = useState<PointReq[]>([]);

  // rewards (catalog + stock)
  const [rewards, setRewards] = useState<Reward[]>([]);

  // reward requests workflow
  const [rewardReqs, setRewardReqs] = useState<RewardReq[]>([]);
  const [rqFilter, setRqFilter] = useState<"pending" | "approved" | "rejected" | "fulfilled" | "all">("pending");

  // audit log
  const [audit, setAudit] = useState<AuditRow[]>([]);

  async function loadAll() {
    setErr("");
    setBusy(true);

    const { profile } = await getMyProfile();
    if (!profile) {
      setRole("");
      setBusy(false);
      return;
    }
    setRole(profile.role);

    // users
    const { data: u, error: uerr } = await supabase
      .from("profiles")
      .select("id, full_name")
      .order("full_name", { ascending: true });

    if (uerr) setErr(uerr.message);
    setUsers((u ?? []) as ProfileMini[]);

    // pending point requests
    const { data: pr, error: prErr } = await supabase
      .from("point_requests")
      .select("id, user_id, activity_date, category, points, note, status, admin_comment, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (prErr) setErr(prErr.message);
    setPendingReqs((pr ?? []) as PointReq[]);

    // rewards catalog
    const { data: rw, error: rwErr } = await supabase
      .from("rewards")
      .select("id, name, category, cost_points, stock_qty, is_active, created_at")
      .order("category", { ascending: true })
      .order("name", { ascending: true });

    if (rwErr) setErr(rwErr.message);
    setRewards((rw ?? []) as Reward[]);

    // reward requests
    let q = supabase
      .from("reward_requests")
      .select(
        "id, user_id, reward_id, qty, points_cost, status, user_note, admin_comment, decided_at, fulfilled_at, created_at, rewards(name, category, cost_points, stock_qty)"
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (rqFilter !== "all") q = q.eq("status", rqFilter);

    const { data: rr, error: rrErr } = await q;
    if (rrErr) setErr(rrErr.message);
    setRewardReqs((rr ?? []) as any);

    // audit
    const { data: au, error: auErr } = await supabase
      .from("audit_log")
      .select("id, actor_id, action, table_name, row_id, details, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (auErr) setErr(auErr.message);
    setAudit((au ?? []) as any);

    setBusy(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rqFilter]);

  // ---- ACTIONS: point requests ----
  async function decidePointRequest(id: number, status: "approved" | "rejected", admin_comment: string, newPoints?: number) {
    setErr("");
    setBusy(true);

    const patch: any = {
      status,
      admin_comment: admin_comment || "",
      decided_at: new Date().toISOString(),
    };
    if (typeof newPoints === "number") patch.points = newPoints;

    const { error } = await supabase.from("point_requests").update(patch).eq("id", id);
    if (error) setErr(error.message);

    await loadAll();
    setBusy(false);
  }

  // ---- ACTIONS: rewards stock ----
  async function updateReward(rewardId: number, patch: Partial<Pick<Reward, "stock_qty" | "cost_points" | "is_active">>) {
    setErr("");
    setBusy(true);

    const { error } = await supabase.from("rewards").update(patch).eq("id", rewardId);
    if (error) setErr(error.message);

    await loadAll();
    setBusy(false);
  }

  // ---- ACTIONS: reward requests workflow ----
  async function decideRewardRequest(id: number, status: "approved" | "rejected", admin_comment: string) {
    setErr("");
    setBusy(true);

    const patch: any = {
      status,
      admin_comment: admin_comment || "",
      decided_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("reward_requests").update(patch).eq("id", id);
    if (error) setErr(error.message);

    await loadAll();
    setBusy(false);
  }

  async function fulfillRewardRequest(id: number) {
    setErr("");
    setBusy(true);

    const { error } = await supabase.rpc("fulfill_reward_request", { p_request_id: id });
    if (error) setErr(error.message);

    await loadAll();
    setBusy(false);
  }

  // ---- UI guards ----
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
          <div>
            <h2>Admin panel</h2>
            <p className="muted">Schvaľovanie bodov • odmeny • audit</p>
          </div>
          <button className="btn btn-ghost" onClick={loadAll} disabled={busy}>
            {busy ? "Načítavam…" : "Obnoviť"}
          </button>
        </div>

        {err && <p className="error">{err}</p>}
      </section>

      {/* 1) Schvaľovanie bodov */}
      <section className="card">
        <h3>Žiadosti o body (čakajúce)</h3>

        {pendingReqs.length === 0 ? (
          <p className="muted">Žiadne čakajúce žiadosti 🎉</p>
        ) : (
          <div className="list" style={{ marginTop: 10 }}>
            {pendingReqs.map((r) => (
              <PointReqCard
                key={r.id}
                r={r}
                fullName={userNameMap[r.user_id] ?? "Dobrovoľník"}
                onDecide={decidePointRequest}
                disabled={busy}
              />
            ))}
          </div>
        )}
      </section>

      {/* 7) Sklad odmien */}
      <section className="card">
        <h3>Sklad odmien</h3>
        <p className="muted">Tu upravíš ceny v bodoch a sklad (kusy). Ak je sklad 0, odmena sa nedá vydať.</p>

        {rewards.length === 0 ? (
          <p className="muted">V tabuľke rewards zatiaľ nie sú položky.</p>
        ) : (
          <div className="list" style={{ marginTop: 10 }}>
            {rewards.map((rw) => (
              <RewardRow key={rw.id} rw={rw} onSave={updateReward} disabled={busy} />
            ))}
          </div>
        )}
      </section>

      {/* 8) Žiadosti o odmeny */}
      <section className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <h3>Žiadosti o odmenu</h3>
            <p className="muted">Flow: pending → approved → vydané (fulfill). Vydanie odpočíta body a zníži sklad.</p>
          </div>

          <label className="label" style={{ width: 240 }}>
            Filter
            <select className="select" value={rqFilter} onChange={(e) => setRqFilter(e.target.value as any)}>
              <option value="pending">Čaká</option>
              <option value="approved">Schválené</option>
              <option value="fulfilled">Vydané</option>
              <option value="rejected">Zamietnuté</option>
              <option value="all">Všetko</option>
            </select>
          </label>
        </div>

        {rewardReqs.length === 0 ? (
          <p className="muted">Zatiaľ žiadne žiadosti.</p>
        ) : (
          <div className="list" style={{ marginTop: 10 }}>
            {rewardReqs.map((rr) => (
              <RewardReqCard
                key={rr.id}
                rr={rr}
                fullName={userNameMap[rr.user_id] ?? "Dobrovoľník"}
                onDecide={decideRewardRequest}
                onFulfill={fulfillRewardRequest}
                disabled={busy}
              />
            ))}
          </div>
        )}
      </section>

      {/* 9) Audit log */}
      <section className="card">
        <h3>Audit log (posledných 50)</h3>
        <p className="muted">Kto čo zmenil: schvaľovanie bodov, odpočty, žiadosti o odmeny.</p>

        {audit.length === 0 ? (
          <p className="muted">Zatiaľ nič.</p>
        ) : (
          <div className="list" style={{ marginTop: 10 }}>
            {audit.map((a) => (
              <div className="item" key={a.id}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div>
                    <b>{a.table_name}</b> • {a.action} • row {a.row_id}
                    <div className="muted" style={{ marginTop: 4 }}>
                      actor: {a.actor_id ?? "—"} • {new Date(a.created_at).toLocaleString()}
                    </div>
                  </div>
                  <span className="badge">{a.id}</span>
                </div>

                {/* krátky výpis - nebudeme ukazovať celé JSONy */}
                <div className="muted" style={{ marginTop: 8 }}>
                  {summarizeAuditDetails(a)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PointReqCard({
  r,
  fullName,
  onDecide,
  disabled,
}: {
  r: PointReq;
  fullName: string;
  onDecide: (id: number, status: "approved" | "rejected", admin_comment: string, newPoints?: number) => Promise<void>;
  disabled: boolean;
}) {
  const [comment, setComment] = useState(r.admin_comment ?? "");
  const [points, setPoints] = useState<number>(r.points);

  return (
    <div className="item">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <b>{fullName}</b> • {r.activity_date} • <span className="muted">{r.category}</span>
        </div>
        <span className={badgeClassByStatus(r.status)}>{skStatus(r.status)}</span>
      </div>

      {r.note && <div style={{ marginTop: 8 }}>{r.note}</div>}

      <div className="row" style={{ marginTop: 10, alignItems: "flex-end" }}>
        <label className="label" style={{ width: 160 }}>
          Body
          <input
            className="input"
            type="number"
            min={1}
            max={10000}
            value={points}
            onChange={(e) => setPoints(Number(e.target.value))}
            disabled={disabled}
          />
        </label>

        <label className="label" style={{ flex: 1, minWidth: 220 }}>
          Komentár admina
          <input className="input" value={comment} onChange={(e) => setComment(e.target.value)} disabled={disabled} />
        </label>
      </div>

      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn btn-primary" onClick={() => onDecide(r.id, "approved", comment, points)} disabled={disabled}>
          Schváliť
        </button>
        <button className="btn btn-danger" onClick={() => onDecide(r.id, "rejected", comment)} disabled={disabled}>
          Zamietnuť
        </button>
      </div>
    </div>
  );
}

function RewardRow({
  rw,
  onSave,
  disabled,
}: {
  rw: Reward;
  onSave: (rewardId: number, patch: Partial<Pick<Reward, "stock_qty" | "cost_points" | "is_active">>) => Promise<void>;
  disabled: boolean;
}) {
  const [stock, setStock] = useState<number>(rw.stock_qty);
  const [cost, setCost] = useState<number>(Number(rw.cost_points));
  const [active, setActive] = useState<boolean>(rw.is_active);

  const changed = stock !== rw.stock_qty || cost !== Number(rw.cost_points) || active !== rw.is_active;

  return (
    <div className="item">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <b>
            {rw.category}: {rw.name}
          </b>
          <div className="muted" style={{ marginTop: 4 }}>
            ID: {rw.id}
          </div>
        </div>

        <div className="row" style={{ gap: 10 }}>
          <label className="label" style={{ width: 140 }}>
            Cena (body)
            <input
              className="input"
              type="number"
              min={1}
              step={1}
              value={cost}
              onChange={(e) => setCost(Number(e.target.value))}
              disabled={disabled}
            />
          </label>

          <label className="label" style={{ width: 120 }}>
            Sklad (ks)
            <input
              className="input"
              type="number"
              min={0}
              step={1}
              value={stock}
              onChange={(e) => setStock(Number(e.target.value))}
              disabled={disabled}
            />
          </label>

          <label className="label" style={{ width: 120 }}>
            Aktívna
            <select className="select" value={active ? "1" : "0"} onChange={(e) => setActive(e.target.value === "1")} disabled={disabled}>
              <option value="1">Áno</option>
              <option value="0">Nie</option>
            </select>
          </label>

          <button
            className="btn btn-primary"
            disabled={disabled || !changed}
            onClick={() => onSave(rw.id, { stock_qty: stock, cost_points: cost, is_active: active })}
          >
            Uložiť
          </button>
        </div>
      </div>
    </div>
  );
}

function RewardReqCard({
  rr,
  fullName,
  onDecide,
  onFulfill,
  disabled,
}: {
  rr: RewardReq;
  fullName: string;
  onDecide: (id: number, status: "approved" | "rejected", admin_comment: string) => Promise<void>;
  onFulfill: (id: number) => Promise<void>;
  disabled: boolean;
}) {
  const [comment, setComment] = useState(rr.admin_comment ?? "");

  const canApproveReject = rr.status === "pending";
  const canFulfill = rr.status === "approved";

  const rewardTitle = rr.rewards
    ? `${rr.rewards.category}: ${rr.rewards.name}`
    : `reward #${rr.reward_id}`;

  return (
    <div className="item">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <b>{fullName}</b> • {rewardTitle}
          <div className="muted" style={{ marginTop: 4 }}>
            qty {rr.qty} • cena {rr.points_cost} b • sklad: {rr.rewards?.stock_qty ?? "—"}
          </div>
        </div>
        <span className={badgeClassByStatus(rr.status)}>{skStatus(rr.status)}</span>
      </div>

      {rr.user_note && <div style={{ marginTop: 8 }}>{rr.user_note}</div>}

      <div className="row" style={{ marginTop: 10, alignItems: "flex-end" }}>
        <label className="label" style={{ flex: 1, minWidth: 260 }}>
          Komentár admina
          <input className="input" value={comment} onChange={(e) => setComment(e.target.value)} disabled={disabled} />
        </label>

        <div className="row" style={{ gap: 10 }}>
          <button
            className="btn btn-primary"
            disabled={disabled || !canApproveReject}
            onClick={() => onDecide(rr.id, "approved", comment)}
          >
            Schváliť
          </button>

          <button
            className="btn btn-danger"
            disabled={disabled || !canApproveReject}
            onClick={() => onDecide(rr.id, "rejected", comment)}
          >
            Zamietnuť
          </button>

          <button
            className="btn btn-primary"
            disabled={disabled || !canFulfill}
            onClick={() => onFulfill(rr.id)}
            title="Vydá odmenu, odpočíta body a zníži sklad"
          >
            Vydať
          </button>
        </div>
      </div>

      <div className="muted" style={{ marginTop: 8 }}>
        request #{rr.id} • {new Date(rr.created_at).toLocaleString()}
        {rr.decided_at ? ` • rozhodnuté: ${new Date(rr.decided_at).toLocaleString()}` : ""}
        {rr.fulfilled_at ? ` • vydané: ${new Date(rr.fulfilled_at).toLocaleString()}` : ""}
      </div>
    </div>
  );
}

function summarizeAuditDetails(a: AuditRow) {
  try {
    const d = a.details ?? {};
    const n = d.new ?? null;
    const o = d.old ?? null;

    // vyberieme pár vecí, aby to nebolo obrovské
    if (a.table_name === "point_requests") {
      const st = n?.status ?? o?.status;
      const pts = n?.points ?? o?.points;
      const uid = n?.user_id ?? o?.user_id;
      return `user_id=${uid ?? "—"} • status=${st ?? "—"} • points=${pts ?? "—"}`;
    }

    if (a.table_name === "reward_requests") {
      const st = n?.status ?? o?.status;
      const uid = n?.user_id ?? o?.user_id;
      const rid = n?.reward_id ?? o?.reward_id;
      const qty = n?.qty ?? o?.qty;
      const cost = n?.points_cost ?? o?.points_cost;
      return `user_id=${uid ?? "—"} • reward_id=${rid ?? "—"} • qty=${qty ?? "—"} • cost=${cost ?? "—"} • status=${st ?? "—"}`;
    }

    if (a.table_name === "redemptions") {
      const uid = n?.user_id ?? o?.user_id;
      const rid = n?.reward_id ?? o?.reward_id;
      const pts = n?.points_spent ?? o?.points_spent;
      return `user_id=${uid ?? "—"} • reward_id=${rid ?? "—"} • spent=${pts ?? "—"}`;
    }

    if (a.table_name === "rewards") {
      const name = n?.name ?? o?.name;
      const stock = n?.stock_qty ?? o?.stock_qty;
      const cost = n?.cost_points ?? o?.cost_points;
      return `${name ?? "reward"} • stock=${stock ?? "—"} • cost=${cost ?? "—"}`;
    }

    return "Záznam uložený.";
  } catch {
    return "Záznam uložený.";
  }
}
