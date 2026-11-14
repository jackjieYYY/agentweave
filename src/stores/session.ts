import { create } from "zustand";
import type { User } from "@/api/types";
import { queryClient } from "@/lib/query-client";

const storageKey = "agentweave-access-token";

function readToken(): string | null {
  try {
    return sessionStorage.getItem(storageKey) || null;
  } catch {
    return null;
  }
}

export interface SessionState {
  accessToken: string | null;
  user: User | null;
  status: "anonymous" | "unverified" | "restoring" | "authenticated";
  error: Error | null;
}

const initialToken = readToken();
let sessionController = new AbortController();

export const useSession = create<SessionState>(() => ({
  accessToken: initialToken,
  user: null,
  status: initialToken ? "unverified" : "anonymous",
  error: null,
}));

export function getSessionContext() {
  return {
    accessToken: useSession.getState().accessToken,
    signal: sessionController.signal,
  };
}

export function replaceSession(accessToken: string | null, user: User | null): void {
  const previous = sessionController;
  sessionController = new AbortController();
  previous.abort();
  queryClient.clear();

  try {
    if (accessToken) sessionStorage.setItem(storageKey, accessToken);
    else sessionStorage.removeItem(storageKey);
  } catch {
    // Storage restrictions leave authentication available for the current page.
  }

  useSession.setState({
    accessToken,
    user,
    status: accessToken ? (user ? "authenticated" : "unverified") : "anonymous",
    error: null,
  });
}
