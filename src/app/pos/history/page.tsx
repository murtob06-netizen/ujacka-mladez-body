"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Role = "" | "admin" | "cashier" | "volunteer";

type OrderItemRow = {
  id: number;
  qty: number;
  line_eur: number;
  line_cost_eur: number;
  unit_price_eur: number;
  unit_cost_eur: number;
  product_id: number;
  pos_products?: { name: string } | null;
};

type OrderRow = {
  id: number;
  created_at: string;
  payment_method: "cash" | "card" | "points";
  total_eur: number;
  note: string;
  pos_order_items: OrderItemRow[];
};

function toISODateLocal(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function PosHistoryPage() {
  const [role, setRole] = useState<Role>("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const [date, setDate] = useState<string>(() => toISODateLocal(new Date()));
  const [orders, setOrders] = useState<OrderRow[]>([]);

  const summary = useMemo(() => {
    // len € = len cash/card (nie points)
    const eurOrders = orders.filter((o) => o.payment_method === "cash" || o.payment_method === "card");

    let revenue = 0;
    let cost = 0;
    let count = eurOrders.length;

    for (const o of eurOrders) {
      for (const it of o.pos_order_items || []) {
        revenue += Number(it.line_eur ?? 0);
        cost += Number(it.line_cost_eur ?? 0);
      }
    }

    const profit = revenue - cost;
    return { revenue, cost, profit, count };
  }, [orders]);

  async function load() {
    setErr("");
    setBusy(true);

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr) {
      setErr(authErr.message);
      setRole("");
      setBusy(false);
      return;
    }
    const user = authData.user;
    if (!user) {
      setRole("");
      setBusy(false);
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
      setBusy(false);
      return;
    }

    const r = (prof?.role ?? "") as Role;
    setRole(r);

    if (r !== "admin" && r !== "cashier") {
      setBusy(false);
      return;
    }

    const start = `${date}T00:00:00`;
    const end = `${date}T23:59:59.999`;

    // Zober objednávky za deň + položky + názvy produktov
    const { data, error } = await supabase
      .from("pos_orders")
      .select(
        "id, created_at, payment_method, total_eur, note, pos_order_items(id, qty, line_eur, line_cost_eur, unit_price_eur, unit_cost_eur, product_id, pos_products(name))"
      )
      .gte("created_at", start)
      .lte("created_at", end)
      .order("created_at", { ascending: false });

    if (error) setErr(error.message);
    setOrders((data ?? []) as any);

    setBusy(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  if (!role) {
    return (
      <div className="card">
        <h2>POS – Denný zisk</h2>
        <p>
          Najprv sa prihlás: <a href="/auth">Login</a>
        </p>
      </div>
    );
  }

  if (role !== "admin" && role !== "cashier") {
    return (
      <div className="card">
        <h2>POS – Denný zisk</h2>
        <p className="error">Nemáš práva (treba rolu admin alebo cashier).</p>
      </div>
    );
  }

  return (
    <div className="grid">
      <section className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <h2>POS – Denný zisk (len €)</h2>
            <p className="muted">Rátame iba objednávky platené hotovosťou/kartou (platby bodmi sa nerátajú).</p>
          </div>
          <div className="row">
            <a className="btn btn-ghost" href="/pos">
              Pokladňa
            </a>
            <a className="btn btn-ghost" href="/pos/products">
              Produkty
            </a>
            <button className="btn btn-ghost" onClick={load} disabled={busy}>
              Obnoviť
            </button>
          </div>
        </div>

        {err && <p className="error">{err}</p>}

        <div className="row" style={{ gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <label className="label">
            Dátum
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>

          <div className="card" style={{ padding: 12, minWidth: 260 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="muted">Objednávok (€)</span>
              <b>{summary.count}</b>
            </div>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="muted">Tržba</span>
              <b>€ {summary.revenue.toFixed(2)}</b>
            </div>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="muted">Náklad</span>
              <b>€ {summary.cost.toFixed(2)}</b>
            </div>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="muted">Zisk</span>
              <b>€ {summary.profit.toFixed(2)}</b>
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <h3>Objednávky v daný deň</h3>
        {orders.length === 0 ? (
          <p className="muted">Žiadne objednávky.</p>
        ) : (
          <div className="list" style={{ marginTop: 10 }}>
            {orders.map((o) => {
              const isEuro = o.payment_method === "cash" || o.payment_method === "card";
              let rev = 0;
              let cost = 0;
              for (const it of o.pos_order_items || []) {
                rev += Number(it.line_eur ?? 0);
                cost += Number(it.line_cost_eur ?? 0);
              }
              const profit = rev - cost;

              const time = new Date(o.created_at).toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" });

              return (
                <div className="item" key={o.id}>
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <b>#{o.id}</b> <span className="muted">({time})</span>{" "}
                      <span className="muted">• platba: {o.payment_method}</span>
                      {!isEuro && <span className="muted"> • (nepočíta sa do € zisku)</span>}
                      {o.note ? <div className="muted" style={{ marginTop: 4 }}>Pozn.: {o.note}</div> : null}
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div className="muted">Tržba</div>
                      <b>€ {rev.toFixed(2)}</b>
                      <div className="muted" style={{ marginTop: 4 }}>Náklad: € {cost.toFixed(2)}</div>
                      <div className="muted">Zisk: € {profit.toFixed(2)}</div>
                    </div>
                  </div>

                  <div className="muted" style={{ marginTop: 8 }}>
                    {o.pos_order_items?.map((it) => (
                      <div key={it.id}>
                        • {it.pos_products?.name ?? `Produkt #${it.product_id}`} — {it.qty} ks — €
                        {Number(it.line_eur ?? 0).toFixed(2)} (náklad €{Number(it.line_cost_eur ?? 0).toFixed(2)})
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
