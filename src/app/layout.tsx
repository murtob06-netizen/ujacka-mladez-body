import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ujacka mládež – Body",
  description: "Bodový systém pre dobrovoľníkov združenia Ujacka mládež",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sk">
      <body style={{ fontFamily: "system-ui, Arial", margin: 0, background: "#f7f7f7" }}>
        <div style={{ maxWidth: 980, margin: "0 auto", padding: 16 }}>
          <header
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              padding: "16px 12px",
              background: "white",
              borderRadius: 12,
              boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
            }}
          >
            <div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>Ujacka mládež</div>
              <div style={{ fontSize: 12, color: "#555" }}>Bodový systém dobrovoľníkov</div>
            </div>

            <nav style={{ display: "flex", gap: 10, fontSize: 14 }}>
              <a href="/" style={{ color: "#111", textDecoration: "none" }}>Dashboard</a>
              <a href="/leaderboard" style={{ color: "#111", textDecoration: "none" }}>Rebríček</a>
              <a href="/admin" style={{ color: "#111", textDecoration: "none" }}>Admin</a>
              <a href="/auth" style={{ color: "#111", textDecoration: "none" }}>Login</a>
            </nav>
          </header>

          <main style={{ marginTop: 16 }}>{children}</main>

          <footer style={{ marginTop: 24, fontSize: 12, color: "#666" }}>
            © {new Date().getFullYear()} Ujacka mládež
          </footer>
        </div>
      </body>
    </html>
  );
}
