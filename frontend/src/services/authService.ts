import { apiGet, apiPost } from "@/services/apiClient";
import type { AuthResponse, AuthUser, LoginInput, RegisterInput } from "@/types/auth";

/** `POST /auth/register` → 201 `{ token, user }`. */
export function register(input: RegisterInput): Promise<AuthResponse> {
  return apiPost<AuthResponse>("/auth/register", input);
}

/** `POST /auth/login` → 200 `{ token, user }`. */
export function login(input: LoginInput): Promise<AuthResponse> {
  return apiPost<AuthResponse>("/auth/login", input);
}

/** `GET /auth/me` → 200 bare `{ id, username, email, role }` (no `token` wrapper). */
export function me(): Promise<AuthUser> {
  return apiGet<AuthUser>("/auth/me");
}
