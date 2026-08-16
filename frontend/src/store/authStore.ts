import { create } from "zustand";
import type { AuthUser } from "@/types/auth";

/**
 * The single localStorage key auth session state is persisted under.
 * Only this module reads/writes it.
 */
const AUTH_STORAGE_KEY = "meritforge.auth";

interface PersistedSession {
  token: string;
  user: AuthUser;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  /** Store the session (post login/register) and persist it to localStorage. */
  setSession: (token: string, user: AuthUser) => void;
  /** Clear the session in memory and remove it from localStorage. */
  clearSession: () => void;
  /** Read the persisted session (if any) back into memory. Call once on mount. */
  hydrate: () => void;
}

function readPersistedSession(): PersistedSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "token" in parsed &&
      "user" in parsed &&
      typeof (parsed as { token: unknown }).token === "string"
    ) {
      return parsed as PersistedSession;
    }
    return null;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  setSession: (token, user) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({ token, user } satisfies PersistedSession),
      );
    }
    set({ token, user });
  },
  clearSession: () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    }
    set({ token: null, user: null });
  },
  hydrate: () => {
    const session = readPersistedSession();
    if (session) {
      set({ token: session.token, user: session.user });
    }
  },
}));
