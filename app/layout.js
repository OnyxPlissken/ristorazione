import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "Coperto",
  description:
    "Restaurant operations platform for reservations, QR ordering, delivery orchestration, and guest analytics."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="site-frame">
          <header className="site-header">
            <Link className="brand" href="/">
              Coperto
            </Link>
            <nav className="site-nav">
              <Link href="/ops">Ops Hub</Link>
              <Link href="/table/milano-12">QR Table Demo</Link>
              <a href="#roadmap">Roadmap</a>
            </nav>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
