/** Runtime helpers for deployments on a domain, subdomain or arbitrary mount path. */

/**
 * In development this module lives below /src/, in production below /assets/.
 * Going one level up therefore yields the public application root in both cases.
 */
export const APP_BASE_URL = new URL("../", import.meta.url);

export const APP_BASENAME =
  APP_BASE_URL.pathname === "/" ? "/" : APP_BASE_URL.pathname.replace(/\/$/, "");

export function appUrl(path: string): URL {
  return new URL(path.replace(/^\/+/, ""), APP_BASE_URL);
}
