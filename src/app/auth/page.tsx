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

        setMsg("Registrácia hotová. Ak ti príde e-mail, potvrď ho a potom sa prihlás.");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: pass,
      });
      if (error) throw error;

      // presmerovanie po úspešnom logine
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
    <div style={{ background: "white", borderRadius: 12, padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>
        {mode === "login" ? "Prihlásenie" : "Registrácia"}
      </h2>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={() => setMode("login")}>Login</button>
        <button onClick={() => setMode("register")}>Registrácia</button>
      </div>

      {msg && <p style={{ color: "crimson" }}>{msg}</p>}

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10, maxWidth: 420 }}>
        {mode === "register" && (
          <label>
            Meno a priezvisko
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              style={{ width: "100%", padding: 8 }}
            />
          </label>
        )}

        <label>
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", padding: 8 }}
          />
        </label>

        <label>
          Heslo
          <input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            style={{ width: "100%", padding: 8 }}
          />
        </label>

        <button type="submit" disabled={busy}>
          {busy
            ? "Počkaj…"
            : mode === "login"
            ? "Prihlásiť"
            : "Registrovať"}
        </button>
      </form>

      <div style={{ marginTop: 10 }}>
        <button onClick={resetPassword}>Zabudnuté heslo</button>
      </div>
    </div>
  );
}
