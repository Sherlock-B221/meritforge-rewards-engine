"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { register } from "@/services/authService";
import { useAuthStore } from "@/store/authStore";
import { AppError } from "@/types/api";
import type { RegisterFieldErrors, RegisterFormValues } from "./Register.types";

interface UseRegisterScreenResult {
  values: RegisterFormValues;
  errors: RegisterFieldErrors;
  isSubmitting: boolean;
  setField: (field: keyof RegisterFormValues, value: string) => void;
  handleSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

const initialValues: RegisterFormValues = { username: "", email: "", password: "" };

function readStringDetail(details: Record<string, unknown>, key: string): string | undefined {
  const value = details[key];
  return typeof value === "string" ? value : undefined;
}

/** All client logic for the Register screen: form state, submit, error mapping, redirect on success. */
export function useRegisterScreen(): UseRegisterScreenResult {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const [values, setValues] = useState<RegisterFormValues>(initialValues);
  const [errors, setErrors] = useState<RegisterFieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setField = (field: keyof RegisterFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});
    setIsSubmitting(true);

    register(values)
      .then((response) => {
        setSession(response.token, response.user);
        router.push("/feed");
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
