"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [msg, setMsg] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setBusy(true);

    try {
      if (mode === "register") {
        const { error } = await supabase.auth.signUp({
          email,
          password: pass,
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;

        setMsg("Registrácia hotová. Skontroluj e-mail a potvrď ho, potom sa prihlás.");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) throw error;

      router.push("/");
      router.refresh();
    } catch (err: any) {
      console.error(err);
      setMsg(err?.message ? String(err.message) : "Nastala chyba pri prihlásení.");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    setMsg("");
    if (!email) return setMsg("Najprv zadaj e-mail.");

    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) return setMsg(error.message);

    setMsg("Odoslal som e-mail na reset hesla.");
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>{mode === "login" ? "Prihlásenie" : "Registrácia"}</h2>
      <p className="muted">Použi účet dobrovoľníka Ujacka mládež.</p>

      <div className="row" style={{ marginTop: 10 }}>
        <button className={`btn ${mode === "login" ? "btn-primary" : ""}`} onClick={() => setMode("login")}>
          Login
        </button>
        <button className={`btn ${mode === "register" ? "btn-primary" : ""}`} onClick={() => setMode("register")}>
          Registrácia
        </button>
      </div>

      {msg && (
        <p className={msg.toLowerCase().includes("hotová") || msg.toLowerCase().includes("odoslal") ? "success" : "error"} style={{ marginTop: 10 }}>
          {msg}
        </p>
      )}

      <form onSubmit={onSubmit} className="grid" style={{ marginTop: 12, maxWidth: 420 }}>
        {mode === "register" && (
          <label className="label">
            Meno a priezvisko
            <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </label>
        )}

        <label className="label">
          E-mail
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>

        <label className="label">
          Heslo
          <input className="input" type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
        </label>

        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "Počkaj…" : mode === "login" ? "Prihlásiť" : "Registrovať"}
        </button>
      </form>

      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn btn-ghost" onClick={resetPassword}>
          Zabudnuté heslo
        </button>
      </div>
    </div>
  );
}
