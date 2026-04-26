export function apiUrl(path: string): string {
  return `${import.meta.env.BASE_URL}api${path.startsWith("/") ? path : `/${path}`}`.replace(
    /\/{2,}/g,
    (m, offset) => (offset === 0 ? m : "/")
  );
}
