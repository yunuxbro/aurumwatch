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
    const requestedMode = new URLSearchParams(window.location.search).get("mode");
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
