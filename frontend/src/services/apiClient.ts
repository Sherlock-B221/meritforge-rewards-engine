import { AppError, AUTH_FAILURE_CODES, type ApiErrorEnvelope } from "@/types/api";
import { useAuthStore } from "@/store/authStore";

/**
 * The one place `NEXT_PUBLIC_API_URL` is read. No other file should touch
 * `process.env` for the API base URL.
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

function isApiErrorEnvelope(value: unknown): value is ApiErrorEnvelope {
  if (typeof value !== "object" || value === null || !("error" in value)) {
    return false;
  }
  const err = (value as { error: unknown }).error;
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    "message" in err &&
    typeof (err as { code: unknown }).code === "string" &&
    typeof (err as { message: unknown }).message === "string"
  );
}

async function parseErrorBody(response: Response): Promise<ApiErrorEnvelope["error"]> {
  try {
    const body: unknown = await response.json();
    if (isApiErrorEnvelope(body)) {
      return body.error;
    }
  } catch {
    // Non-JSON or empty body (e.g. a raw 502 from a proxy) — fall through.
  }
  return {
    code: "UNKNOWN_ERROR",
    message: response.statusText || "An unknown error occurred",
    details: {},
  };
}

/**
 * Core request function backing every typed helper below. Prefixes
 * `NEXT_PUBLIC_API_URL`, attaches the bearer token from the auth store when
 * present, parses JSON, and throws `AppError` on any non-2xx response.
 *
 * On a 401 with an auth-failure code (UNAUTHORIZED / INVALID_TOKEN /
 * TOKEN_EXPIRED), the session is cleared and the browser is fully navigated
 * to `/login` — this module is not a component/hook, so `next/navigation`'s
 * router isn't available here, and a full navigation is the correct behavior
 * for "you were logged out".
 */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { token } = useAuthStore.getState();

  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const { code, message, details } = await parseErrorBody(response);

    if (
      response.status === 401 &&
      AUTH_FAILURE_CODES.includes(code as (typeof AUTH_FAILURE_CODES)[number])
    ) {
      useAuthStore.getState().clearSession();
      if (typeof window !== "undefined") {
        window.location.assign("/login");
      }
    }

    throw new AppError({ code, message, status: response.status, details });
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  return request<T>(path, { ...init, method: "GET" });
}

export function apiPost<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
  return request<T>(path, {
    ...init,
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function apiPatch<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
  return request<T>(path, {
    ...init,
    method: "PATCH",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function apiDelete<T>(path: string, init?: RequestInit): Promise<T> {
  return request<T>(path, { ...init, method: "DELETE" });
}
