import { requestResponse } from "./client";
import { ApiError, ExecutionOutcomeUnknownError } from "./errors";
import type {
  Approval,
  ExecutionEvent,
  ExecutionOptions,
  ExecutionResult,
  ExecutionStatus,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDecision(value: unknown): value is "approve" | "reject" {
  return value === "approve" || value === "reject";
}

function isApproval(value: unknown): value is Approval {
  return (
    isRecord(value) &&
    typeof value.interruptId === "string" &&
    value.interruptId.length > 0 &&
    (value.decisionStatus === "pending" || value.decisionStatus === "unconfirmed") &&
    Array.isArray(value.actions) &&
    value.actions.every(
      (action: unknown) =>
        isRecord(action) &&
        typeof action.toolName === "string" &&
        typeof action.argumentSummary === "string" &&
        Array.isArray(action.allowedDecisions) &&
        action.allowedDecisions.length > 0 &&
        action.allowedDecisions.every(isDecision),
    )
  );
}

function isExecutionStatus(value: unknown): value is ExecutionStatus {
  return (
    value === "completed" ||
    value === "awaiting_approval" ||
    value === "unfinished" ||
    value === "stopped" ||
    value === "error"
  );
}

function parseFrame(frame: string): ExecutionEvent | undefined {
  let event = "";
  const lines: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).replace(/^ /, "");
    if (line.startsWith("data:")) lines.push(line.slice(5).replace(/^ /, ""));
  }
  if (!event) return undefined;

  const knownEvents = ["message", "tool", "awaiting_approval", "completed", "error", "end"];
  if (!knownEvents.includes(event)) return undefined;
  const data: unknown = JSON.parse(lines.join("\n"));
  if (!isRecord(data) || typeof data.requestId !== "string" || !data.requestId) {
    throw new Error("Invalid execution event");
  }

  let valid = false;
  switch (event) {
    case "message":
      valid = typeof data.text === "string";
      break;
    case "tool":
      valid =
        (data.status === "requested" || data.status === "finished") &&
        (data.name === undefined || typeof data.name === "string");
      break;
    case "awaiting_approval":
      valid = Array.isArray(data.approvals) && data.approvals.every(isApproval);
      break;
    case "completed":
      valid = true;
      break;
    case "error":
      valid = data.error === "Execution failed";
      break;
    case "end":
      valid = isExecutionStatus(data.status);
      break;
  }
  if (!valid) throw new Error("Invalid execution event payload");
  return { event, data } as ExecutionEvent;
}

export async function readExecution(
  path: string,
  body: unknown,
  options: ExecutionOptions = {},
): Promise<ExecutionResult> {
  const { response, signal } = await requestResponse(path, {
    method: "POST",
    body,
    signal: options.signal,
    accept: "text/event-stream",
  }).catch((cause: unknown) => {
    if (cause instanceof ApiError) throw cause;
    throw new ExecutionOutcomeUnknownError(null, { cause });
  });
  let requestId = response.headers.get("x-request-id");
  if (!response.headers.get("content-type")?.includes("text/event-stream") || !response.body) {
    await response.body?.cancel().catch(() => {});
    throw new ExecutionOutcomeUnknownError(requestId);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let buffer = "";
  let result: ExecutionResult | undefined;
  try {
    while (true) {
      const { value, done } = await reader.read();
      signal.throwIfAborted();
      buffer += decoder.decode(value, { stream: !done });
      buffer = buffer.replace(/\r\n/g, "\n");
      let boundary: number;
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const event = parseFrame(frame);
        if (!event) continue;
        requestId = event.data.requestId;
        if (event.event === "end") {
          result = { status: event.data.status, requestId: event.data.requestId };
        }
        options.onEvent?.(event);
        signal.throwIfAborted();
      }
      if (done) break;
    }
    if (!result || buffer.trim()) throw new ExecutionOutcomeUnknownError(requestId);
    return result;
  } catch (cause) {
    if (cause instanceof ExecutionOutcomeUnknownError) throw cause;
    throw new ExecutionOutcomeUnknownError(requestId, { cause });
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
