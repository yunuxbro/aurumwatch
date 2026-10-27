import Link from "next/link";

export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <div className="space-y-4 py-8">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-sm text-stone-600">The page you are looking for does not exist.</p>
      <Link href="/" className="inline-block text-sm text-amber-700 underline">
        Return to Daily Brief
      </Link>
    </div>
  );
}

