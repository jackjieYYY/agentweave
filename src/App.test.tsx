import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, expect, it } from "vitest";
import { AppProviders } from "@/app/providers";
import { usePreferences } from "@/stores/preferences";
import App from "./App";

beforeEach(() => {
  localStorage.clear();
  usePreferences.setState({ theme: "light" });
});

it("切换主题，并在重新读取本地存储后恢复选择", async () => {
  const user = userEvent.setup();
  render(
    <AppProviders>
      <MemoryRouter>
        <App />
      </MemoryRouter>
    </AppProviders>,
  );

  await user.click(screen.getByRole("button", { name: "切换到深色主题" }));
  expect(document.documentElement).toHaveClass("dark");
  const saved = localStorage.getItem("agentweave-preferences")!;
  expect(JSON.parse(saved).state).toEqual({ theme: "dark" });

  await act(async () => {
    usePreferences.setState({ theme: "light" });
    localStorage.setItem("agentweave-preferences", saved);
    await usePreferences.persist.rehydrate();
  });
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "切换到浅色主题" })).toBeInTheDocument(),
  );
  expect(document.documentElement).toHaveClass("dark");
});
