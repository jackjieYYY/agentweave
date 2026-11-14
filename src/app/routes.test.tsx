import { act, render, waitFor } from "@testing-library/react";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { afterEach, beforeEach, expect, it } from "vitest";
import { routes } from "@/app/routes";
import { replaceSession, useSession } from "@/stores/session";

const user = { id: "user-a", email: "alice@example.com", createdAt: "2026-01-01T00:00:00Z" };
let router: ReturnType<typeof createMemoryRouter> | undefined;

beforeEach(() => replaceSession(null, null));
afterEach(() => {
  router?.dispose();
  replaceSession(null, null);
});

it("匿名访问受保护深链时保留登录返回地址", async () => {
  const path = "/app/conversations/57f2be46-ea7a-4cba-a681-b1ef731dc8df?view=history#latest";
  router = createMemoryRouter(routes, { initialEntries: [path] });
  const { container } = render(<RouterProvider router={router} />);

  await waitFor(() => expect(router!.state.location.pathname).toBe("/login"));
  expect(new URLSearchParams(router.state.location.search).get("returnTo")).toBe(path);
  expect(container).toBeEmptyDOMElement();
});

it("身份确认前保留路由，确认后执行设置页的默认跳转", async () => {
  replaceSession("token", null);
  router = createMemoryRouter(routes, { initialEntries: ["/app/settings"] });
  render(<RouterProvider router={router} />);
  expect(router.state.location.pathname).toBe("/app/settings");

  act(() => useSession.setState({ status: "authenticated", user }));

  await waitFor(() => expect(router!.state.location.pathname).toBe("/app/settings/providers"));
});

it.each([
  { authenticated: false, entry: "/", target: "/login" },
  { authenticated: true, entry: "/", target: "/app/conversations" },
  { authenticated: true, entry: "/app", target: "/app/conversations" },
  {
    authenticated: true,
    entry: "/login?returnTo=%2Fapp%2Fsettings%2Fmodels",
    target: "/app/settings/models",
  },
])("根据身份跳转 $entry → $target", async ({ authenticated, entry, target }) => {
  if (authenticated) replaceSession("token", user);
  router = createMemoryRouter(routes, { initialEntries: [entry] });
  render(<RouterProvider router={router} />);

  await waitFor(() => expect(router!.state.location.pathname).toBe(target));
});
