import { getSessionContext, replaceSession } from "@/stores/session";
import { ApiError } from "./errors";
import type { RequestOptions } from "./types";

interface FetchOptions extends RequestOptions {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  authenticated?: boolean;
  accept?: "application/json" | "text/event-stream";
}

async function readError(response: Response): Promise<ApiError> {
  let message = "Request failed";
  let requestId = response.headers.get("x-request-id");
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null) {
      if ("error" in body && typeof body.error === "string") message = body.error;
      if ("requestId" in body && typeof body.requestId === "string") requestId = body.requestId;
    }
  } catch {
    // Proxy errors can have a non-JSON body; retain the HTTP status and header ID.
  }
  return new ApiError(response.status, message, requestId);
}

export async function requestResponse(path: string, options: FetchOptions = {}) {
  const session = getSessionContext();
  const signal = options.signal
    ? AbortSignal.any([session.signal, options.signal])
    : session.signal;
  const authenticated = options.authenticated !== false;
  const headers = new Headers({ Accept: options.accept ?? "application/json" });
  if (authenticated && session.accessToken) {
    headers.set("Authorization", `Bearer ${session.accessToken}`);
  }
  if (options.body !== undefined) headers.set("Content-Type", "application/json");

  signal.throwIfAborted();
  const response = await fetch(`/api${path}`, {
    method: options.method ?? "GET",
    headers,
    credentials: "omit",
    cache: "no-store",
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    signal,
  });
  signal.throwIfAborted();

  if (!response.ok) {
    const error = await readError(response);
    signal.throwIfAborted();
    if (authenticated && response.status === 401) replaceSession(null, null);
    throw error;
  }
  return { response, signal };
}

export async function requestJson<T>(path: string, options?: FetchOptions): Promise<T> {
  const { response, signal } = await requestResponse(path, options);
  try {
    const body: T = await response.json();
    signal.throwIfAborted();
    return body;
  } catch (cause) {
    signal.throwIfAborted();
    if (!(cause instanceof SyntaxError)) throw cause;
    throw new ApiError(
      response.status,
      "Invalid JSON response",
      response.headers.get("x-request-id"),
      {
        cause,
      },
    );
  }
}
