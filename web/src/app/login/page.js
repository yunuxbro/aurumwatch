"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { accountRequest } from "@/lib/account-api";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState("sign_up");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const requestedMode = search.get("mode");
    const googleErrorMessages = {
      google_not_configured: "Google sign-in is not configured yet. Add the Google OAuth settings and restart the app.",
      google_account_conflict: "This email is already linked to another Google account.",
      google_cancelled: "Google sign-in was cancelled.",
      google_auth_failed: "Google sign-in failed. Please try again.",
    };
    const googleError = search.get("error");
    if (googleError) Promise.resolve().then(() => setStatus(googleErrorMessages[googleError] || googleErrorMessages.google_auth_failed));
    if (requestedMode === "sign_in" || requestedMode === "sign_up") {
      Promise.resolve().then(() => setMode(requestedMode));
    }
    void fetch("/api/auth/me", { credentials: "same-origin" })
      .then((response) => {
        if (response.ok) router.replace("/account");
        else if (response.status !== 401) {
          return response.json().then((body) => {
            throw new Error(body.error || "Could not check the current sign-in.");
          });
        }
      })
      .catch((error) => {
        setStatus(error instanceof Error
          ? `Could not check the current sign-in: ${error.message}`
          : "Could not check the current sign-in.");
      });
  }, [router]);

  async function submit(event) {
    event.preventDefault();
    setStatus("");
    if (mode === "sign_up" && password.length < 12) {
      setStatus("Use a password with at least 12 characters.");
      return;
    }

    setBusy(true);
    try {
      await accountRequest(mode === "sign_in" ? "/api/auth/login" : "/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, displayName }),
      });
      router.push("/account");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Account sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <p className="page-kicker">Private workspace</p>
        <h1>{mode === "sign_in" ? "Sign in to AurumWatch" : "Create your account"}</h1>
        <p>Save jewelry projects, validated private datasets, and PDF reports to your account.</p>
      </header>

      <section className="card panel account-auth-card">
        <a className="google-auth-button" href="/api/auth/google">
          <svg aria-hidden="true" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.77 7.18l7.73 6C44.4 38.09 46.98 31.84 46.98 24.55Z" />
            <path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.55 2.56 10.78l7.97-6.19Z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.8l-7.73-6c-2.14 1.45-4.88 2.3-8.17 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
          </svg>
          Continue with Google
        </a>
        <p className="account-auth-divider"><span>or use email</span></p>
        <form className="account-form" onSubmit={submit}>
          {mode === "sign_up" && (
            <label className="studio-field">
              <span>Your name</span>
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" maxLength={100} />
            </label>
          )}
          <label className="studio-field">
            <span>Email</span>
            <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
          </label>
          <label className="studio-field">
            <span>Password{mode === "sign_up" ? " (12+ characters)" : ""}</span>
            <input type="password" required minLength={mode === "sign_up" ? 12 : undefined} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "sign_in" ? "current-password" : "new-password"} />
          </label>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Please wait..." : mode === "sign_in" ? "Sign in" : "Sign up"}
          </button>
        </form>
        {status && <p className="studio-source-note" role="status">{status}</p>}
        <p className="account-auth-switch">
          {mode === "sign_up" ? "Already registered?" : "New to AurumWatch?"}
          {" "}
          <button
            type="button"
            className="account-auth-switch-button"
            onClick={() => {
              setMode((current) => current === "sign_in" ? "sign_up" : "sign_in");
              setStatus("");
            }}
          >
            {mode === "sign_up" ? "Sign in" : "Create an account"}
          </button>
        </p>
        <p className="section-sub">
          Account data is private to your user. Uploaded records are validated and saved only to your account; they are not used to train AurumWatch models.
        </p>
        <Link className="nav-link" href="/design">Continue without an account</Link>
      </section>
    </div>
  );
}
