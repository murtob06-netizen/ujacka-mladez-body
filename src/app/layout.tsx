"use client";

import type { Metadata } from "next";
import Image from "next/image";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ujacka mládež – Body",
  description: "Bodový systém dobrovoľníkov obce Údol",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [pendingCount, setPendingCount] = useState<number>(0);

  useEffect(() => {
    (async () => {
      const { count } = await supabase
        .from("point_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");

      setPendingCount(count ?? 0);
    })();
  }, []);

  return (
    <html lang="sk">
      <body>
        <div className="container">
          {/* HLAVIČKA */}
          <header
            className="card header header-hero"
            style={{
              backgroundImage:
                "linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.45)), url(/images/obec-udol.jpg)",
              backgroundSize: "cover",
              backgroundPosition: "center",
              color: "white",
            }}
          >
            {/* BRAND */}
            <div className="brand brand-row">
              <div className="crest">
                <Image
                  src="/images/erb-udol.png"
                  alt="Erb obce Údol"
                  width={56}
                  height={56}
                  priority
                />
              </div>

              <div className="brand-text">
                <div className="title">Ujacka mládež</div>
                <div className="subtitle">
                  Obec Údol • bodový systém dobrovoľníkov
                </div>
              </div>
            </div>

            {/* NAV */}
            <nav className="nav nav-hero">
              <a href="/">Dashboard</a>
              <a href="/leaderboard">Rebríček</a>

              <a href="/admin">
                Admin
                {pendingCount > 0 && (
                  <span
                    style={{
                      marginLeft: 6,
                      background: "#dc2626",
                      color: "white",
                      borderRadius: 999,
                      padding: "2px 8px",
                      fontSize: 12,
                      fontWeight: 900,
                    }}
                  >
                    {pendingCount}
                  </span>
                )}
              </a>

              <a href="/auth">Login</a>
            </nav>
          </header>

          {/* OBSAH */}
          <main style={{ marginTop: 16 }}>{children}</main>

          {/* PÄTIČKA */}
          <footer className="footer">
            © {new Date().getFullYear()} Ujacka mládež • Obec Údol
          </footer>
        </div>
      </body>
    </html>
  );
}
