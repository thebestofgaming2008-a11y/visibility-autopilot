export function isRecoveryCallback(search: string, hash: string): boolean {
  const params = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ""));
  return (
    params.has("recovery") ||
    params.get("type") === "recovery" ||
    fragment.get("type") === "recovery"
  );
}

export function entryTarget(search: string, hash: string): string {
  const params = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ""));
  const authCallback =
    params.has("code") ||
    params.has("token_hash") ||
    isRecoveryCallback(search, hash) ||
    fragment.has("access_token");
  return authCallback ? `/auth${search}${hash}` : "/overview";
}
