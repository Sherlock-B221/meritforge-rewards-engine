import Link from "next/link";

/**
 * Placeholder landing page — proves the app boots. The full SSR landing page
 * (metadata, hero, sitemap/robots) is out of scope for P5; see the P5 report
 * for the tracked open.
 */
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">meritforge</h1>
      <Link href="/login" className="underline underline-offset-4">
        Log in
      </Link>
    </main>
  );
}
