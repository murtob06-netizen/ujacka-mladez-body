"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyProfile } from "@/lib/auth";

/**
 * Bodovanie: body za 1 hodinu
 */
const ACTIVITIES = [
  { label: "Služba v klube", pointsPerHour: 10 },
  { label: "Akcia (organizácia / pomoc)", pointsPerHour: 15 },
  { label: "Brigáda / práca", pointsPerHour: 8 },
  { label: "Tréning / príprava", pointsPerHour: 6 },
  { label: "Reprezentácia združenia", pointsPerHour: 12 },
  { label: "Dobrovoľníctvo mimo akcie", pointsPerHour: 7 },
];

const QUICK_ACTIONS = [
  { label: "Služba v klube", hours: 1 },
  { label: "Akcia (organizácia / pomoc)", hours: 2 },
  { label: "Brigáda / práca", hours: 2 },
  { label: "Tréning / príprava", hours: 1.5 },
  { label: "Dobrovoľníctvo mimo akcie", hours: 1 },
];

type Req = {
  id: number;
  activity_date: string;
  category: string;
  points: number;
  note: string;
  status: "pending" | "approved" | "rejected";
  admin_comment: string;
  created_at: string;
};

type BalanceRow = {
  user_id: string;
  full_name: string;
  role: string;
  points_earned: number;
  points_spent: number;
  balance: number;
};

type LevelInfo = {
  name: string;
  min: number;
  nextMin: number | null;
  progress: number;
  remaining: number | null;
};

function toDateInputValue(date: Date) {
  const tzOffsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffsetMs).toISOString().slice(0, 10);
}

function computeStreak(dates: string[]) {
  const unique = Array.from(new Set(dates.filter(Boolean)));
  if (unique.length === 0) return { current: 0, best: 0, last: null as string | null };

  const sorted = unique.slice().sort();
  const set = new Set(sorted);
  const today = toDateInputValue(new Date());

  let current = 0;
  if (set.has(today)) {
    let cursor = today;
    while (set.has(cursor)) {
      current += 1;
      const d = new Date(cursor + "T00:00:00");
      d.setDate(d.getDate() - 1);
      cursor = toDateInputValue(d);
    }
  }

  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = new Date(sorted[i - 1] + "T00:00:00");
    const curr = new Date(sorted[i] + "T00:00:00");
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);
    if (diffDays === 1) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
  }

  return { current, best, last: sorted[sorted.length - 1] };
}

