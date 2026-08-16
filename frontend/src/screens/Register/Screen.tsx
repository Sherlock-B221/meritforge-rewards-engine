"use client";

import Link from "next/link";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@/components/ui";
import { useRegisterScreen } from "./useScreen";

/** Presentational only — all logic lives in `useRegisterScreen`. */
export function RegisterScreen() {
  const { values, errors, isSubmitting, setField, handleSubmit } = useRegisterScreen();

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Create an account</CardTitle>
          <CardDescription>Join the meritforge community.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
            <div className="flex flex-col gap-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                autoComplete="username"
                value={values.username}
                onChange={(event) => setField("username", event.target.value)}
                required
              />
              {errors.username ? (
                <p className="text-sm text-destructive">{errors.username}</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={values.email}
                onChange={(event) => setField("email", event.target.value)}
                required
              />
              {errors.email ? <p className="text-sm text-destructive">{errors.email}</p> : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                value={values.password}
                onChange={(event) => setField("password", event.target.value)}
                required
              />
              {errors.password ? (
                <p className="text-sm text-destructive">{errors.password}</p>
              ) : null}
            </div>
            {errors.form ? <p className="text-sm text-destructive">{errors.form}</p> : null}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating account..." : "Create account"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="underline underline-offset-4">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
