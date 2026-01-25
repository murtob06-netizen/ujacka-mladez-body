"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getMyProfile } from "../../lib/auth";

type Product = {
  id: number;
  name: string;
  category: string;
  price_eur: number;
  points_price: number;
  stock_qty: number;
  requires_age_check: boolean;
  is_active: boolean;
};

type UserMini = { id: string; full_name: string | null };

type CartItem = {
  product: Product;
  qty: number;
};

export default function PosPage() {
  const [role, setRole] = useState<string>("");
  const [err, setErr] = useState<string>("");
  const [ok, setOk] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<UserMini[]>([]);

  const [search, setSearch] = useState("");
  const [cat, setCat] = useState<string>("all");

  const [cart, setCart] = useState<CartItem[]>([]);
  const [payment, setPayment] = useState<"cash" | "card" | "points">("cash");
  const [customerId, setCustomerId] = useState<string>("");
  const [note, setNote] = useState<string>("");

  const [ageConfirmed, setAgeConfirmed] = useState(false);

  const categories = useMemo(() => {
    const s = new Set(products.map((p) => p.category));
    return ["all", ...Array.from(s).sort((a, b) => a.localeCompare(b))];
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((p) => p.is_active)
      .filter((p) => (cat === "all" ? true : p.category === cat))
      .filter((p) => (q ? p.name.toLowerCase().includes(q) : true))
      .sort((a, b) => (a.category + a.name).localeCompare(b.category + b.name));
  }, [products, search, cat]);

  const cartTotals = useMemo(() => {
    let eur = 0;
    let pts = 0;
    let needsAge = false;

    for (const it of cart) {
      eur += Number(it.product.price_eur) * it.qty;
      pts += Number(it.product.points_price) * it.qty;
      if (it.product.requires_age_check) needsAge = true;
    }

    return { eur, pts, needsAge };
  }, [cart]);

  function addToCart(p: Product) {
    setOk("");
    setErr("");

    setCart((prev) => {
      const i = prev.findIndex((x) => x.product.id === p.id);
      if (i >= 0) {
        const next = [...prev];
        const nextQty = next[i].qty + 1;
        if (nextQty > p.stock_qty) {
          setErr(`Na sklade nie je dosť kusov: ${p.name}`);
          return prev;
        }
        next[i] = { ...next[i], qty: nextQty };
        return next;
      }
      if (p.stock_qty <= 0) {
        setErr(`Na sklade je 0 ks: ${p.name}`);
        return prev;
      }
      return [...prev, { product: p, qty: 1 }];
    });
  }

  function inc(id: number) {
    setOk("");
    setErr("");

    setCart((prev) => {
      const i = prev.findIndex((x) => x.product.id === id);
      if (i < 0) return prev;
      const p = prev[i].product;
      const nextQty = prev[i].qty + 1;
      if (nextQty > p.stock_qty) {
        setErr(`Na sklade nie je dosť kusov: ${p.name}`);
        return prev;
      }
      const next = [...prev];
      next[i] = { ...next[i], qty: nextQty };
      return next;
    });
  }

  function dec(id: number) {
    setOk("");
    setErr("");

    setCart((prev) => {
      const i = prev.findIndex((x) => x.product.id === id);
      if (i < 0) return prev;
      const nextQty = prev[i].qty - 1;
      if (nextQty <= 0) return prev.filter((x) => x.product.id !== id);
      const next = [...prev];
      next[i] = { ...next[i], qty: nextQty };
      return next;
    });
  }

  function clearCart() {
    setCart([]);
    setNote("");
    setAgeConfirmed(false);
    setOk("");
    setErr("");
  }

  async function load() {
    setErr("");
    setOk("");
    setBusy(true);

    const { profile } = await getMyProfile();
    if (!profile) {
      setRole("");
      setBusy(false);
      return;
    }
    setRole(profile.role);

    // produkty
    const { data: pr, error: prErr } = await supabase
      .from("pos_products")
      .select("id, name, category, price_eur, points_price, stock_qty, requires_age_check, is_active")
      .order("category", { ascending: true })
      .order("name", { ascending: true });

    if (prErr) setErr(prErr.message);
    setProducts((pr ?? []) as any);

    // users (účty) – len pre výber pri platbe bodmi
    const { data: us, error: usErr } = await supabase
      .from("profiles")
      .select("id, full_name")
      .order("full_name", { ascending: true });

    if (usErr) setErr(usErr.message);
    setUsers((us ?? []) as any);

    setBusy(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkout() {
    setErr("");
    setOk("");

    if (role !== "admin" && role !== "cashier") {
      setErr("Nemáš práva pokladníka. (rola musí byť admin alebo cashier)");
      return;
    }

    if (cart.length === 0) {
      setErr("Košík je prázdny.");
      return;
    }

    if (cartTotals.needsAge && !ageConfirmed) {
      setErr("Obsahuje alkohol – musíš potvrdiť 18+.");
      return;
    }

    if (payment === "points") {
      if (!customerId) {
        setErr("Pri platbe bodmi musíš vybrať človeka (účet).");
        return;
      }
      if (cartTotals.pts <= 0) {
        setErr("Tieto položky nemajú nastavenú cenu v bodoch.");
        return;
      }
    }

    // items JSON pre RPC
    const items = cart.map((it) => ({ product_id: it.product.id, qty: it.qty }));

    setBusy(true);
    const { data, error } = await supabase.rpc("pos_create_order", {
      p_customer_id: payment === "points" ? customerId : null,
      p_payment_method: payment,
      p_items: items,
      p_note: note || "",
    });

    setBusy(false);

    if (error) {
      setErr(error.message);
      return;
    }

    const orderId = data as number;
    setOk(
      `Objednávka uložená (#${orderId}). Spolu: ${cartTotals.eur.toFixed(2)} € / ${cartTotals.pts} bodov.`
    );

    // reload produkty (kvôli skladu)
    await load();
    clearCart();
  }

  if (!role) {
    return (
      <div className="card">
        <h2>Pokladňa (POS)</h2>
        <p>
          Najprv sa prihlás: <a href="/auth">Login</a>
        </p>
      </div>
    );
  }

  if (role !== "admin" && role !== "cashier") {
    return (
      <div className="card">
        <h2>Pokladňa (POS)</h2>
        <p className="error">Nemáš práva pokladníka. (rola: {role})</p>
        <p className="muted">V Supabase → profiles nastav rolu na <b>cashier</b> alebo <b>admin</b>.</p>
      </div>
    );
  }

  return (
    <div className="grid">
      <section className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <h2>Pokladňa (POS)</h2>
            <p className="muted">Ujacka mládež • Obec Údol</p>
          </div>
          <button className="btn btn-ghost" onClick={load} disabled={busy}>
            {busy ? "Načítavam…" : "Obnoviť"}
          </button>
        </div>

        {err && <p className="error">{err}</p>}
        {ok && <p className="success">{ok}</p>}

        <div className="row" style={{ gap: 10, marginTop: 10, flexWrap: "wrap" }}>
          <input
            className="input"
            placeholder="Hľadať produkt…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ minWidth: 220 }}
          />

          <select className="select" value={cat} onChange={(e) => setCat(e.target.value)} style={{ minWidth: 200 }}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === "all" ? "Všetky kategórie" : c}
              </option>
            ))}
          </select>

          <button className="btn btn-danger" onClick={clearCart} disabled={busy}>
            Vyčistiť košík
          </button>
        </div>
      </section>

      <div className="posGrid">
        {/* Produkty */}
        <section className="card">
          <h3>Produkty</h3>
          <p className="muted">Klikni na produkt, pridá sa do košíka.</p>

          {filtered.length === 0 ? (
            <p className="muted">Žiadne produkty.</p>
          ) : (
            <div className="list" style={{ marginTop: 10 }}>
              {filtered.map((p) => (
                <div className="item" key={p.id}>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <div>
                      <b>{p.name}</b>
                      <div className="muted" style={{ marginTop: 4 }}>
                        {p.category} • sklad: {p.stock_qty}
                        {p.requires_age_check ? " • 18+" : ""}
                      </div>
                      <div className="muted" style={{ marginTop: 4 }}>
                        {Number(p.price_eur).toFixed(2)} € • {p.points_price} b
                      </div>
                    </div>

                    <button className="btn btn-primary" onClick={() => addToCart(p)} disabled={busy || p.stock_qty <= 0}>
                      Pridať
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Košík */}
        <section className="card">
          <h3>Košík</h3>

          {cart.length === 0 ? (
            <p className="muted">Košík je prázdny.</p>
          ) : (
            <div className="list" style={{ marginTop: 10 }}>
              {cart.map((it) => (
                <div className="item" key={it.product.id}>
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <b>{it.product.name}</b>
                      <div className="muted" style={{ marginTop: 4 }}>
                        {it.product.category} • {Number(it.product.price_eur).toFixed(2)} € • {it.product.points_price} b
                      </div>
                    </div>

                    <div className="row" style={{ gap: 8 }}>
                      <button className="btn btn-ghost" onClick={() => dec(it.product.id)} disabled={busy}>
                        −
                      </button>
                      <b style={{ width: 22, textAlign: "center" }}>{it.qty}</b>
                      <button className="btn btn-ghost" onClick={() => inc(it.product.id)} disabled={busy}>
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="card" style={{ marginTop: 12 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span>Spolu (€)</span>
              <b>{cartTotals.eur.toFixed(2)} €</b>
            </div>
            <div className="row" style={{ justifyContent: "space-between", marginTop: 6 }}>
              <span>Spolu (body)</span>
              <b>{cartTotals.pts} b</b>
            </div>
          </div>

          {/* Platba */}
          <div style={{ marginTop: 12 }}>
            <label className="label">
              Platba
              <select className="select" value={payment} onChange={(e) => setPayment(e.target.value as any)} disabled={busy}>
                <option value="cash">Hotovosť</option>
                <option value="card">Karta</option>
                <option value="points">Body</option>
              </select>
            </label>

            {payment === "points" && (
              <label className="label" style={{ marginTop: 10 }}>
                Účet (človek)
                <select className="select" value={customerId} onChange={(e) => setCustomerId(e.target.value)} disabled={busy}>
                  <option value="">— vyber človeka —</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name || u.id}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {cartTotals.needsAge && (
              <label className="label" style={{ marginTop: 10 }}>
                <div className="row" style={{ gap: 10, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={ageConfirmed}
                    onChange={(e) => setAgeConfirmed(e.target.checked)}
                    disabled={busy}
                  />
                  <span>Potvrdzujem, že bol overený vek 18+ (alkohol)</span>
                </div>
              </label>
            )}

            <label className="label" style={{ marginTop: 10 }}>
              Poznámka (voliteľné)
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} disabled={busy} placeholder="napr. akcia, stôl 2…" />
            </label>

            <button
              className="btn btn-primary"
              onClick={checkout}
              disabled={busy || cart.length === 0}
              style={{ marginTop: 12, width: "100%" }}
            >
              {busy ? "Ukladám…" : "Dokončiť nákup"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
