import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type Theme = "light" | "dark";

interface Preferences {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const usePreferences = create<Preferences>()(
  persist((set) => ({ theme: "light", setTheme: (theme) => set({ theme }) }), {
    name: "agentweave-preferences",
    storage: createJSONStorage(() => localStorage),
    partialize: ({ theme }) => ({ theme }),
  }),
);
