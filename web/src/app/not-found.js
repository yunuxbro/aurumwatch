import Link from "next/link";

export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <div className="card panel" style={{ maxWidth: 520, margin: "3rem auto", textAlign: "center" }}>
      <h1 style={{ fontSize: "1.6rem", margin: 0 }}>We couldn&apos;t find that page</h1>
      <p className="text-secondary" style={{ margin: ".5rem 0 1.25rem" }}>
        The link may be old or mistyped.
      </p>
      <Link href="/" className="btn btn-primary">Go to the daily brief</Link>
    </div>
  );
}