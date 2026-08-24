const maximumDestinationLength = 512;

export type IntendedDestinationStore = Readonly<{
  remember(path: string): boolean;
  consume(): string | null;
  clear(): void;
}>;

export function createIntendedDestinationStore(
  options: Readonly<{ now?: () => number; ttlMs?: number }> = {},
): IntendedDestinationStore {
  const now = options.now ?? Date.now;
  const ttlMs = options.ttlMs ?? 60 * 60 * 1000;
  let value: { path: string; expiresAt: number } | null = null;

  return Object.freeze({
    remember(path: string) {
      const safe = sanitizeIntendedDestination(path);
      if (!safe) return false;
      value = { path: safe, expiresAt: now() + ttlMs };
      return true;
    },
    consume() {
      const remembered = value;
      value = null;
      if (!remembered || remembered.expiresAt <= now()) return null;
      return remembered.path;
    },
    clear() {
      value = null;
    },
  });
}

export function sanitizeIntendedDestination(raw: string) {
  if (
    !raw.startsWith("/")
    || raw.startsWith("//")
    || raw.includes("\\")
    || raw.length > maximumDestinationLength
    || /[\u0000-\u001f\u007f]/.test(raw)
  ) return null;

  let url: URL;
  try {
    url = new URL(raw, "https://native.everaft.invalid");
  } catch {
    return null;
  }
  if (url.origin !== "https://native.everaft.invalid") return null;
  if (url.pathname.startsWith("/auth/")) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}
