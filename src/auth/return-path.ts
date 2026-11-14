export function returnPath(value: string | null): string {
  const fallback = "/app/conversations";
  if (
    !value?.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    [...value].some((character) => character.charCodeAt(0) <= 32)
  )
    return fallback;
  const url = new URL(value, "https://agentweave.local");
  const path = url.pathname.replace(/\/$/, "");
  const known = [
    "/app",
    fallback,
    "/app/settings",
    "/app/settings/providers",
    "/app/settings/models",
  ];
  const id = path.startsWith(`${fallback}/`) ? path.slice(fallback.length + 1) : "";
  const conversationId = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id);
  return known.includes(path) || conversationId
    ? `${url.pathname}${url.search}${url.hash}`
    : fallback;
}
