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

/** Reserved TeamTalk first-path segments that are not player/topic bare slugs. */
const TEAMTALK_RESERVED_ROOT = new Set([
  'team',
  'news',
  'tag',
  'transfer-news',
  'confirmed-transfers',
  'premier-league',
  'exclusives',
  'page',
  'content',
  'forum',
  'videos',
  'video',
  'live',
  'author',
  'category',
  'wp-content',
  'wp-json',
]);

/**
 * TeamTalk often links bare `/{player}` profiles that 404 while `/tag/{player}` works.
 * Return the tag URL to retry when the path looks like a single-segment topic slug.
 */
export function teamTalkTagFallbackUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host !== 'www.teamtalk.com' && host !== 'teamtalk.com') return null;
    const path = u.pathname.replace(/\/$/, '') || '/';
    const m = path.match(/^\/([a-z0-9][a-z0-9-]{1,80})$/i);
    if (!m) return null;
    if (TEAMTALK_RESERVED_ROOT.has(m[1].toLowerCase())) return null;
    return `https://www.teamtalk.com/tag/${m[1].toLowerCase()}`;
  } catch {
    return null;
  }
}

/** Default timeout for full-site crawls (11 tabs, deep link checks). */
export const FULL_SITE_TEST_TIMEOUT_MS = 10 * 60_000;

/** Ad detection poll budget for content site specs. */
export const AD_DETECT_DEADLINE_MS = process.env.PLAYWRIGHT_QUICK || process.env.CI ? 20_000 : 22_000;
