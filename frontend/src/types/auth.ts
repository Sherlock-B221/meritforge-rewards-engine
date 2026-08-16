/**
 * Auth types — mirror `backend/app/schemas/auth.py` exactly.
 */

export type UserRole = "user" | "admin";

/** Bare user shape returned by `GET /auth/me` (no `token` wrapper). */
export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
}

/** Response shape for both `POST /auth/register` (201) and `POST /auth/login` (200). */
export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
}

export interface LoginInput {
  username: string;
  password: string;
}
