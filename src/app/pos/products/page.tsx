"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Product = {
  id: number;
  name: string;
  category: string;
  price_eur: number;
  cost_eur: number;
  points_price: number;
  stock_qty: number;
  requires_age_check: boolean;
  is_active: boolean;
  created_at: string;
};

export default function PosProductsPage() {
  const [role, setRole] = useState<string>("");
  const [err, setErr] = useState<string>("");
  const [ok, setOk] = useState<string>("");

  const [products, setProducts] = useState<Product[]>([]);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    name: "",
    category: "voda",
    price_eur: 1,
    cost_eur: 0.5,
    points_price: 10,
    stock_qty: 0,
    requires_age_check: false,
    is_active: true,
  });

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category));
    return Array.from(set);
  }, [products]);

  async function load() {
    setErr("");
    setOk("");

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr) {
      setErr(authErr.message);
      setRole("");
      return;
    }
    const user = authData.user;
    if (!user) {
      setRole("");
      return;
    }

    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single();

    if (profErr) {
      setErr(profErr.message);
      setRole("");
      return;
    }

    setRole(prof?.role ?? "");

    const { data, error } = await supabase
      .from("pos_products")
      .select(
        "id, name, category, price_eur, cost_eur, points_price, stock_qty, requires_age_check, is_active, created_at"
      )
      .order("category", { ascending: true })
      .order("name", { ascending: true });

    if (error) setErr(error.message);
    setProducts((data ?? []) as any);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!role) {
    return (
      <div className="card">
        <h2>POS Produkty</h2>
        <p>
          Najprv sa prihlás: <a href="/auth">Login</a>
        </p>
      </div>
    );
  }

  if (role !== "admin" && role !== "cashier") {
    return (
      <div className="card">
        <h2>POS Produkty</h2>
        <p className="error">Nemáš práva (treba rolu admin alebo cashier).</p>
        <p className="muted">Rolu nastavíš v Supabase → profiles → role.</p>
      </div>
    );
  }

  async function createProduct(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setOk("");
    setBusy(true);

    const { error } = await supabase.from("pos_products").insert({
      ...form,
    });

    if (error) setErr(error.message);
    else setOk("Produkt pridaný.");

    setBusy(false);
    await load();
  }

  async function updateProduct(id: number, patch: Partial<Product>) {
    setErr("");
    setOk("");
    setBusy(true);

    const { error } = await supabase.from("pos_products").update(patch).eq("id", id);

    if (error) setErr(error.message);
    else setOk("Uložené.");

    setBusy(false);
    await load();
  }

  return (
    <div className="grid">
      <section className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <h2>POS – Produkty</h2>
            <p className="muted">
              Nastav nákupnú cenu (cost) + predajnú cenu (price) a potom sa dá počítať zisk za deň.
            </p>
          </div>
          <div className="row">
            <a className="btn btn-ghost" href="/pos">
              Pokladňa
            </a>
            <a className="btn btn-ghost" href="/pos/history">
              Denný zisk
            </a>
            <button className="btn btn-ghost" onClick={load} disabled={busy}>
              Obnoviť
            </button>
          </div>
        </div>

        {err && <p className="error">{err}</p>}
        {ok && <p style={{ marginTop: 8 }}>{ok}</p>}

        <h3 style={{ marginTop: 10 }}>Pridať produkt</h3>
        <form onSubmit={createProduct} className="grid" style={{ maxWidth: 720 }}>
          <label className="label">
            Názov
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>

          <label className="label">
            Kategória
            <input
              className="input"
              list="cats"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
            <datalist id="cats">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <label className="label" style={{ width: 200 }}>
              Predaj € (za kus)
              <input
                className="input"
                type="number"
                min={0}
                step={0.01}
                value={form.price_eur}
                onChange={(e) => setForm({ ...form, price_eur: Number(e.target.value) })}
              />
            </label>

            <label className="label" style={{ width: 200 }}>
              Nákup € (za kus)
              <input
                className="input"
                type="number"
                min={0}
                step={0.01}
                value={form.cost_eur}
                onChange={(e) => setForm({ ...form, cost_eur: Number(e.target.value) })}
              />
            </label>

            <label className="label" style={{ width: 200 }}>
              Cena body (za kus)
              <input
                className="input"
                type="number"
                min={0}
                step={1}
                value={form.points_price}
                onChange={(e) => setForm({ ...form, points_price: Number(e.target.value) })}
              />
            </label>

            <label className="label" style={{ width: 200 }}>
              Sklad (ks)
              <input
                className="input"
                type="number"
                min={0}
                step={1}
                value={form.stock_qty}
                onChange={(e) => setForm({ ...form, stock_qty: Number(e.target.value) })}
              />
            </label>
          </div>

          <label className="row" style={{ gap: 10 }}>
            <input
              type="checkbox"
              checked={form.requires_age_check}
              onChange={(e) => setForm({ ...form, requires_age_check: e.target.checked })}
            />
            <span>Vyžaduje 18+ (alkohol)</span>
          </label>

          <label className="row" style={{ gap: 10 }}>
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            <span>Aktívny produkt</span>
          </label>

          <button className="btn btn-primary" type="submit" disabled={busy || !form.name.trim()}>
            Pridať
          </button>
        </form>
      </section>

      <section className="card">
        <h3>Zoznam produktov</h3>
        {products.length === 0 ? (
          <p className="muted">Zatiaľ nič.</p>
        ) : (
          <div className="list" style={{ marginTop: 10 }}>
            {products.map((p) => {
              const profitPerPiece = Number(p.price_eur) - Number(p.cost_eur);
              return (
                <div className="item" key={p.id}>
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <b>{p.name}</b> <span className="muted">({p.category})</span>
                      <div className="muted" style={{ marginTop: 4 }}>
                        Predaj: € {Number(p.price_eur).toFixed(2)} • Nákup: € {Number(p.cost_eur).toFixed(2)} •
                        Zisk/ks: € {profitPerPiece.toFixed(2)} • Body: {p.points_price} • Sklad: {p.stock_qty}
                        {p.requires_age_check ? " • 18+" : ""} • {p.is_active ? "aktívny" : "neaktívny"}
                      </div>
                    </div>

                    <div className="row" style={{ gap: 8 }}>
                      <button
                        className="btn btn-ghost"
                        disabled={busy}
                        onClick={() => updateProduct(p.id, { stock_qty: p.stock_qty + 1 } as any)}
                      >
                        +1 sklad
                      </button>
                      <button
                        className="btn btn-ghost"
                        disabled={busy || p.stock_qty <= 0}
                        onClick={() => updateProduct(p.id, { stock_qty: p.stock_qty - 1 } as any)}
                      >
                        -1 sklad
                      </button>
                      <button
                        className="btn btn-primary"
                        disabled={busy}
                        onClick={() => updateProduct(p.id, { is_active: !p.is_active } as any)}
                      >
                        {p.is_active ? "Vypnúť" : "Zapnúť"}
                      </button>
                    </div>
                  </div>

                  <div className="row" style={{ gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                    <label className="label" style={{ width: 180 }}>
                      Predaj €
                      <input
                        className="input"
                        type="number"
                        min={0}
                        step={0.01}
                        defaultValue={Number(p.price_eur)}
                        onBlur={(e) => updateProduct(p.id, { price_eur: Number(e.target.value) } as any)}
                        disabled={busy}
                      />
                    </label>

                    <label className="label" style={{ width: 180 }}>
                      Nákup €
                      <input
                        className="input"
                        type="number"
                        min={0}
                        step={0.01}
                        defaultValue={Number(p.cost_eur)}
                        onBlur={(e) => updateProduct(p.id, { cost_eur: Number(e.target.value) } as any)}
                        disabled={busy}
                      />
                    </label>

                    <label className="label" style={{ width: 180 }}>
                      Cena body
                      <input
                        className="input"
                        type="number"
                        min={0}
                        step={1}
                        defaultValue={Number(p.points_price)}
                        onBlur={(e) => updateProduct(p.id, { points_price: Number(e.target.value) } as any)}
                        disabled={busy}
                      />
                    </label>

                    <label className="label" style={{ width: 220 }}>
                      Kategória
                      <input
                        className="input"
                        defaultValue={p.category}
                        onBlur={(e) => updateProduct(p.id, { category: e.target.value } as any)}
                        disabled={busy}
                      />
                    </label>
                  </div>

                  <label className="row" style={{ gap: 10, marginTop: 10 }}>
                    <input
                      type="checkbox"
                      checked={p.requires_age_check}
                      onChange={(e) => updateProduct(p.id, { requires_age_check: e.target.checked } as any)}
                      disabled={busy}
                    />
                    <span>18+ (alkohol)</span>
                  </label>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
