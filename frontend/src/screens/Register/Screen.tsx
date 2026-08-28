"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { AuthForm } from "@/components/auth/AuthForm";

/** Presentational only — form logic lives in the shared `AuthForm` / `useAuthForm`. */
export function RegisterScreen() {
  const router = useRouter();

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-h3">Create an account</CardTitle>
          <CardDescription>Join the meritforge community.</CardDescription>
        </CardHeader>
        <CardContent>
          <AuthForm
            mode="register"
            onSuccess={() => router.push("/feed")}
            onSwitchMode={(mode) => router.push(mode === "login" ? "/login" : "/register")}
          />
        </CardContent>
      </Card>
    </main>
  );
}
