import { expect, it } from "vitest";
import { returnPath } from "@/auth/return-path";

it("登录返回地址只接受已知的站内应用路由", () => {
  const chat = "/app/conversations/57f2be46-ea7a-4cba-a681-b1ef731dc8df";
  expect(returnPath(chat)).toBe(chat);
  expect(returnPath("/app/settings/models")).toBe("/app/settings/models");
  for (const path of [
    null,
    "https://example.com/app",
    "//example.com/app",
    "/\\example.com/app",
    "/app/unknown",
    "/app/conversations/invalid",
    "/app\n",
  ]) {
    expect(returnPath(path)).toBe("/app/conversations");
  }
});
