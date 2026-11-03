"use client";
import { useEffect, useSyncExternalStore } from "react";

function getTheme() {
  const saved = localStorage.getItem("aw-theme");
  return saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches);
}

function subscribeTheme(onChange) {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const notify = () => onChange();
  const onStorage = (event) => {
    if (event.key === "aw-theme") notify();
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener("aw-theme-change", notify);
  mediaQuery.addEventListener("change", notify);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("aw-theme-change", notify);
    mediaQuery.removeEventListener("change", notify);
  };
}

function getServerTheme() {
  return false;
}

export default function ThemeToggle() {
  const dark = useSyncExternalStore(subscribeTheme, getTheme, getServerTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("aw-theme", next ? "dark" : "light");
    window.dispatchEvent(new Event("aw-theme-change"));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="btn-theme"
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle colour theme"
    >
      {dark ? (
        /* Sun icon */
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4"/>
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
        </svg>
      ) : (
        /* Moon icon */
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/>
        </svg>
      )}
    </button>
  );
}
