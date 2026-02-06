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
type TabRow = {
  id: number;
  label: string;
  status: "open" | "closed";
  created_at: string;
  note: string | null;
};
type TabItemRow = {
  id: number;
  qty: number;
  product_id: number;
  pos_products?: Product | null;
};
type RecentOrderRow = {
  id: number;
  created_at: string;
  payment_method: Payment;
  pos_order_items: { qty: number; product_id: number; pos_products?: Product | null }[];
};

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
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerBalance, setCustomerBalance] = useState<number | null>(null);
  const [ageChecked, setAgeChecked] = useState(false);
  const [note, setNote] = useState("");

  const [cart, setCart] = useState<CartItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [recentOrders, setRecentOrders] = useState<RecentOrderRow[]>([]);

  const [tabs, setTabs] = useState<TabRow[]>([]);
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  const [tabItems, setTabItems] = useState<TabItemRow[]>([]);
  const [tabLabel, setTabLabel] = useState("");
  const [tabMode, setTabMode] = useState(false);
  const [tabPayment, setTabPayment] = useState<"cash" | "card">("cash");

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

  const filteredCustomers = useMemo(() => {
    const s = customerQuery.trim().toLowerCase();
    if (!s) return customers;
    return customers.filter((c) => (c.full_name || "").toLowerCase().includes(s));
  }, [customers, customerQuery]);

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

  const tabTotals = useMemo(() => {
    let eur = 0;
    let pts = 0;
    let needsAge = false;
    for (const it of tabItems) {
      const p = it.pos_products;
      if (!p) continue;
      eur += Number(p.price_eur) * it.qty;
      pts += Number(p.points_price) * it.qty;
      if (p.requires_age_check) needsAge = true;
    }
    return { eur, pts, needsAge };
  }, [tabItems]);

  const canCheckout = useMemo(() => {
    if (!cart.length) return false;
    if (payment === "points" && !customerId) return false;
    if (totals.needsAge && !ageChecked) return false;
    return true;
  }, [cart.length, payment, customerId, totals.needsAge, ageChecked]);

  const canCloseTab = useMemo(() => {
    if (!activeTabId) return false;
    if (!tabItems.length) return false;
    if (tabTotals.needsAge && !ageChecked) return false;
    return true;
  }, [activeTabId, tabItems.length, tabTotals.needsAge, ageChecked]);

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

    const { data: recent, error: rErr } = await supabase
      .from("pos_orders")
      .select("id, created_at, payment_method, pos_order_items(qty, product_id, pos_products(id, name, category, price_eur, points_price, stock_qty, requires_age_check, is_active))")
      .order("created_at", { ascending: false })
      .limit(5);

    if (rErr) setErr(rErr.message);
    setRecentOrders((recent ?? []) as any);

    const { data: tabRows, error: tErr } = await supabase
      .from("pos_tabs")
      .select("id, label, status, created_at, note")
      .eq("status", "open")
      .order("created_at", { ascending: false });

    if (tErr) setErr(tErr.message);
    setTabs((tabRows ?? []) as any);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeTabId) {
      setTabItems([]);
      return;
    }

    loadTabItems(activeTabId);
  }, [activeTabId]);

  useEffect(() => {
    if (!customerId || payment !== "points") {
      setCustomerBalance(null);
      return;
    }

    (async () => {
      const { data, error } = await supabase
        .from("user_balances")
        .select("user_id, balance")
        .eq("user_id", customerId)
        .single();
      if (error) return setErr(error.message);
      setCustomerBalance(data?.balance ?? null);
    })();
  }, [customerId, payment]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        if (!busy && canCheckout && !tabMode) checkout();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, canCheckout, tabMode]);

  function add(p: Product) {
    setErr("");
    setOk("");
    if (p.stock_qty <= 0) return setErr("Nie je sklad.");

    if (tabMode && activeTabId) {
      addToTab(activeTabId, p.id, 1);
      return;
    }

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

  async function loadTabItems(tabId: number) {
    const { data, error } = await supabase
      .from("pos_tab_items")
      .select("id, qty, product_id, pos_products(id, name, category, price_eur, points_price, stock_qty, requires_age_check, is_active)")
      .eq("tab_id", tabId)
      .order("id", { ascending: true });

    if (error) setErr(error.message);
    setTabItems((data ?? []) as any);
  }

  async function addToTab(tabId: number, productId: number, qty: number) {
    setErr("");
    const { error } = await supabase.rpc("pos_tab_add_item", {
      p_tab_id: tabId,
      p_product_id: productId,
      p_qty: qty,
    });
    if (error) setErr(error.message);
    await loadTabItems(tabId);
    setActiveTabId(tabId);
  }

  async function setTabQty(tabItemId: number, qty: number) {
    setErr("");
    const { error } = await supabase.rpc("pos_tab_set_qty", {
      p_tab_item_id: tabItemId,
      p_qty: qty,
    });
    if (error) setErr(error.message);
    if (activeTabId) await loadTabItems(activeTabId);
  }

  async function createTab() {
    setErr("");
    const label = tabLabel.trim();
    if (!label) return setErr("Zadaj meno účtu.");
    const { data, error } = await supabase
      .from("pos_tabs")
      .insert({ label, status: "open" })
      .select("id")
      .single();
    if (error) return setErr(error.message);
    setTabLabel("");
    setActiveTabId(data.id);
    setTabMode(true);
    await load();
  }

  async function closeTab() {
    if (!activeTabId) return;
    setErr("");
    setBusy(true);
    const { data, error } = await supabase.rpc("pos_close_tab", {
      p_tab_id: activeTabId,
      p_payment_method: tabPayment,
      p_note: note || "",
    });
    if (error) {
      setErr(error.message);
      setBusy(false);
      return;
    }
    setOk(`Účet uzavretý – objednávka #${data}`);
    setActiveTabId(null);
    setTabItems([]);
    setTabMode(false);
    setNote("");
    await load();
    setBusy(false);
  }

  async function moveCartToTab() {
    if (!activeTabId || !cart.length) return;
    setErr("");
    for (const it of cart) {
      // eslint-disable-next-line no-await-in-loop
      await addToTab(activeTabId, it.product.id, it.qty);
    }
    clear();
  }

  function applyRecentOrder(o: RecentOrderRow) {
    if (!o?.pos_order_items) return;
    const items: CartItem[] = [];
    for (const it of o.pos_order_items) {
      if (!it.pos_products) continue;
      items.push({ product: it.pos_products as Product, qty: it.qty });
    }
    setCart(items);
    setTabMode(false);
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

              <div className="flex flex-wrap gap-2">
                <button
                  className={`rounded-xl border px-3 py-2 text-sm shadow-sm ${payment === "cash" ? "bg-black text-white" : "bg-white hover:bg-slate-50"}`}
                  onClick={() => setPayment("cash")}
                  type="button"
                >
                  Hotovosť
                </button>
                <button
                  className={`rounded-xl border px-3 py-2 text-sm shadow-sm ${payment === "card" ? "bg-black text-white" : "bg-white hover:bg-slate-50"}`}
                  onClick={() => setPayment("card")}
                  type="button"
                >
                  Karta
                </button>
                <button
                  className={`rounded-xl border px-3 py-2 text-sm shadow-sm ${payment === "points" ? "bg-black text-white" : "bg-white hover:bg-slate-50"}`}
                  onClick={() => setPayment("points")}
                  type="button"
                >
                  Body
                </button>
              </div>

              {payment === "points" && (
                <div className="grid w-full gap-2 md:w-72">
                  <input
                    className="rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                    placeholder="Hľadať človeka…"
                    value={customerQuery}
                    onChange={(e) => setCustomerQuery(e.target.value)}
                  />
                  <select
                    className="rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                  >
                    <option value="">Vyber človeka…</option>
                    {filteredCustomers.map((u) => (
                      <option key={u.id} value={u.id}>{u.full_name || u.id}</option>
                    ))}
                  </select>
                  {customerBalance !== null && (
                    <div className="rounded-xl border bg-slate-50 px-3 py-2 text-xs text-slate-700">
                      Zostatok: <b>{customerBalance} b</b>
                    </div>
                  )}
                </div>
              )}
            </div>

            {recentOrders.length > 0 && (
              <div className="mb-3 rounded-2xl border bg-slate-50 p-3">
                <div className="mb-2 text-xs font-semibold text-slate-700">Posledné nákupy (rýchly košík)</div>
                <div className="flex flex-wrap gap-2">
                  {recentOrders.slice(0, 3).map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      className="rounded-xl border bg-white px-3 py-2 text-xs shadow-sm hover:bg-slate-50"
                      onClick={() => applyRecentOrder(o)}
                    >
                      #{o.id} • {o.payment_method}
                    </button>
                  ))}
                </div>
              </div>
            )}

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
                    <div className={`text-xs ${p.stock_qty <= 5 ? "text-amber-700" : "text-slate-500"}`}>
                      sklad: {p.stock_qty}
                    </div>
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

          {/* RIGHT – účty + košík + posledné transakcie */}
          <div className="space-y-3">
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Otvorené účty</h2>
                <button
                  className={`rounded-xl border px-2 py-1 text-xs ${tabMode ? "bg-black text-white" : "bg-white"}`}
                  onClick={() => setTabMode((v) => !v)}
                  type="button"
                >
                  {tabMode ? "Režim účtu" : "Režim košíka"}
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <input
                  className="flex-1 rounded-xl border px-3 py-2 text-sm"
                  placeholder="Meno účtu (napr. Stôl 2)"
                  value={tabLabel}
                  onChange={(e) => setTabLabel(e.target.value)}
                />
                <button className="rounded-xl border bg-white px-3 py-2 text-sm shadow-sm hover:bg-slate-50" onClick={createTab} type="button">
                  Otvoriť
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {tabs.length === 0 ? (
                  <span className="text-xs text-slate-600">Žiadne otvorené účty.</span>
                ) : (
                  tabs.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`rounded-xl border px-3 py-2 text-xs ${activeTabId === t.id ? "bg-black text-white" : "bg-white hover:bg-slate-50"}`}
                      onClick={() => {
                        setActiveTabId(t.id);
                        setTabMode(true);
                      }}
                    >
                      {t.label}
                    </button>
                  ))
                )}
              </div>

              {activeTabId && (
                <div className="mt-3 rounded-2xl border bg-slate-50 p-3">
                  <div className="mb-2 text-xs font-semibold text-slate-700">Položky účtu</div>
                  {tabItems.length === 0 ? (
                    <p className="text-xs text-slate-600">Účet je prázdny.</p>
                  ) : (
                    <div className="space-y-2">
                      {tabItems.map((it) => (
                        <div key={it.id} className="rounded-xl border bg-white p-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs font-semibold">{it.pos_products?.name ?? `Produkt #${it.product_id}`}</div>
                            <div className="flex items-center gap-1">
                              <button
                                className="rounded-lg border px-2 py-1 text-xs"
                                onClick={() => setTabQty(it.id, it.qty - 1)}
                                type="button"
                              >
                                −
                              </button>
                              <span className="min-w-[24px] text-center text-xs">{it.qty}</span>
                              <button
                                className="rounded-lg border px-2 py-1 text-xs"
                                onClick={() => setTabQty(it.id, it.qty + 1)}
                                type="button"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <div className="text-xs text-slate-600">
                      Spolu € <b>{tabTotals.eur.toFixed(2)}</b> • {tabTotals.pts} b
                    </div>
                    <div className="flex gap-2">
                      <button
                        className={`rounded-xl border px-2 py-1 text-xs ${tabPayment === "cash" ? "bg-black text-white" : "bg-white"}`}
                        onClick={() => setTabPayment("cash")}
                        type="button"
                      >
                        Hotovosť
                      </button>
                      <button
                        className={`rounded-xl border px-2 py-1 text-xs ${tabPayment === "card" ? "bg-black text-white" : "bg-white"}`}
                        onClick={() => setTabPayment("card")}
                        type="button"
                      >
                        Karta
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className="rounded-xl border bg-white px-3 py-2 text-xs shadow-sm hover:bg-slate-50"
                      onClick={moveCartToTab}
                      type="button"
                      disabled={!cart.length}
                    >
                      Preniesť košík do účtu
                    </button>
                    <button
                      className="rounded-xl bg-black px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40"
                      onClick={closeTab}
                      type="button"
                      disabled={busy || !canCloseTab}
                    >
                      {busy ? "Ukladám…" : "Zaplatiť účet"}
                    </button>
                  </div>
                </div>
              )}
            </div>

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

            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="mb-2 text-sm font-semibold">Posledné transakcie</div>
              {recentOrders.length === 0 ? (
                <p className="text-xs text-slate-600">Zatiaľ nič.</p>
              ) : (
                <div className="space-y-2">
                  {recentOrders.slice(0, 5).map((o) => {
                    const time = new Date(o.created_at).toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" });
                    return (
                      <div key={o.id} className="rounded-xl border bg-slate-50 px-3 py-2 text-xs">
                        #{o.id} • {time} • {o.payment_method}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
