import { Navigate, Outlet, useLocation, useSearchParams } from "react-router";
import { returnPath } from "@/auth/return-path";
import { useSession } from "@/stores/session";

export function RootRedirect() {
  const status = useSession((state) => state.status);
  if (status === "unverified" || status === "restoring") return null;
  return <Navigate replace to={status === "authenticated" ? "/app/conversations" : "/login"} />;
}

export function RequireSession() {
  const status = useSession((state) => state.status);
  const location = useLocation();
  if (status === "unverified" || status === "restoring") return null;
  if (status === "anonymous") {
    const next = returnPath(`${location.pathname}${location.search}${location.hash}`);
    return <Navigate replace to={`/login?returnTo=${encodeURIComponent(next)}`} />;
  }
  return <Outlet />;
}

export function PublicOnly() {
  const status = useSession((state) => state.status);
  const [params] = useSearchParams();
  if (status === "unverified" || status === "restoring") return null;
  return status === "authenticated" ? (
    <Navigate replace to={returnPath(params.get("returnTo"))} />
  ) : (
    <Outlet />
  );
}