function getLevel(points: number): LevelInfo {
  const levels = [
    { name: "Nováčik", min: 0 },
    { name: "Dobrovoľník", min: 50 },
    { name: "Spoľahlivý", min: 150 },
    { name: "Líder", min: 300 },
    { name: "Legenda", min: 600 },
  ];

  let current = levels[0];
  for (const lvl of levels) {
    if (points >= lvl.min) current = lvl;
  }
  const currentIndex = levels.findIndex((l) => l.name === current.name);
  const next = levels[currentIndex + 1] ?? null;
  const nextMin = next ? next.min : null;
  const progress = next ? (points - current.min) / (next.min - current.min) : 1;
  const remaining = next ? Math.max(next.min - points, 0) : null;

  return {
    name: current.name,
    min: current.min,
    nextMin,
    progress: Math.max(0, Math.min(progress, 1)),
    remaining,
  };
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ id: string; full_name: string; role: string } | null>(null);

  const [requests, setRequests] = useState<Req[]>([]);
  const [err, setErr] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  const [balances, setBalances] = useState<BalanceRow | null>(null);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [quickBusy, setQuickBusy] = useState(false);
  const [checkinToken, setCheckinToken] = useState<string>("");
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenErr, setTokenErr] = useState<string>("");
  const [tokenCopied, setTokenCopied] = useState(false);

  const [form, setForm] = useState({
    activity_date: "",
    activity: ACTIVITIES[0],
    hours: 1,
    note: "",
  });

  const previewPoints = useMemo(
    () => form.hours * form.activity.pointsPerHour,
    [form.hours, form.activity.pointsPerHour]
  );

  const statusLabel: Record<Req["status"], string> = {
    pending: "Čaká",
    approved: "Schválené",
    rejected: "Zamietnuté",
  };

  const approvedRequests = useMemo(() => requests.filter((r) => r.status === "approved"), [requests]);
  const approvedCount = approvedRequests.length;
  const pointsEarned = balances?.points_earned ?? 0;
  const streak = useMemo(
    () => computeStreak(approvedRequests.map((r) => r.activity_date)),
    [approvedRequests]
  );
  const level = useMemo(() => getLevel(pointsEarned), [pointsEarned]);
  const badges = useMemo(
    () => [
      { code: "first", name: "Prvý krok", desc: "1 schválená aktivita", unlocked: approvedCount >= 1 },
      { code: "five", name: "Na rozbeh", desc: "5 schválených aktivít", unlocked: approvedCount >= 5 },
      { code: "twenty", name: "Stálica", desc: "20 schválených aktivít", unlocked: approvedCount >= 20 },
      { code: "100pts", name: "Sto bodov", desc: "Zarobených 100 bodov", unlocked: pointsEarned >= 100 },
      { code: "streak3", name: "Streak 3", desc: "3 dni po sebe", unlocked: streak.current >= 3 },
      { code: "streak7", name: "Streak 7", desc: "7 dní po sebe", unlocked: streak.current >= 7 },
    ],
    [approvedCount, pointsEarned, streak.current]
  );

  const qrUrl = useMemo(
    () => (checkinToken ? `https://quickchart.io/qr?text=${encodeURIComponent(checkinToken)}&size=220` : ""),
    [checkinToken]
  );

  async function load() {
    setErr("");
    setSuccess("");
    setLoading(true);

    const { profile, error } = await getMyProfile();
    if (error || !profile) {
      setProfile(null);
      setRequests([]);
      setBalances(null);
      setLoading(false);
      return;
    }
    setProfile(profile);

    setTokenErr("");
    setTokenLoading(true);
    const { data: tok, error: tokErr } = await supabase.rpc("get_or_create_checkin_token");
    if (tokErr) setTokenErr(tokErr.message);
    if (tok) setCheckinToken(String(tok));
    setTokenLoading(false);

    const { data: pref, error: prefErr } = await supabase
      .from("notification_prefs")
      .select("email_enabled")
      .eq("user_id", profile.id)
      .maybeSingle();

    if (prefErr) setErr(prefErr.message);
    if (pref) setEmailEnabled(Boolean(pref.email_enabled));

    // moje žiadosti
    const { data: reqs, error: e2 } = await supabase
      .from("point_requests")
      .select("id, activity_date, category, points, note, status, admin_comment, created_at")
      .order("created_at", { ascending: false });

    if (e2) setErr(e2.message);
    setRequests((reqs ?? []) as Req[]);

    // môj zostatok z view
    const { data: bal, error: e3 } = await supabase
      .from("user_balances")
      .select("user_id, full_name, role, points_earned, points_spent, balance")
      .eq("user_id", profile.id)
      .single();

    if (e3) {
      // ak by RLS/VIEW nebolo dostupné, nech aspoň dashboard beží
      console.error(e3);
      setBalances(null);
    } else {
      setBalances(bal as BalanceRow);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createPointRequest(params: {
    activity: { label: string; pointsPerHour: number };
    hours: number;
    activity_date: string;
    note: string;
  }) {
    setErr("");
    setSuccess("");

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      setErr("Najprv sa prihlás.");
      return false;
    }

    if (!params.activity_date) {
      setErr("Vyber dátum aktivity.");
      return false;
    }

    if (params.hours <= 0) {
      setErr("Počet hodín musí byť väčší ako 0.");
      return false;
    }

    const calculatedPoints = params.hours * params.activity.pointsPerHour;

    const { error } = await supabase.from("point_requests").insert({
      user_id: user.id,
      activity_date: params.activity_date,
      category: params.activity.label,
      points: calculatedPoints,
      note: `${params.hours} h × ${params.activity.pointsPerHour} b/h${params.note ? " – " + params.note : ""}`,
      status: "pending",
    });

    if (error) {
      setErr(error.message);
      return false;
    }

    setSuccess("Žiadosť bola odoslaná na schválenie.");
    return true;
  }

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();

    const ok = await createPointRequest({
      activity: form.activity,
      hours: form.hours,
      activity_date: form.activity_date,
      note: form.note,
    });

    if (!ok) return;

    setForm({ activity_date: "", activity: ACTIVITIES[0], hours: 1, note: "" });
    await load();
  }

  async function quickAdd(label: string, hours: number) {
    setQuickBusy(true);
    const activity = ACTIVITIES.find((a) => a.label === label) ?? ACTIVITIES[0];
    const ok = await createPointRequest({
      activity,
      hours,
      activity_date: toDateInputValue(new Date()),
      note: "Rýchle pridanie",
    });
    if (ok) await load();
    setQuickBusy(false);
  }

  async function updateEmailPref(next: boolean) {
    if (!profile) return;
    setPrefsLoading(true);
    setEmailEnabled(next);

    const { error } = await supabase.from("notification_prefs").upsert(
      {
        user_id: profile.id,
        email_enabled: next,
      },
      { onConflict: "user_id" }
    );

    if (error) setErr(error.message);
    setPrefsLoading(false);
  }

  async function copyToken() {
    if (!checkinToken) return;
    try {
      await navigator.clipboard.writeText(checkinToken);
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    } catch {
      setErr("Nepodarilo sa skopírovať kód.");
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    await load();
  }

  return (
    <div className="grid">
      <section className="card">
        <div className="row card-header" style={{ justifyContent: "space-between" }}>
          <div>
            <h2 className="page-title">Dashboard</h2>
            {profile && (
              <p className="muted" style={{ marginTop: 6 }}>
                Prihlásený: <b>{profile.full_name}</b> • rola: <b>{profile.role}</b>
              </p>
            )}
          </div>

          {profile && (
            <button className="btn btn-ghost" onClick={logout}>
              Odhlásiť
            </button>
          )}
        </div>

        {loading ? (
          <p>Načítavam…</p>
        ) : !profile ? (
          <p>
            Nie si prihlásený. Choď na <a href="/auth">Prihlásenie</a>.
          </p>
        ) : (
          <div className="kpi" style={{ marginTop: 12 }}>
            <div className="box">
              <div className="klabel">Zarobené body</div>
              <div className="kvalue">{balances ? balances.points_earned : "—"}</div>
            </div>
            <div className="box">
              <div className="klabel">Minuté body</div>
              <div className="kvalue">{balances ? balances.points_spent : "—"}</div>
            </div>
            <div className="box">
              <div className="klabel">Zostatok</div>
              <div className="kvalue">{balances ? balances.balance : "—"}</div>
            </div>
            <div className="box">
              <div className="klabel">Streak</div>
              <div className="kvalue">{approvedCount ? `${streak.current} dní` : "—"}</div>
            </div>
          </div>
        )}
      </section>

      {profile && (
        <>
          <section className="card">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 className="section-title">Motivácia</h3>
                <p className="muted">Level, streak a odznaky podľa schválených aktivít.</p>
              </div>
            </div>

            <div className="miniGrid">
              <div>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
                  <div>
                    <div className="klabel">Level</div>
                    <div className="level-name">{level.name}</div>
                    <div className="muted">Zarobené body: {pointsEarned}</div>
                  </div>
                  {level.nextMin !== null && (
                    <div className="muted">Do ďalšieho: {level.remaining} b</div>
                  )}
                </div>

                <div className="progress" aria-hidden="true" style={{ marginTop: 10 }}>
                  <span style={{ width: `${Math.round(level.progress * 100)}%` }} />
                </div>

                <div className="row" style={{ marginTop: 12 }}>
                  <div className="streak-box">
                    <div className="klabel">Aktívny streak</div>
                    <div className="kvalue small">{approvedCount ? `${streak.current} dní` : "—"}</div>
                  </div>
                  <div className="streak-box">
                    <div className="klabel">Najlepší streak</div>
                    <div className="kvalue small">{approvedCount ? `${streak.best} dní` : "—"}</div>
                  </div>
                  <div className="streak-box">
                    <div className="klabel">Posledná aktivita</div>
                    <div className="kvalue small">{streak.last ?? "—"}</div>
                  </div>
                </div>
              </div>

              <div className="notify-card">
                <div className="section-title">Notifikácie</div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={emailEnabled}
                    disabled={prefsLoading}
                    onChange={(e) => updateEmailPref(e.target.checked)}
                  />
                  Email notifikácie
                </label>
                <p className="muted">Email príde pri schválení alebo zamietnutí žiadosti.</p>
                <p className="muted">SMTP musí byť nastavené v Supabase.</p>
              </div>

              <div className="qr-card">
                <div className="section-title">Môj QR check-in</div>
                <p className="muted">Ukáž kód v kiosku na potvrdenie účasti.</p>
                <div className="qr-code">
                  {tokenLoading ? (
                    <span className="muted">Načítavam…</span>
                  ) : tokenErr ? (
                    <span className="error">Token chyba</span>
                  ) : checkinToken ? (
                    <img src={qrUrl} alt="QR check-in" width={180} height={180} />
                  ) : (
                    <span className="muted">Bez tokenu</span>
                  )}
                </div>
                {tokenCopied && <p className="success">Kód skopírovaný.</p>}
                {checkinToken && (
                  <div className="token-box">
                    <span className="token-value">{checkinToken}</span>
                    <button className="btn btn-ghost btn-small" type="button" onClick={copyToken}>
                      Kopírovať
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="badge-grid" style={{ marginTop: 12 }}>
              {badges.map((b) => (
                <div key={b.code} className={`badge-card ${b.unlocked ? "unlocked" : "locked"}`}>
                  <div className="badge-icon">{b.unlocked ? "*" : "o"}</div>
                  <div>
                    <div className="badge-title">{b.name}</div>
                    <div className="muted">{b.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="dashGrid">
            <section className="card">
              <h3 className="section-title">Pridať aktivitu</h3>
              {err && <p className="error">{err}</p>}
              {success && <p className="success">{success}</p>}

              <div className="quick-panel">
                <div className="muted" style={{ marginBottom: 8 }}>Rýchle pridanie (dnešný dátum)</div>
                <div className="quick-grid">
                  {QUICK_ACTIONS.map((q) => {
                    const activity = ACTIVITIES.find((a) => a.label === q.label) ?? ACTIVITIES[0];
                    const pts = q.hours * activity.pointsPerHour;
                    return (
                      <button
                        key={q.label}
                        className="quick-btn"
                        type="button"
                        disabled={quickBusy}
                        onClick={() => quickAdd(q.label, q.hours)}
                      >
                        <div className="quick-title">{q.label}</div>
                        <div className="muted">{q.hours} h • {pts} bodov</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <form onSubmit={submitRequest} className="grid">
                <label className="label">
                  Dátum aktivity
                  <input
                    className="input"
                    type="date"
                    value={form.activity_date}
                    onChange={(e) => setForm({ ...form, activity_date: e.target.value })}
                  />
                </label>

                <label className="label">
                  Čo som robil
                  <select
                    className="select"
                    value={form.activity.label}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        activity: ACTIVITIES.find((a) => a.label === e.target.value) ?? ACTIVITIES[0],
                      })
                    }
                  >
                    {ACTIVITIES.map((a) => (
                      <option key={a.label} value={a.label}>
                        {a.label} ({a.pointsPerHour} b / hod)
                      </option>
                    ))}
                  </select>
                </label>

                <label className="label">
                  Počet hodín
                  <input
                    className="input"
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={form.hours}
                    onChange={(e) => setForm({ ...form, hours: Number(e.target.value) })}
                  />
                </label>

                <div className="muted">
                  Vypočítané body: <b>{previewPoints}</b>
                </div>

                <label className="label">
                  Poznámka (voliteľné)
                  <textarea
                    className="textarea"
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    placeholder="napr. kde / čo presne / s kým…"
                  />
                </label>

                <button className="btn btn-primary" type="submit">
                  Odoslať na schválenie
                </button>
              </form>
            </section>

            <section className="card">
              <h3 className="section-title">Moje žiadosti</h3>

              {requests.length === 0 ? (
                <p className="muted empty">Zatiaľ nič.</p>
              ) : (
                <div className="list" style={{ marginTop: 10 }}>
                  {requests.map((r) => (
                    <div className="item" key={r.id}>
                      <div className="row" style={{ justifyContent: "space-between" }}>
                        <div>
                          <div className="item-title">
                            <b>{r.activity_date}</b> • {r.points} bodov
                          </div>
                          <div className="muted item-meta" style={{ marginTop: 4 }}>{r.category}</div>
                        </div>
                        <span className={`badge ${r.status}`}>{statusLabel[r.status]}</span>
                      </div>

                      {r.note && <div style={{ marginTop: 8 }}>{r.note}</div>}

                      {r.admin_comment && (
                        <div style={{ marginTop: 8 }}>
                          <small>Admin: {r.admin_comment}</small>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
