"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyProfile } from "@/lib/auth";

/**
 * TU MENÍŠ PRAVIDLÁ BODOVANIA
 * body za 1 hodinu pre každú aktivitu
 */
const ACTIVITIES = [
  { label: "Služba v klube", pointsPerHour: 10 },
  { label: "Akcia (organizácia / pomoc)", pointsPerHour: 15 },
  { label: "Brigáda / práca", pointsPerHour: 8 },
  { label: "Tréning / príprava", pointsPerHour: 6 },
  { label: "Reprezentácia združenia", pointsPerHour: 12 },
  { label: "Dobrovoľníctvo mimo akcie", pointsPerHour: 7 },
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

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{
    id: string;
    full_name: string;
    role: string;
  } | null>(null);

  const [requests, setRequests] = useState<Req[]>([]);
  const [err, setErr] = useState<string>("");

  const [form, setForm] = useState({
    activity_date: "",
    activity: ACTIVITIES[0],
    hours: 1,
    note: "",
  });

  const totals = useMemo(() => {
    const approved = requests
      .filter((r) => r.status === "approved")
      .reduce((s, r) => s + r.points, 0);
    const pending = requests
      .filter((r) => r.status === "pending")
      .reduce((s, r) => s + r.points, 0);
    return { approved, pending };
  }, [requests]);

  async function load() {
    setErr("");
    setLoading(true);

    const { profile, error } = await getMyProfile();
    if (error || !profile) {
      setProfile(null);
      setRequests([]);
      setLoading(false);
      return;
    }

    setProfile(profile);

    const { data, error: e2 } = await supabase
      .from("point_requests")
      .select(
        "id, activity_date, category, points, note, status, admin_comment, created_at"
      )
      .order("created_at", { ascending: false });

    if (e2) setErr(e2.message);
    setRequests((data ?? []) as Req[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    setErr("");

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      setErr("Najprv sa prihlás.");
      return;
    }

    if (!form.activity_date) {
      setErr("Vyber dátum aktivity.");
      return;
    }

    if (form.hours <= 0) {
      setErr("Počet hodín musí byť väčší ako 0.");
      return;
    }

    const calculatedPoints = form.hours * form.activity.pointsPerHour;

    const { error } = await supabase.from("point_requests").insert({
      user_id: user.id,
      activity_date: form.activity_date,
      category: form.activity.label,
      points: calculatedPoints,
      note: `${form.hours} h × ${form.activity.pointsPerHour} b/h${
        form.note ? " – " + form.note : ""
      }`,
      status: "pending",
    });

    if (error) {
      setErr(error.message);
      return;
    }

    setForm({
      activity_date: "",
      activity: ACTIVITIES[0],
      hours: 1,
      note: "",
    });

    await load();
  }

  async function logout() {
    await supabase.auth.signOut();
    await load();
  }

  const previewPoints = form.hours * form.activity.pointsPerHour;

  return (
    <div className="grid">
      {/* HLAVIČKA + KPI */}
      <section className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <h2>Dashboard</h2>
            {profile && (
              <p className="muted" style={{ marginTop: 6 }}>
                Prihlásený: <b>{profile.full_name}</b> • rola:{" "}
                <b>{profile.role}</b>
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
            Nie si prihlásený. Choď na <a href="/auth">Login</a>.
          </p>
        ) : (
          <div className="kpi" style={{ marginTop: 12 }}>
            <div className="box">
              <div className="klabel">Schválené body</div>
              <div className="kvalue">{totals.approved}</div>
            </div>
            <div className="box">
              <div className="klabel">Čakajúce body</div>
              <div className="kvalue">{totals.pending}</div>
            </div>
          </div>
        )}
      </section>

      {/* FORM + ŽIADOSTI */}
      {profile && (
        <div className="dashGrid">
          {/* FORM */}
          <section className="card">
            <h3>Pridať aktivitu</h3>
            {err && <p className="error">{err}</p>}

            <form onSubmit={submitRequest} className="grid">
              <label className="label">
                Dátum aktivity
                <input
                  className="input"
                  type="date"
                  value={form.activity_date}
                  onChange={(e) =>
                    setForm({ ...form, activity_date: e.target.value })
                  }
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
                      activity: ACTIVITIES.find(
                        (a) => a.label === e.target.value
                      )!,
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
                  onChange={(e) =>
                    setForm({ ...form, hours: Number(e.target.value) })
                  }
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
                  onChange={(e) =>
                    setForm({ ...form, note: e.target.value })
                  }
                  placeholder="napr. kde / čo presne / s kým…"
                />
              </label>

              <button className="btn btn-primary" type="submit">
                Odoslať na schválenie
              </button>
            </form>
          </section>

          {/* ŽIADOSTI */}
          <section className="card">
            <h3>Moje žiadosti</h3>

            {requests.length === 0 ? (
              <p className="muted">Zatiaľ nič.</p>
            ) : (
              <div className="list" style={{ marginTop: 10 }}>
                {requests.map((r) => (
                  <div className="item" key={r.id}>
                    <div
                      className="row"
                      style={{ justifyContent: "space-between" }}
                    >
                      <div>
                        <b>{r.activity_date}</b> • {r.points} bodov
                        <div className="muted" style={{ marginTop: 4 }}>
                          {r.category}
                        </div>
                      </div>
                      <span className={`badge ${r.status}`}>
                        {r.status}
                      </span>
                    </div>

                    {r.note && (
                      <div style={{ marginTop: 8 }}>{r.note}</div>
                    )}

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
      )}
    </div>
  );
}
