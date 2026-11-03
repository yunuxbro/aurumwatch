"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const PRIMARY_NAV = [
  ["/", "Overview"],
  ["/prices", "Prices"],
  ["/risk", "Exposure"],
  ["/design", "Design studio"],
  ["/changes", "Market history"],
];

export default function NavLinks() {
  const path = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef(null);

  useEffect(() => {
    function closeOnOutsideClick(event) {
      if (!navRef.current?.contains(event.target)) {
        setMoreOpen(false);
        setMobileOpen(false);
      }
    }
    function closeOnEscape(event) {
      if (event.key === "Escape") {
        setMoreOpen(false);
        setMobileOpen(false);
      }
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <div ref={navRef} className={`nav-links${mobileOpen ? " nav-links-mobile-open" : ""}`}>
      <button
        type="button"
        className="nav-mobile-trigger"
        aria-expanded={mobileOpen}
        aria-controls="primary-navigation"
        onClick={() => setMobileOpen((open) => !open)}
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
          {mobileOpen
            ? <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            : <path d="M3 5.5h14M3 10h14M3 14.5h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />}
        </svg>
        <span>{mobileOpen ? "Close" : "Menu"}</span>
      </button>
      <div id="primary-navigation" className={`nav-primary-links${mobileOpen ? " nav-primary-links-open" : ""}`}>
        {PRIMARY_NAV.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className={`nav-link${path === href ? " active" : ""}`}
            aria-current={path === href ? "page" : undefined}
            onClick={() => {
              setMoreOpen(false);
              setMobileOpen(false);
            }}
          >
            {label}
          </Link>
        ))}
        <div className={`nav-more${path === "/health" ? " nav-more-active" : ""}${moreOpen ? " nav-more-open" : ""}`}>
          <button
            type="button"
            className="nav-link nav-more-trigger"
            aria-expanded={moreOpen}
            aria-haspopup="true"
            onClick={() => setMoreOpen((open) => !open)}
          >
            More
            <svg aria-hidden="true" viewBox="0 0 16 16" fill="none">
              <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          <div
            className={`nav-more-menu${moreOpen ? " nav-more-menu-open" : ""}`}
            aria-hidden={!moreOpen}
            inert={!moreOpen}
          >
            <Link
              href="/health"
              className={`nav-more-item${path === "/health" ? " active" : ""}`}
              aria-current={path === "/health" ? "page" : undefined}
              onClick={() => {
                setMoreOpen(false);
                setMobileOpen(false);
              }}
            >
              <strong>Data health</strong>
              <span>Sources, freshness, and validation</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}