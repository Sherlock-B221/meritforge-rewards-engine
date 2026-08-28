import Link from "next/link";
import { buttonVariants } from "@/components/ui";
import { AuthRedirect } from "./AuthRedirect";

/**
 * Landing page. Stays a server component for SSR/SEO: metadata + the hero
 * markup render on the server. The one client-interactive concern — redirect
 * already-authenticated visitors to `/feed` — is isolated to the tiny
 * `AuthRedirect` client island mounted alongside the static markup, so this
 * page never needs `"use client"` itself.
 */
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <AuthRedirect />
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold">meritforge</h1>
        <p className="text-lg text-muted-foreground">
          The developer forum where your posts, comments, and upvotes count for something.
        </p>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          Join threads, help other developers, and earn points, badges, and streaks as
          challenges track your activity — automatically, in the background.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/feed" className={buttonVariants({ variant: "default", size: "lg" })}>
          Explore the community
        </Link>
        <Link href="/register" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Sign up
        </Link>
        <Link href="/login" className={buttonVariants({ variant: "ghost", size: "lg" })}>
          Log in
        </Link>
      </div>
    </main>
  );
}
