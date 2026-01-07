import type { Metadata } from "next";
import Image from "next/image";
import "./globals.css";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = {
  title: "Ujacka mládež – Body",
  description: "Bodový systém dobrovoľníkov obce Údol",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sk">
      <body>
        <div className="container">
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
                <div className="subtitle">Obec Údol • bodový systém dobrovoľníkov</div>
              </div>
            </div>

            {/* NAV (client komponent – badge) */}
            <NavBar />
          </header>

          <main style={{ marginTop: 16 }}>{children}</main>

          <footer className="footer">
            © {new Date().getFullYear()} Ujacka mládež • Obec Údol
          </footer>
        </div>
      </body>
    </html>
  );
}
