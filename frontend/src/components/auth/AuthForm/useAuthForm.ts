"use client";

import { useState, type FormEvent } from "react";
import { login, register } from "@/services/authService";
import { useAuthStore } from "@/store/authStore";
import { AppError } from "@/types/api";

export type AuthMode = "login" | "register";

interface AuthFormValues {
  username: string;
  email: string;
  password: string;
}

interface AuthFieldErrors {
  username?: string;
  email?: string;
  password?: string;
  form?: string;
}

function readStringDetail(details: Record<string, unknown>, key: string): string | undefined {
  const value = details[key];
  return typeof value === "string" ? value : undefined;
}

const initialValues: AuthFormValues = { username: "", email: "", password: "" };

interface UseAuthFormResult {
  values: AuthFormValues;
  errors: AuthFieldErrors;
  isSubmitting: boolean;
  setField: (field: keyof AuthFormValues, value: string) => void;
  handleSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

/**
 * Consolidated client logic for both login and register (used by the full-page
 * auth screens AND the login popup): form state, submit, field-level error
 * mapping, and a caller-supplied `onSuccess` (redirect on a page; replay the
 * pending intent in the popup).
 */
export function useAuthForm(mode: AuthMode, onSuccess: () => void | Promise<void>): UseAuthFormResult {
  const setSession = useAuthStore((state) => state.setSession);
  const [values, setValues] = useState<AuthFormValues>(initialValues);
  const [errors, setErrors] = useState<AuthFieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setField = (field: keyof AuthFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});
    setIsSubmitting(true);

    const request =
      mode === "login"
        ? login({ username: values.username, password: values.password })
        : register({ username: values.username, email: values.email, password: values.password });

    request
      .then(async (response) => {
        setSession(response.token, response.user);
        await onSuccess();
      })
      .catch((error: unknown) => {
        if (error instanceof AppError) {
          setErrors({
            username: readStringDetail(error.details, "username"),
            email: readStringDetail(error.details, "email"),
            password: readStringDetail(error.details, "password"),
            form: error.message,
          });
        } else {
          setErrors({ form: "Something went wrong. Please try again." });
        }
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  return { values, errors, isSubmitting, setField, handleSubmit };
}
