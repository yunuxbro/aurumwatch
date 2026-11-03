import "./globals.css";
import Link from "next/link";
import { Figtree, Bricolage_Grotesque } from "next/font/google";
import NavLinks from "@/components/NavLinks";
import Image from "next/image";
import AccountMenu from "@/components/AccountMenu";

const body = Figtree({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap" });

export const metadata = {
  title: "AurumWatch LK | Gold Risk Monitor",
  description: "Daily gold risk brief and inventory exposure engine for Sri Lankan jewellers",
  icons: { icon: "/gold-mark.svg" },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${body.variable} ${display.variable}`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body>
        <header className="site-header">
          <div className="site-header-inner">
            <Link href="/" className="brand">
              <Image className="logo-mark" src="/gold-mark.svg" alt="" width={44} height={44} />
              <div>
                <div className="brand-name">AurumWatch <span>LK</span></div>
                <div className="brand-sub">Gold price risk for Pettah jewellers</div>
              </div>
            </Link>

            <nav className="nav" aria-label="Main">
              <NavLinks />
              <AccountMenu />
            </nav>
          </div>
        </header>

        <main className="site-main">{children}</main>

        <footer className="site-footer">
          <p>
            <span className="led led-neutral" style={{ marginRight: 8 }} />
            Data quality and risk status appear in each report
          </p>
          <p>
            This tool shows risk ranges only. It is not financial advice and never tells you to buy or sell.
            Ranges are model estimates, not guarantees.
          </p>
          <p>Team Noblesse, ModelX 2.0, IEEE CIS Student Chapter, IIT</p>
        </footer>
      </body>
    </html>
  );
}