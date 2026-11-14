import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import { AppProviders } from "@/app/providers";
import { usePreferences } from "@/stores/preferences";

beforeEach(() => {
  localStorage.clear();
  usePreferences.setState({ theme: "light" });
});

it("切换主题，并在重新读取本地存储后恢复选择", async () => {
  render(<AppProviders>{null}</AppProviders>);

  act(() => usePreferences.getState().setTheme("dark"));
  expect(document.documentElement).toHaveClass("dark");
  const saved = localStorage.getItem("agentweave-preferences")!;
  expect(JSON.parse(saved).state).toEqual({ theme: "dark" });

  await act(async () => {
    usePreferences.setState({ theme: "light" });
    localStorage.setItem("agentweave-preferences", saved);
    await usePreferences.persist.rehydrate();
  });
  await waitFor(() => expect(document.documentElement).toHaveClass("dark"));
});
