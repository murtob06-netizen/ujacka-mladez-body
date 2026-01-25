"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

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

type ProfileMini = { id: string; full_name: string | null };
type CartItem = { product: Product; qty: number };
type Payment = "cash" | "card" | "points";

export default function PosPage() {
  const [role, setRole] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<ProfileMini[]>([]);

  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("all");

  const [payment, setPayment] = useState<Payment>("cash");
  const [customerId, setCustomerId] = useState("");
  const [ageChecked, setAgeChecked] = useState(false);
  const [note, setNote] = useState("");

  const [cart, setCart] = useState<CartItem[]>([]);
  const [busy, setBusy] = useState(false);

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category));
    return ["all", ...Array.from(set)];
  }, [products]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return products.filter((p) => {
      if (!p.is_active) return false;
      if (category !== "all" && p.category !== category) return false;
      if (!s) return true;
      return p.name.toLowerCase().includes(s) || p.category.toLowerCase().includes(s);
    });
  }, [products, q, category]);

  const totals = useMemo(() => {
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

  const canCheckout = useMemo(() => {
    if (!cart.length) return false;
    if (payment === "points" && !customerId) return false;
    if (totals.needsAge && !ageChecked) return false;
    return true;
  }, [cart.length, payment, customerId, totals.needsAge, ageChecked]);

  async function load() {
    setErr("");
    setOk("");

    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) {
      setRole("");
      return;
    }

    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profErr) {
      setErr(profErr.message);
      setRole("");
      return;
    }
    setRole(prof?.role ?? "");

    const { data: prods, error: pErr } = await supabase
      .from("pos_products")
      .select("id, name, category, price_eur, points_price, stock_qty, requires_age_check, is_active")
      .eq("is_active", true)
      .order("category", { ascending: true })
      .order("name", { ascending: true });

    if (pErr) setErr(pErr.message);
    setProducts((prods ?? []) as any);

    const { data: users, error: uErr } = await supabase
      .from("profiles")
      .select("id, full_name")
      .order("full_name", { ascending: true });

    if (uErr) setErr(uErr.message);
    const arr = (users ?? []) as any[];
    setCustomers(arr as any);
    if (!customerId && arr.length) setCustomerId(arr[0].id);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function add(p: Product) {
    setErr("");
    setOk("");
    if (p.stock_qty <= 0) return setErr("Nie je sklad.");

    setCart((prev) => {
      const idx = prev.findIndex((x) => x.product.id === p.id);
      if (idx === -1) return [...prev, { product: p, qty: 1 }];
      const next = prev[idx].qty + 1;
      if (next > p.stock_qty) return prev;
      const copy = [...prev];
      copy[idx] = { ...copy[idx], qty: next };
      return copy;
    });
  }

  function setQty(productId: number, qty: number) {
    setCart((prev) => {
      const idx = prev.findIndex((x) => x.product.id === productId);
      if (idx === -1) return prev;
      if (qty <= 0) return prev.filter((x) => x.product.id !== productId);
      if (qty > prev[idx].product.stock_qty) return prev;
      const copy = [...prev];
      copy[idx] = { ...copy[idx], qty };
      return copy;
    });
  }

  function clear() {
    setCart([]);
    setAgeChecked(false);
    setNote("");
    setErr("");
    setOk("");
  }

  async function checkout() {
    setErr("");
    setOk("");
    if (!canCheckout) return setErr("Skontroluj košík / zákazníka / 18+.");

    setBusy(true);
    const items = cart.map((it) => ({ product_id: it.product.id, qty: it.qty }));

    const { data, error } = await supabase.rpc("pos_create_order", {
      p_customer_id: payment === "points" ? customerId : null,
      p_payment_method: payment,
      p_items: items,
      p_note: note || "",
    });

    if (error) {
      setErr(error.message);
      setBusy(false);
      return;
    }

    setOk(`OK – objednávka #${data}`);
    clear();
    await load();
    setBusy(false);
  }

  if (!role) {
    return (
      <div className="p-6">
        <div className="max-w-md rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">POS Pokladňa</h2>
          <p className="mt-2 text-sm text-slate-600">
            Najprv sa prihlás: <a className="underline" href="/auth">Login</a>
          </p>
        </div>
      </div>
    );
  }

  if (role !== "admin" && role !== "cashier") {
    return (
      <div className="p-6">
        <div className="max-w-md rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">POS Pokladňa</h2>
          <p className="mt-2 text-sm text-red-600">Nemáš práva (treba rolu admin alebo cashier).</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl p-4 md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Ujacka mládež – Pokladňa</h1>
            <p className="text-sm text-slate-600">Rýchly predaj • Hotovosť / Karta / Body</p>
          </div>
          <div className="flex gap-2">
            <a className="rounded-xl border bg-white px-3 py-2 text-sm shadow-sm hover:bg-slate-50" href="/pos/products">Produkty</a>
            <button className="rounded-xl border bg-white px-3 py-2 text-sm shadow-sm hover:bg-slate-50" onClick={load} disabled={busy}>
              Obnoviť
            </button>
          </div>
        </div>

        {(err || ok) && (
          <div className="mb-4 rounded-2xl border bg-white p-3 shadow-sm">
            {err && <div className="text-sm text-red-600">{err}</div>}
            {ok && <div className="text-sm text-emerald-700">{ok}</div>}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          {/* LEFT – produkty */}
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap gap-2">
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200 md:w-72"
                placeholder="Hľadať produkt…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />

              <select
                className="rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c === "all" ? "Všetky kategórie" : c}</option>
                ))}
              </select>

              <select
                className="rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                value={payment}
                onChange={(e) => setPayment(e.target.value as Payment)}
              >
                <option value="cash">Hotovosť</option>
                <option value="card">Karta</option>
                <option value="points">Body</option>
              </select>

              {payment === "points" && (
                <select
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200 md:w-72"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                >
                  <option value="">Vyber človeka…</option>
                  {customers.map((u) => (
                    <option key={u.id} value={u.id}>{u.full_name || u.id}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => add(p)}
                  disabled={busy || p.stock_qty <= 0}
                  className="group rounded-2xl border bg-white p-3 text-left shadow-sm hover:bg-slate-50 disabled:opacity-40"
                >
                  <div className="text-sm font-semibold">{p.name}</div>
                  <div className="mt-1 text-xs text-slate-600">{p.category}</div>
                  <div className="mt-2 flex items-end justify-between">
                    <div className="text-xs text-slate-600">
                      <div>€ {Number(p.price_eur).toFixed(2)}</div>
                      <div>{p.points_price} b</div>
                    </div>
                    <div className="text-xs text-slate-500">sklad: {p.stock_qty}</div>
                  </div>
                  {p.requires_age_check && (
                    <div className="mt-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800">
                      18+
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* RIGHT – košík */}
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Košík</h2>
              <button className="text-sm text-slate-600 hover:underline" onClick={clear} disabled={busy || !cart.length}>
                Vymazať
              </button>
            </div>

            {cart.length === 0 ? (
              <p className="text-sm text-slate-600">Košík je prázdny.</p>
            ) : (
              <div className="space-y-2">
                {cart.map((it) => (
                  <div key={it.product.id} className="rounded-2xl border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold">{it.product.name}</div>
                        <div className="text-xs text-slate-600">
                          € {Number(it.product.price_eur).toFixed(2)} / ks • {it.product.points_price} b / ks
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button className="rounded-xl border px-2 py-1 text-sm hover:bg-slate-50" onClick={() => setQty(it.product.id, it.qty - 1)} disabled={busy}>
                          −
                        </button>
                        <input
                          className="w-14 rounded-xl border px-2 py-1 text-center text-sm"
                          type="number"
                          min={0}
                          value={it.qty}
                          onChange={(e) => setQty(it.product.id, Number(e.target.value))}
                          disabled={busy}
                        />
                        <button className="rounded-xl border px-2 py-1 text-sm hover:bg-slate-50" onClick={() => setQty(it.product.id, it.qty + 1)} disabled={busy}>
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 rounded-2xl border bg-slate-50 p-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Spolu €</span>
                <span className="font-semibold">€ {totals.eur.toFixed(2)}</span>
              </div>
              <div className="mt-1 flex justify-between text-sm">
                <span className="text-slate-600">Spolu body</span>
                <span className="font-semibold">{totals.pts} b</span>
              </div>
            </div>

            {totals.needsAge && (
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={ageChecked} onChange={(e) => setAgeChecked(e.target.checked)} />
                <span>Overené 18+ (obsahuje alkohol)</span>
              </label>
            )}

            <label className="mt-3 block text-sm">
              <span className="text-slate-600">Poznámka</span>
              <input className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={note} onChange={(e) => setNote(e.target.value)} disabled={busy} />
            </label>

            <button
              onClick={checkout}
              disabled={busy || !canCheckout}
              className="mt-4 w-full rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
            >
              {busy ? "Ukladám…" : "Zaplatiť / Uložiť"}
            </button>

            {payment === "points" && (
              <p className="mt-2 text-xs text-slate-600">
                Pri platbe bodmi sa body odpočítajú z účtu vybraného človeka.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
