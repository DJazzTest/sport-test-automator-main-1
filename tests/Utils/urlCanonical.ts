/**
 * Canonical URL fixes for known slug mismatches (false 404s in link health checks).
 */
export function canonicalizePlanetSportUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.slice(0, -1);
    }
    if (/^\/driver\/alexander-albon$/i.test(u.pathname)) {
      u.pathname = '/driver/alex-albon';
    }
    return u.toString();
  } catch {
    return url;
  }
}

/** Default timeout for full-site crawls (11 tabs, deep link checks). */
export const FULL_SITE_TEST_TIMEOUT_MS = 10 * 60_000;

/** Ad detection poll budget for content site specs. */
export const AD_DETECT_DEADLINE_MS = process.env.PLAYWRIGHT_QUICK || process.env.CI ? 20_000 : 22_000;
