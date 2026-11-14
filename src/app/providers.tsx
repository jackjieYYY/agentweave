import { useEffect, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { sessionActions } from "@/auth/session";
import { queryClient } from "@/lib/query-client";
import { usePreferences } from "@/stores/preferences";

export function AppProviders({ children }: { children: ReactNode }) {
  const theme = usePreferences((state) => state.theme);

  useEffect(() => {
    void sessionActions.restore().catch(() => {});
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
