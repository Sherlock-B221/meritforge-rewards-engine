import Link from "next/link";
import { Award, Flame, Target, Trophy } from "lucide-react";
import { buttonVariants } from "@/components/ui";
import { AuthRedirect } from "./AuthRedirect";

const FEATURES = [
  { icon: Trophy, title: "Points", desc: "Earn points for helpful posts, answers, and upvotes." },
  { icon: Award, title: "Badges", desc: "Unlock badges as challenges recognize your milestones." },
  { icon: Flame, title: "Streaks", desc: "Keep a daily contribution streak alive and climb." },
  { icon: Target, title: "Challenges", desc: "Weekly, data-driven challenges evaluate your activity live." },
];

/**
 * Landing page — server-rendered for SSR/SEO (metadata + hero markup render on
 * the server). The only client concern (redirect already-authenticated visitors
 * to /feed) is isolated to the tiny `AuthRedirect` island.
 */
export default function Home() {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden">
      <AuthRedirect />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(62% 48% at 50% 0%, color-mix(in oklch, var(--primary) 16%, transparent), transparent 72%)",
        }}
      />

      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            m
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">meritforge</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/login" className={buttonVariants({ variant: "ghost" })}>
            Log in
          </Link>
          <Link href="/register" className={buttonVariants({ variant: "default" })}>
            Sign up
          </Link>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-14 text-center">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-card">
          <Flame className="size-3.5 text-streak" aria-hidden />
          A developer community with a rewards engine
        </span>

        <h1 className="text-display text-balance">
          Where great answers <span className="text-primary">earn their reputation</span>
        </h1>

        <p className="mt-5 max-w-xl text-lg text-balance text-muted-foreground">
          Ask questions, share what you know, and watch points, badges, and streaks accrue as
          challenges evaluate your activity — automatically, in the background.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/feed" className={buttonVariants({ variant: "default", size: "lg" })}>
            Explore the community
          </Link>
          <Link href="/register" className={buttonVariants({ variant: "outline", size: "lg" })}>
            Create an account
          </Link>
        </div>

        <div className="mt-16 grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border bg-card p-4 text-left shadow-card"
            >
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <feature.icon className="size-5" aria-hidden />
              </div>
              <h3 className="mt-3 font-display text-sm font-semibold">{feature.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
