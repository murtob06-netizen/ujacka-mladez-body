"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyProfile } from "@/lib/auth";

function toDateInputValue(date: Date) {
  const tzOffsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffsetMs).toISOString().slice(0, 10);
}

export default function KioskPage() {
  const [role, setRole] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  const [token, setToken] = useState("");
  const [points, setPoints] = useState(5);
  const [activityDate, setActivityDate] = useState(toDateInputValue(new Date()));
  const [note, setNote] = useState("QR check-in");
  const [busy, setBusy] = useState(false);
  const [lastUserId, setLastUserId] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { profile } = await getMyProfile();
      setRole(profile?.role ?? "");
      setLoading(false);
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setSuccess("");

    if (!token.trim()) {
      setErr("Zadaj QR token.");
      return;
    }

    if (points <= 0) {
      setErr("Body musia byť väčšie ako 0.");
      return;
    }

    setBusy(true);
    const { data, error } = await supabase.rpc("checkin_by_token", {
      p_token: token.trim(),
      p_points: points,
      p_activity_date: activityDate,
      p_note: note || null,
    });

    if (error) {
      setErr(error.message);
      setBusy(false);
      return;
    }

    setLastUserId(String(data));
    setSuccess("Check-in bol úspešný.");
    setToken("");
    setBusy(false);
  }

  if (loading) {
    return (
      <div className="card">
        <h2>Kiosk</h2>
        <p>Načítavam…</p>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="card">
        <h2>Kiosk</h2>
        <p>
          Najprv sa prihlás: <a href="/auth">Prihlásenie</a>
        </p>
      </div>
    );
  }

  if (role !== "admin") {
    return (
      <div className="card">
        <h2>Kiosk</h2>
        <p className="error">Nemáš admin práva. (role: {role})</p>
        <p className="muted">Kiosk je dostupný len adminovi.</p>
      </div>
    );
  }

  return (
    <div className="kiosk-grid">
      <section className="card">
        <h2>Kiosk check‑in</h2>
        <p className="muted">Naskenuj alebo vlož QR token a potvrď účastníka.</p>

        {err && <p className="error">{err}</p>}
        {success && <p className="success">{success}</p>}

        <form className="grid" onSubmit={submit}>
          <label className="label">
            QR token
            <input
              className="input"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="napr. 7d8f…"
            />
          </label>

          <div className="row">
            <label className="label" style={{ width: 160 }}>
              Body
              <input
                className="input"
                type="number"
                min={1}
                step={1}
                value={points}
                onChange={(e) => setPoints(Number(e.target.value))}
              />
            </label>

            <label className="label" style={{ width: 200 }}>
              Dátum
              <input
                className="input"
                type="date"
                value={activityDate}
                onChange={(e) => setActivityDate(e.target.value)}
              />
            </label>
          </div>

          <label className="label">
            Poznámka
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>

          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Odosielam…" : "Potvrdiť check‑in"}
          </button>
        </form>
      </section>

      <section className="card">
        <h3>Posledný check‑in</h3>
        {lastUserId ? (
          <div className="item">
            <div className="muted">user_id</div>
            <div className="token-value">{lastUserId}</div>
          </div>
        ) : (
          <p className="muted">Zatiaľ nič.</p>
        )}

        <div className="muted" style={{ marginTop: 10 }}>
          Tip: QR token je v Dashboarde každého dobrovoľníka.
        </div>
      </section>
    </div>
  );
}
