import { afterEach, expect, it, vi } from "vitest";
import { ExecutionOutcomeUnknownError } from "@/api/errors";
import { readExecution } from "@/api/execution";

afterEach(() => vi.unstubAllGlobals());

it("执行流没有 end 时报告结果未知，保留请求 ID 且不重发执行", async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response("", {
      headers: { "content-type": "text/event-stream", "x-request-id": "stream-1" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);

  const execution = readExecution("/conversations/conversation-a/continue", undefined);

  await expect(execution).rejects.toBeInstanceOf(ExecutionOutcomeUnknownError);
  await expect(execution).rejects.toMatchObject({ requestId: "stream-1" });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0]!;
  expect(url).toBe("/api/conversations/conversation-a/continue");
  expect(init.method).toBe("POST");
  expect(init.body).toBeUndefined();
  expect(init.headers.has("Content-Type")).toBe(false);
});
