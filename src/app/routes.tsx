import { Navigate, type RouteObject } from "react-router";
import { AppLayout, SettingsLayout } from "@/app/layouts";
import { PublicOnly, RequireSession, RootRedirect } from "@/auth/routes";
import { ChatPage } from "@/pages/chat";
import { ConversationsPage } from "@/pages/conversations";
import { LoginPage } from "@/pages/login";
import { ModelsPage } from "@/pages/models";
import { NotFoundPage } from "@/pages/not-found";
import { ProvidersPage } from "@/pages/providers";
import { RegisterPage } from "@/pages/register";

export const routes: RouteObject[] = [
  { path: "/", Component: RootRedirect },
  {
    Component: PublicOnly,
    children: [
      { path: "/login", Component: LoginPage },
      { path: "/register", Component: RegisterPage },
    ],
  },
  {
    Component: RequireSession,
    children: [
      {
        path: "/app",
        Component: AppLayout,
        children: [
          { index: true, element: <Navigate replace to="conversations" /> },
          { path: "conversations", Component: ConversationsPage },
          { path: "conversations/:conversationId", Component: ChatPage },
          {
            path: "settings",
            Component: SettingsLayout,
            children: [
              { index: true, element: <Navigate replace to="providers" /> },
              { path: "providers", Component: ProvidersPage },
              { path: "models", Component: ModelsPage },
            ],
          },
        ],
      },
    ],
  },
  { path: "*", Component: NotFoundPage },
];
