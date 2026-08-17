/**
 * Shared API envelope types — mirrors the backend's single error-envelope
 * shape (see `backend/app/core/errors.py::error_body`).
 *
 * Every non-2xx response from the API is expected to match `ApiErrorEnvelope`.
 * `services/apiClient.ts` parses that envelope and throws `AppError`.
 */

/** The exact JSON body the backend returns on every non-2xx response. */
export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
}

/**
 * Generic paginated list envelope — the shape every list endpoint returns
 * (see backend pagination contract). `has_next` drives the feed's "Next"
 * control; `page` is 1-based.
 */
export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  has_next: boolean;
}

/** Auth-failure codes that all mean "not authenticated" (see backend/app/constants/error_codes.py). */
export const AUTH_FAILURE_CODES = [
  "UNAUTHORIZED",
  "INVALID_TOKEN",
  "TOKEN_EXPIRED",
] as const;

export type AuthFailureCode = (typeof AUTH_FAILURE_CODES)[number];

/**
 * Typed error thrown by the API client for any non-2xx response.
 * `details` defaults to `{}` and `code` defaults to `"UNKNOWN_ERROR"` when the
 * response body doesn't match `ApiErrorEnvelope` (e.g. a raw 502 from a proxy).
 */
export class AppError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown>;
  readonly status: number;

  constructor(params: {
    code: string;
    message: string;
    status: number;
    details?: Record<string, unknown>;
  }) {
    super(params.message);
    this.name = "AppError";
    this.code = params.code;
    this.status = params.status;
    this.details = params.details ?? {};
  }
}
