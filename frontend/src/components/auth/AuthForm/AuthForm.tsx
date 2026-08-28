"use client";

import { Button, Input, Label } from "@/components/ui";
import { useAuthForm, type AuthMode } from "./useAuthForm";

interface AuthFormProps {
  mode: AuthMode;
  /** Called after the session is set — redirect on a page, replay-intent in the popup. */
  onSuccess: () => void | Promise<void>;
  /** Switch login⇄register — swap in place (popup) or navigate (full page). */
  onSwitchMode: (mode: AuthMode) => void;
}

/** Shared auth form used by the full-page /login·/register routes AND the login popup. */
export function AuthForm({ mode, onSuccess, onSwitchMode }: AuthFormProps) {
  const { values, errors, isSubmitting, setField, handleSubmit } = useAuthForm(mode, onSuccess);
  const isLogin = mode === "login";

  return (
    <div className="flex flex-col gap-4">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <div className="flex flex-col gap-2">
          <Label htmlFor="af-username">Username</Label>
          <Input
            id="af-username"
            name="username"
            autoComplete="username"
            value={values.username}
            onChange={(event) => setField("username", event.target.value)}
            required
          />
          {errors.username ? <p className="text-sm text-destructive">{errors.username}</p> : null}
        </div>
        {!isLogin ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="af-email">Email</Label>
            <Input
              id="af-email"
              name="email"
              type="email"
              autoComplete="email"
              value={values.email}
              onChange={(event) => setField("email", event.target.value)}
              required
            />
            {errors.email ? <p className="text-sm text-destructive">{errors.email}</p> : null}
          </div>
        ) : null}
        <div className="flex flex-col gap-2">
          <Label htmlFor="af-password">Password</Label>
          <Input
            id="af-password"
            name="password"
            type="password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            value={values.password}
            onChange={(event) => setField("password", event.target.value)}
            required
          />
          {errors.password ? <p className="text-sm text-destructive">{errors.password}</p> : null}
        </div>
        {errors.form ? <p className="text-sm text-destructive">{errors.form}</p> : null}
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting
            ? isLogin
              ? "Logging in…"
              : "Creating account…"
            : isLogin
              ? "Log in"
              : "Create account"}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        {isLogin ? "New to meritforge? " : "Already have an account? "}
        <button
          type="button"
          onClick={() => onSwitchMode(isLogin ? "register" : "login")}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {isLogin ? "Create an account" : "Log in"}
        </button>
      </p>
    </div>
  );
}
