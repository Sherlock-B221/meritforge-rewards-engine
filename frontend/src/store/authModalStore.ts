import { create } from "zustand";

export type AuthModalMode = "login" | "register";

/** An action to replay after the user authenticates (e.g. the upvote/comment they attempted). */
type PendingIntent = (() => void | Promise<void>) | null;

interface AuthModalState {
  isOpen: boolean;
  mode: AuthModalMode;
  pendingIntent: PendingIntent;
  /** Open the popup, optionally capturing an action to replay after auth. */
  open: (intent?: PendingIntent, mode?: AuthModalMode) => void;
  /** Close the popup and drop any captured intent. */
  close: () => void;
  setMode: (mode: AuthModalMode) => void;
  /** Run the captured intent (if any), then close + clear it. Called on auth success. */
  runPendingIntent: () => Promise<void>;
}

/**
 * Drives the global login/signup popup. Any write entry point opens it (via
 * `useAuthGuard`) with the action it wanted to perform; on successful auth the
 * action is replayed so the flow completes seamlessly.
 */
export const useAuthModalStore = create<AuthModalState>((set, get) => ({
  isOpen: false,
  mode: "login",
  pendingIntent: null,
  open: (intent = null, mode = "login") => set({ isOpen: true, pendingIntent: intent, mode }),
  close: () => set({ isOpen: false, pendingIntent: null }),
  setMode: (mode) => set({ mode }),
  runPendingIntent: async () => {
    const intent = get().pendingIntent;
    // Clear + close first so the popup never re-fires the intent twice.
    set({ isOpen: false, pendingIntent: null });
    if (intent) await intent();
  },
}));
