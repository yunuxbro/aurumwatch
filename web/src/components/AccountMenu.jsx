"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { accountRequest } from "@/lib/account-api";

function PersonIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="3.3" />
      <path d="M5.2 20a6.8 6.8 0 0 1 13.6 0" />
    </svg>
  );
}

export default function AccountMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const menuRef = useRef(null);
  const [account, setAccount] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [theme, setTheme] = useState("light");
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function closeOnOutsideClick(event) {
      if (!menuRef.current?.contains(event.target)) {
        setOpen(false);
        if (menuRef.current?.contains(document.activeElement)) document.activeElement.blur();
      }
    }
    function closeOnEscape(event) {
      if (event.key === "Escape") {
        setOpen(false);
        if (menuRef.current?.contains(document.activeElement)) document.activeElement.blur();
      }
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { credentials: "same-origin" })
      .then(async (response) => {
        if (response.status === 401) return null;
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || "Account status is unavailable.");
        }
        return response.json();
      })
      .then((result) => {
        if (active) {
          setTheme(result?.profile?.theme || localStorage.getItem("aw-theme") || "light");
          setAccount(result);
          if (result?.profile?.theme) {
            setTheme(result.profile.theme);
            localStorage.setItem("aw-theme", result.profile.theme);
            document.documentElement.classList.toggle("dark", result.profile.theme === "dark");
            window.dispatchEvent(new Event("aw-theme-change"));
          }
        }
      })
      .catch((error) => {
        if (active) setStatus(error instanceof Error ? error.message : "Account status is unavailable.");
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => { active = false; };
  }, [pathname]);

  async function changeTheme(value) {
    setTheme(value);
    localStorage.setItem("aw-theme", value);
    document.documentElement.classList.toggle("dark", value === "dark");
    window.dispatchEvent(new Event("aw-theme-change"));
    setStatus("");
    if (account) {
      try {
        const result = await accountRequest("/api/account/profile", {
          method: "PATCH",
          body: JSON.stringify({ ...account.profile, theme: value }),
        });
        setAccount((current) => current ? { ...current, profile: result.profile } : current);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Could not save your theme preference.");
      }
    }
  }

  async function signOut() {
    try {
      await accountRequest("/api/auth/logout", { method: "POST" });
      setAccount(null);
      router.push("/");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not sign out.");
    }
  }

  const profile = account?.profile;
  const displayName = profile?.shop_name || profile?.display_name || account?.user?.email || "Your account";
  const avatar = profile?.avatar_file_id
    ? `url("/api/files/${encodeURIComponent(profile.avatar_file_id)}")`
    : undefined;

  if (!loaded) {
    return (
      <div className="account-actions" aria-label="Account">
        <span className="account-actions-loading" aria-hidden="true" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="account-actions">
        <Link className="account-signin-link" href="/login?mode=sign_in">
          Sign in
        </Link>
        <Link className="account-create-link" href="/login?mode=sign_up">
          Create account
        </Link>
        {status && <span className="account-actions-error" title={status}>Account setup needed</span>}
      </div>
    );
  }

  return (
    <div ref={menuRef} className={`account-menu${pathname === "/account" ? " account-menu-active" : ""}`}>
      <button className="account-menu-trigger" type="button" aria-label="Open account menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span className="account-menu-avatar" style={avatar ? { backgroundImage: avatar } : undefined}>
          {!avatar && <PersonIcon />}
        </span>
        <span className="account-menu-name">{profile?.shop_name || profile?.display_name || "Account"}</span>
        <svg className="account-menu-chevron" aria-hidden="true" viewBox="0 0 16 16" fill="none">
          <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      <div
        className={`account-menu-popover${open ? " account-menu-popover-open" : ""}`}
        aria-hidden={!open}
        inert={!open}
      >
        <div className="account-menu-identity">
          <span className="account-menu-avatar account-menu-avatar-large" style={avatar ? { backgroundImage: avatar } : undefined}>
            {!avatar && <PersonIcon />}
          </span>
          <span><strong>{displayName}</strong><small>{account.user.email}</small></span>
        </div>
        <Link className="account-menu-item" href="/account" onClick={() => setOpen(false)}>Account settings</Link>
        <div className="account-menu-theme">
          <span>Appearance</span>
          <div role="group" aria-label="Theme">
            <button type="button" aria-pressed={theme === "light"} onClick={() => void changeTheme("light")}>Light</button>
            <button type="button" aria-pressed={theme === "dark"} onClick={() => void changeTheme("dark")}>Dark</button>
          </div>
        </div>
        <button type="button" className="account-menu-item account-menu-signout" onClick={signOut}>Sign out</button>
        {status && <p className="account-menu-status" role="status">{status}</p>}
      </div>
    </div>
  );
}
