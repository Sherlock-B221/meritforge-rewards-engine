"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/services/authService";
import { useAuthStore } from "@/store/authStore";
import { AppError } from "@/types/api";
import type { LoginFieldErrors, LoginFormValues } from "./Login.types";

function readStringDetail(details: Record<string, unknown>, key: string): string | undefined {
  const value = details[key];
  return typeof value === "string" ? value : undefined;
}

interface UseLoginScreenResult {
  values: LoginFormValues;
  errors: LoginFieldErrors;
  isSubmitting: boolean;
  setField: (field: keyof LoginFormValues, value: string) => void;
  handleSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

const initialValues: LoginFormValues = { username: "", password: "" };

/** All client logic for the Login screen: form state, submit, error mapping, redirect on success. */
export function useLoginScreen(): UseLoginScreenResult {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const [values, setValues] = useState<LoginFormValues>(initialValues);
  const [errors, setErrors] = useState<LoginFieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setField = (field: keyof LoginFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});
    setIsSubmitting(true);

    login(values)
      .then((response) => {
        setSession(response.token, response.user);
        router.push("/feed");
      })
      .catch((error: unknown) => {
        if (error instanceof AppError) {
          setErrors({
            username: readStringDetail(error.details, "username"),
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
