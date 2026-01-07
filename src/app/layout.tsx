import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ujacka mládež – Body",
  description: "Bodový systém pre dobrovoľníkov združenia Ujacka mládež",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sk">
      <body>
        <div className="container">
          <header className="card header">
            <div className="brand">
              <div className="title">Ujacka mládež</div>
              <div className="subtitle">Bodový systém dobrovoľníkov</div>
            </div>

            <nav className="nav">
              <a href="/">Dashboard</a>
              <a href="/leaderboard">Rebríček</a>
              <a href="/admin">Admin</a>
              <a href="/auth">Login</a>
            </nav>
          </header>

          <main style={{ marginTop: 16 }}>{children}</main>

          <div className="footer">© {new Date().getFullYear()} Ujacka mládež</div>
        </div>
      </body>
    </html>
  );
}
