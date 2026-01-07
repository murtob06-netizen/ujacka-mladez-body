import type { Metadata } from "next";
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
  return (
    <html lang="sk">
      <body>
        <div className="container">
          {/* HLAVIČKA S OBRÁZKOM OBCE ÚDOL */}
          <header
            className="card header"
            style={{
              backgroundImage:
                "linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.45)), url(/images/obec-udol.jpg)",
              backgroundSize: "cover",
              backgroundPosition: "center",
              color: "white",
            }}
          >
            <div className="brand">
              <div className="title">Ujacka mládež</div>
              <div className="subtitle">
                Obec Údol • bodový systém dobrovoľníkov
              </div>
            </div>

            <nav className="nav">
              <a href="/" style={{ color: "white" }}>
                Dashboard
              </a>
              <a href="/leaderboard" style={{ color: "white" }}>
                Rebríček
              </a>
              <a href="/admin" style={{ color: "white" }}>
                Admin
              </a>
              <a href="/auth" style={{ color: "white" }}>
                Login
              </a>
            </nav>
          </header>

          {/* OBSAH STRÁNKY */}
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
