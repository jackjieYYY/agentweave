import { api } from "@/api/endpoints";
import { ApiError } from "@/api/errors";
import type { Credentials, RequestOptions, User } from "@/api/types";
import { getSessionContext, replaceSession, useSession } from "@/stores/session";

let loginAttempt = 0;
let restoration: { signal: AbortSignal; promise: Promise<User | null> } | null = null;

function restore(): Promise<User | null> {
  const state = useSession.getState();
  if (!state.accessToken) return Promise.resolve(null);
  if (state.status === "authenticated") return Promise.resolve(state.user);
  const { signal } = getSessionContext();
  if (restoration?.signal === signal) return restoration.promise;

  useSession.setState({ status: "restoring", error: null });
  const promise = api.auth
    .me()
    .then(({ user }) => {
      signal.throwIfAborted();
      useSession.setState({ user, status: "authenticated", error: null });
      return user;
    })
    .catch((cause: unknown) => {
      if (cause instanceof ApiError && cause.status === 401) return null;
      if (!signal.aborted) {
        useSession.setState({
          status: "unverified",
          error:
            cause instanceof Error ? cause : new Error("Session restoration failed", { cause }),
        });
      }
      throw cause;
    })
    .finally(() => {
      if (restoration?.signal === signal) restoration = null;
    });
  restoration = { signal, promise };
  return promise;
}

export const sessionActions = {
  async login(input: Credentials, options?: RequestOptions) {
    const attempt = ++loginAttempt;
    const { signal } = getSessionContext();
    const result = await api.auth.login(input, options);
    signal.throwIfAborted();
    if (attempt !== loginAttempt) {
      throw new DOMException("Authentication superseded", "AbortError");
    }
    replaceSession(result.accessToken, result.user);
    return result;
  },
  restore,
  logout() {
    loginAttempt++;
    replaceSession(null, null);
  },
};
