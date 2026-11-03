"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { validateAccountCsv } from "@/lib/account-data";
import { todayInSriLanka } from "@/lib/date";
import { accountRequest } from "@/lib/account-api";

const EMPTY_PROFILE = {
  display_name: "",
  shop_name: "",
  phone: "",
  theme: "light",
  avatar_file_id: null,
};

function localDate() {
  return todayInSriLanka();
}

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [projects, setProjects] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [reports, setReports] = useState([]);
  const [projectForm, setProjectForm] = useState({ name: "", karat: "22", gold_weight_g: "", budget_lkr: "", notes: "" });
  const [pendingDataset, setPendingDataset] = useState(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function loadAccount() {
      try {
      const response = await fetch("/api/account", { credentials: "same-origin" });
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load account data.");
      setUser(result.user);
      const nextProfile = { ...EMPTY_PROFILE, ...result.profile };
      setProfile(nextProfile);
      setProjects(result.projects || []);
      setDatasets(result.datasets || []);
      setReports(result.reports || []);
      document.documentElement.classList.toggle("dark", nextProfile.theme === "dark");
      localStorage.setItem("aw-theme", nextProfile.theme);
      window.dispatchEvent(new Event("aw-theme-change"));
      if (nextProfile.avatar_file_id) setAvatarUrl(`/api/files/${encodeURIComponent(nextProfile.avatar_file_id)}`);
      setLoading(false);
      } catch (error) {
        setStatus(error instanceof Error ? `Could not load account data: ${error.message}` : "Could not load account data.");
        setLoading(false);
      }
    }
    void loadAccount();
  }, [router]);

  function updateProfile(field, value) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    setStatus("");
    try {
      const { profile: savedProfile } = await accountRequest("/api/account/profile", {
        method: "PATCH",
        body: JSON.stringify(profile),
      });
      setProfile((current) => ({ ...current, ...savedProfile }));
      localStorage.setItem("aw-theme", profile.theme);
      document.documentElement.classList.toggle("dark", profile.theme === "dark");
      window.dispatchEvent(new Event("aw-theme-change"));
      setStatus("Account settings saved.");
    } catch (error) {
      setStatus(`Profile was not saved: ${error instanceof Error ? error.message : "request failed"}`);
    }
    setBusy(false);
  }

  async function uploadAvatar(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !user) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setStatus("Profile photos must be JPG, PNG, or WebP and no larger than 5 MB.");
      return;
    }

    setBusy(true);
    setStatus("");
    try {
      const form = new FormData();
      form.set("file", file);
      const result = await accountRequest("/api/account/avatar", { method: "POST", body: form });
      const nextProfile = { ...profile, avatar_file_id: result.avatar_file_id };
      setProfile(nextProfile);
      setAvatarUrl(`/api/files/${encodeURIComponent(result.avatar_file_id)}`);
      setStatus("Profile photo updated.");
    } catch (error) {
      setStatus(`Profile photo upload failed: ${error instanceof Error ? error.message : "request failed"}`);
    }
    setBusy(false);
  }

  async function saveProject(event) {
    event.preventDefault();
    if (!user) return;
    const weight = Number(projectForm.gold_weight_g);
    const budget = Number(projectForm.budget_lkr || 0);
    if (!projectForm.name.trim() || !Number.isFinite(weight) || weight <= 0 ||
      !Number.isFinite(budget) || budget < 0) {
      setStatus("Enter a project name, a positive gold weight, and a non-negative budget.");
      return;
    }

    setBusy(true);
    try {
      const form = new FormData();
      form.set("name", projectForm.name.trim());
      form.set("karat", String(projectForm.karat));
      form.set("gold_weight_g", String(weight));
      form.set("budget_lkr", String(budget));
      form.set("notes", projectForm.notes.trim());
      const result = await accountRequest("/api/account/projects", {
        method: "POST",
        body: form,
      });
      setProjects((current) => [result, ...current]);
      setProjectForm({ name: "", karat: "22", gold_weight_g: "", budget_lkr: "", notes: "" });
      setStatus("Private jewelry project saved to your account.");
    } catch (error) {
      setStatus(`Jewelry project was not saved: ${error instanceof Error ? error.message : "request failed"}`);
    }
    setBusy(false);
  }

  async function inspectCsv(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setStatus("");
    setPendingDataset(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv") || file.size > 5 * 1024 * 1024) {
      setStatus("Choose a CSV file no larger than 5 MB.");
      return;
    }
    try {
      const validation = validateAccountCsv(await file.text(), localDate());
      setPendingDataset({ file, validation });
      setStatus(
        `Validation complete: ${validation.accepted_rows} accepted and ${validation.rejected_rows} rejected of ${validation.total_rows} rows.`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The CSV could not be validated.");
    }
  }

  async function saveDataset() {
    if (!user || !pendingDataset) return;
    if (pendingDataset.validation.accepted_rows === 0) {
      setStatus("No valid rows to save. Correct the CSV and upload it again.");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", pendingDataset.file);
      const result = await accountRequest("/api/account/datasets", { method: "POST", body: form });
      setDatasets((current) => [result, ...current]);
      setPendingDataset(null);
      setStatus("Validated dataset saved privately. It will not be used to train the model.");
    } catch (error) {
      setStatus(`Validated rows were not saved: ${error instanceof Error ? error.message : "request failed"}`);
    }
    setBusy(false);
  }

  function downloadPrivateFile(fileId, fileName) {
    const link = document.createElement("a");
    link.href = `/api/files/${encodeURIComponent(fileId)}`;
    link.download = fileName;
    link.rel = "noopener";
    link.click();
  }

  async function signOut() {
    try {
      await accountRequest("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } catch (error) {
      setStatus(`Could not sign out: ${error instanceof Error ? error.message : "request failed"}`);
    }
  }

  if (loading) return <div className="page"><p className="card panel">Loading private workspace...</p></div>;
  if (!user) {
    return (
      <div className="page">
        <header className="page-head"><p className="page-kicker">Private workspace</p><h1>Sign in required</h1></header>
        <section className="card panel account-auth-card">
          {status && <p className="account-status" role="status">{status}</p>}
          <Link className="btn btn-primary" href="/login?mode=sign_in">Sign in to your account</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head account-page-head">
        <div>
          <p className="page-kicker">Private workspace</p>
          <h1>{profile.shop_name || profile.display_name || "Your account"}</h1>
          <p>{user.email}</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={signOut}>Sign out</button>
      </header>

      {status && <p className="card panel account-status" role="status">{status}</p>}

      <section className="card panel">
        <div className="section-header"><div><h2 className="section-title">Profile and preferences</h2><p className="section-sub">Account settings apply to your private workspace.</p></div></div>
        <form className="account-form" onSubmit={saveProfile}>
          <div className="account-profile-photo">
            <div className="account-avatar" style={avatarUrl ? { backgroundImage: `url("${avatarUrl}")` } : undefined} aria-label="Profile photo" role="img">
              {!avatarUrl && (profile.display_name || user.email || "A").slice(0, 1).toUpperCase()}
            </div>
            <label className="studio-field">
              <span>Profile photo (JPG, PNG, or WebP; up to 5 MB)</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadAvatar} disabled={busy} />
            </label>
          </div>
          <div className="studio-field-grid">
            <label className="studio-field"><span>Your name</span><input value={profile.display_name} maxLength={100} onChange={(event) => updateProfile("display_name", event.target.value)} /></label>
            <label className="studio-field"><span>Shop name</span><input value={profile.shop_name} maxLength={120} onChange={(event) => updateProfile("shop_name", event.target.value)} /></label>
            <label className="studio-field"><span>Phone</span><input value={profile.phone} maxLength={40} onChange={(event) => updateProfile("phone", event.target.value)} /></label>
            <label className="studio-field"><span>Theme</span><select value={profile.theme} onChange={(event) => updateProfile("theme", event.target.value)}><option value="light">Light</option><option value="dark">Dark</option></select></label>
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy}>Save account settings</button>
        </form>
      </section>

      <section className="card panel">
        <div className="section-header"><div><h2 className="section-title">Jewelry projects</h2><p className="section-sub">Keep planned pieces, gold weights, and budgets private to this account.</p></div></div>
        <form className="account-form" onSubmit={saveProject}>
          <div className="studio-field-grid">
            <label className="studio-field"><span>Project name</span><input required maxLength={120} value={projectForm.name} onChange={(event) => setProjectForm((current) => ({ ...current, name: event.target.value }))} /></label>
            <label className="studio-field"><span>Gold purity</span><select value={projectForm.karat} onChange={(event) => setProjectForm((current) => ({ ...current, karat: event.target.value }))}><option value="18">18K</option><option value="22">22K</option><option value="24">24K</option></select></label>
            <label className="studio-field"><span>Gold weight (g)</span><input type="number" min="0.01" step="0.01" required value={projectForm.gold_weight_g} onChange={(event) => setProjectForm((current) => ({ ...current, gold_weight_g: event.target.value }))} /></label>
            <label className="studio-field"><span>Budget (LKR)</span><input type="number" min="0" step="1000" value={projectForm.budget_lkr} onChange={(event) => setProjectForm((current) => ({ ...current, budget_lkr: event.target.value }))} /></label>
          </div>
          <label className="studio-field"><span>Notes</span><textarea rows="3" maxLength={1000} value={projectForm.notes} onChange={(event) => setProjectForm((current) => ({ ...current, notes: event.target.value }))} /></label>
          <button type="submit" className="btn btn-primary" disabled={busy}>Save jewelry project</button>
        </form>
        <div className="account-record-list">
          {projects.map((project) => <article className="source-card" key={project.id}><strong>{project.name}</strong><p>{project.karat}K · {Number(project.gold_weight_g).toFixed(2)} g · Rs {Number(project.budget_lkr).toLocaleString("en-US")} budget</p>{project.notes && <p>{project.notes}</p>}{project.model_file_id && <button type="button" className="btn btn-secondary" onClick={() => downloadPrivateFile(project.model_file_id, project.name)}>Download CAD file</button>}</article>)}
          {projects.length === 0 && <p className="section-sub">No jewelry projects saved yet.</p>}
        </div>
      </section>

      <section className="card panel">
        <div className="section-header"><div><h2 className="section-title">Upload and validate private data</h2><p className="section-sub">CSV files are checked and cleaned before saving; raw user data is never used for model training.</p></div></div>
        <p className="cad-format-note">Pettah prices: date, karat, price_lkr_per_8g, shop_name, source_url. Jewelry: name, karat, weight_g (optional material and notes). Up to 1,000 rows and 5 MB.</p>
        <label className="studio-field"><span>Choose a CSV dataset</span><input type="file" accept=".csv,text/csv" onChange={inspectCsv} disabled={busy} /></label>
        {pendingDataset && (
          <div className="account-validation">
            <strong>{pendingDataset.validation.kind.replaceAll("_", " ")}: {pendingDataset.validation.accepted_rows} valid, {pendingDataset.validation.rejected_rows} rejected</strong>
            {pendingDataset.validation.accepted.slice(0, 5).map((row, index) => <pre key={index}>{JSON.stringify(row, null, 2)}</pre>)}
            {pendingDataset.validation.rejected.slice(0, 10).map((row) => <p key={row.row}>Row {row.row}: {row.reasons.join("; ")}</p>)}
            <button type="button" className="btn btn-primary" onClick={saveDataset} disabled={busy || pendingDataset.validation.accepted_rows === 0}>Save validated rows privately</button>
          </div>
        )}
        <div className="account-record-list">
          {datasets.map((dataset) => <article className="source-card" key={dataset.id}><strong>{dataset.file_name}</strong><p>{dataset.kind.replaceAll("_", " ")} · {dataset.validation?.accepted_rows || 0} accepted · {dataset.validation?.rejected_rows || 0} rejected</p><button type="button" className="btn btn-secondary" onClick={() => downloadPrivateFile(dataset.file_id, dataset.file_name)}>Download original CSV</button></article>)}
          {datasets.length === 0 && <p className="section-sub">No private datasets uploaded.</p>}
        </div>
      </section>

      <section className="card panel">
        <div className="section-header"><div><h2 className="section-title">Saved design reports</h2><p className="section-sub">PDFs saved from the Design Studio are accessible only to this account.</p></div></div>
        <div className="account-record-list">
          {reports.map((report) => <article className="source-card account-report-row" key={report.id}><strong>{report.title}</strong><button type="button" className="btn btn-secondary" onClick={() => downloadPrivateFile(report.file_id, report.title)}>Download</button></article>)}
          {reports.length === 0 && <p className="section-sub">No PDF reports saved yet. Generate a report in the Design Studio while signed in.</p>}
        </div>
      </section>
    </div>
  );
}
