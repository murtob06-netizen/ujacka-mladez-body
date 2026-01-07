"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyProfile } from "@/lib/auth";

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
  const [profile, setProfile] = useState<{ id: string; full_name: string; role: string } | null>(null);
  const [requests, setRequests] = useState<Req[]>([]);
  const [form, setForm] = useState({ activity_date: "", category: "iné", points: 1, note: "" });
  const [err, setErr] = useState<string>("");

  const totals = useMemo(() => {
    const approved = requests.filter(r => r.status === "approved").reduce((s, r) => s + r.points, 0);
    const pending = requests.filter(r => r.status === "pending").reduce((s, r) => s + r.points, 0);
    return { approved, pending };
  }, [requests]);

  async function load() {
    setErr("");
    setLoading(true);

    const { profile, error } = await getMyProfile();
    if (error || !profile) {
      setLoading(false);
      setProfile(null);
      setRequests([]);
      return;
    }
    setProfile(profile);

    const { data, error: e2 } = await supabase
      .from("point_requests")
      .select("id, activity_date, category, points, note, status, admin_comment, created_at")
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

    const { error } = await supabase.from("point_requests").insert({
      user_id: user.id,
      activity_date: form.activity_date,
      category: form.category,
      points: Number(form.points),
      note: form.note,
      status: "pending",
    });

    if (error) {
      setErr(error.message);
      return;
    }

    setForm({ activity_date: "", category: "iné", points: 1, note: "" });
    await load();
  }

  async function logout() {
    await supabase.auth.signOut();
    await load();
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section style={{ background: "white", borderRadius: 12, padding: 16 }}>
        <h2>Dashboard</h2>

        {loading ? (
          <p>Načítavam…</p>
        ) : !profile ? (
          <p>
            Nie si prihlásený. Choď na <a href="/auth">Login</a>.
          </p>
        ) : (
          <>
            <p>
              Prihlásený: <b>{profile.full_name || "Dobrovoľník"}</b>{" "}
              <button onClick={logout}>Odhlásiť</button>
            </p>

            <div style={{ display: "flex", gap: 12 }}>
              <div>
                <b>Schválené body:</b> {totals.approved}
              </div>
              <div>
                <b>Čakajúce body:</b> {totals.pending}
              </div>
            </div>
          </>
        )}
      </section>

      {profile && (
        <section style={{ background: "white", borderRadius: 12, padding: 16 }}>
          <h3>Pridať body</h3>
          {err && <p style={{ color: "red" }}>{err}</p>}

          <form onSubmit={submitRequest} style={{ display: "grid", gap: 8, maxWidth: 400 }}>
            <input
              type="date"
              value={form.activity_date}
              onChange={e => setForm({ ...form, activity_date: e.target.value })}
            />
            <input
              type="number"
              min={1}
              value={form.points}
              onChange={e => setForm({ ...form, points: Number(e.target.value) })}
            />
            <textarea
              placeholder="Poznámka"
              value={form.note}
              onChange={e => setForm({ ...form, note: e.target.value })}
            />
            <button type="submit">Odoslať na schválenie</button>
          </form>
        </section>
      )}

      {profile && (
        <section style={{ background: "white", borderRadius: 12, padding: 16 }}>
          <h3>Moje žiadosti</h3>
          {requests.length === 0 ? (
            <p>Zatiaľ nič.</p>
          ) : (
            <ul>
              {requests.map(r => (
                <li key={r.id}>
                  {r.activity_date} – {r.points} bodov – <b>{r.status}</b>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
