import { Moon, Sun, Waypoints } from "lucide-react";
import { Link, Route, Routes } from "react-router";
import { Button } from "@/components/ui/button";
import { usePreferences } from "@/stores/preferences";

function Home() {
  const theme = usePreferences((state) => state.theme);
  const setTheme = usePreferences((state) => state.setTheme);

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <Waypoints className="size-5" aria-hidden="true" />
          AgentWeave
        </Link>
        <Button
          variant="outline"
          size="icon"
          aria-label={theme === "light" ? "切换到深色主题" : "切换到浅色主题"}
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        >
          {theme === "light" ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
        </Button>
      </header>
      <main className="mx-auto flex max-w-5xl flex-col gap-5 px-6 py-24 sm:py-36">
        <p className="text-sm font-medium text-muted-foreground">AgentLoom 的交互工作台</p>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-6xl">
          让想法与 Agent 协同展开。
        </h1>
        <p className="max-w-xl text-base leading-7 text-muted-foreground">
          在这里发起对话、选择模型，并掌握每一步执行。工作台正在构建中。
        </p>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route
        path="*"
        element={
          <main className="grid min-h-svh place-content-center gap-4 p-6 text-center">
            <h1 className="text-2xl font-semibold">页面不存在</h1>
            <Button asChild variant="outline">
              <Link to="/">返回首页</Link>
            </Button>
          </main>
        }
      />
    </Routes>
  );
}
