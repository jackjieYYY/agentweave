import { expect, it } from "vitest";
import html from "../../index.html?raw";

it.each([
  { stored: '{"state":{"theme":"dark"},"version":0}', theme: "dark" },
  { stored: '{"state":{"theme":"light"},"version":0}', theme: "light" },
  { stored: null, theme: "light" },
  { stored: "invalid JSON", theme: "light" },
  { stored: '{"state":{"theme":"unknown"}}', theme: "light" },
  { stored: null, theme: "light", blocked: true },
])("在 React 启动前恢复 $theme 主题：$stored，存储受限：$blocked", ({ stored, theme, blocked }) => {
  const frame = document.createElement("iframe");
  document.body.append(frame);

  try {
    const frameWindow = frame.contentWindow!;
    if (blocked) {
      Object.defineProperty(frameWindow, "localStorage", {
        get() {
          throw new DOMException("Storage is unavailable", "SecurityError");
        },
      });
    } else {
      frameWindow.localStorage.clear();
      if (stored !== null) {
        frameWindow.localStorage.setItem("agentweave-preferences", stored);
      }
    }

    const frameDocument = frame.contentDocument!;
    frameDocument.open();
    frameDocument.write(html);
    frameDocument.close();

    expect(frameDocument.documentElement.classList.contains("dark")).toBe(theme === "dark");
    expect(frameDocument.documentElement.style.colorScheme).toBe(theme);
    expect(frameDocument.getElementById("root")).toBeEmptyDOMElement();
  } finally {
    frame.remove();
  }
});
