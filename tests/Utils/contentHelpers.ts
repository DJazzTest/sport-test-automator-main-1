import type { APIRequestContext, Page } from '@playwright/test';

export type BrokenLinkResult = {
  url: string;
  status: number;
  text?: string;
};

export type BrokenImageResult = {
  src: string;
  reason: string;
  alt?: string;
};

/** Scroll the page to encourage lazy-loaded content. */
export async function scrollThroughPage(page: Page): Promise<void> {
  try {
    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel(0, 900);
      await page.waitForTimeout(120);
    }
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
    await page.waitForTimeout(200);
    await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  } catch {
    // Page may be closing; ignore
  }
}

type CheckBrokenImagesOptions = {
  maxHttpChecks?: number;
  pollMs?: number;
  pollDeadlineMs?: number;
};

type CheckBrokenLinksOptions = {
  maxLinks?: number;
  timeout?: number;
};

const SKIP_IMAGE_HOST =
  /doubleclick|googletagmanager|google-analytics|facebook\.com|twitter\.com|x\.com|youtube\.com|ytimg\.com/i;
/** Legacy SA CDN — not used on www.teamtalk.com; DOM zero-dim checks are not reproducible. */
const LEGACY_TEAMTALK_SA_IMAGE_HOST = /teamtalk\.365\.co\.za/i;
const CDN_IMAGE_HOST = /ps-aws\.com|images\.teamtalk\.com|planetsport/i;

function shouldSkipImageSrc(src: string): boolean {
  return SKIP_IMAGE_HOST.test(src) || LEGACY_TEAMTALK_SA_IMAGE_HOST.test(src);
}

async function collectVisibleImages(page: Page) {
  return page.evaluate(() => {
    const imgs = Array.from(document.images) as HTMLImageElement[];
    const rows: Array<{ src: string; alt: string; naturalW: number; naturalH: number; cw: number; ch: number }> = [];
    for (const img of imgs) {
      const src = (img.currentSrc || img.src || '').trim();
      if (!src || src.startsWith('data:') || src === window.location.href) continue;
      const rect = img.getBoundingClientRect();
      const style = window.getComputedStyle(img);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      if (rect.width <= 0 || rect.height <= 0) continue;
      rows.push({
        src,
        alt: img.alt || '',
        naturalW: img.naturalWidth,
        naturalH: img.naturalHeight,
        cw: img.clientWidth,
        ch: img.clientHeight,
      });
    }
    return rows;
  });
}

async function imageLoadsViaHttp(request: APIRequestContext, src: string): Promise<boolean> {
  try {
    const res = await request.fetch(src, { method: 'GET', timeout: 12000 });
    if (!res.ok()) return false;
    const ct = (res.headers()['content-type'] || '').toLowerCase();
    return ct.includes('image') || ct.includes('octet-stream') || ct.includes('webp');
  } catch {
    return false;
  }
}

/**
 * Sample visible images and flag likely-broken ones (zero dimensions with a real remote src).
 * Polls briefly for lazy-loaded CDN images; HTTP GET fallback for PlanetSport CDNs.
 */
export async function checkBrokenImages(
  page: Page,
  request: APIRequestContext,
  options: CheckBrokenImagesOptions = {},
): Promise<{ broken: BrokenImageResult[]; totalVisible: number }> {
  const maxHttp = Math.max(1, options.maxHttpChecks ?? 25);
  const pollMs = options.pollMs ?? 500;
  const pollDeadline = Date.now() + (options.pollDeadlineMs ?? 5000);

  let evaluated = await collectVisibleImages(page);
  while (Date.now() < pollDeadline) {
    const suspects = evaluated.filter(
      (r) =>
        r.naturalW === 0 &&
        r.naturalH === 0 &&
        r.cw > 1 &&
        r.ch > 1 &&
        !shouldSkipImageSrc(r.src),
    );
    if (suspects.length === 0) break;
    await page.waitForTimeout(pollMs);
    await page.mouse.wheel(0, 400).catch(() => {});
    evaluated = await collectVisibleImages(page);
  }

  const totalVisible = evaluated.length;
  const broken: BrokenImageResult[] = [];

  for (const row of evaluated.slice(0, maxHttp)) {
    const { src, alt, naturalW, naturalH, cw, ch } = row;
    if (shouldSkipImageSrc(src)) continue;
    if (cw <= 1 && ch <= 1) continue;
    if (naturalW > 0 || naturalH > 0) continue;
    if (naturalW === 0 && naturalH === 0 && cw > 0 && ch > 0) {
      try {
        const host = new URL(src).hostname;
        if (CDN_IMAGE_HOST.test(host) && (await imageLoadsViaHttp(request, src))) continue;
      } catch {
        // keep as broken if URL parse fails
      }
      broken.push({ src, alt, reason: 'zero_natural_dimensions' });
    }
  }

  return { broken, totalVisible };
}

/**
 * Sample in-page http(s) links and HEAD/GET them; status >= 400 counts as broken.
 */
export async function checkBrokenLinks(
  page: Page,
  request: APIRequestContext,
  options: CheckBrokenLinksOptions = {}
): Promise<{ broken: BrokenLinkResult[]; totalChecked: number }> {
  const maxLinks = Math.max(1, options.maxLinks ?? 30);
  const timeout = Math.max(1000, options.timeout ?? 8000);

  const origin = new URL(page.url()).origin;

  const anchors = await page.$$eval('a[href]', (as) => {
    const out: Array<{ href: string; text: string }> = [];
    const seen = new Set<string>();
    for (const a of as as HTMLAnchorElement[]) {
      const href = (a.href || '').trim();
      if (!href || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
      if (!/^https?:\/\//i.test(href)) continue;
      if (seen.has(href)) continue;
      seen.add(href);
      const text = (a.textContent || '').replace(/\s+/g, ' ').trim();
      out.push({ href, text });
    }
    return out;
  });

  const sameSiteFirst = anchors.filter((a) => {
    try {
      return new URL(a.href).origin === origin;
    } catch {
      return false;
    }
  });
  const rest = anchors.filter((a) => !sameSiteFirst.includes(a));
  const ordered = [...sameSiteFirst, ...rest].slice(0, maxLinks);

  const broken: BrokenLinkResult[] = [];

  for (const { href, text } of ordered) {
    try {
      let res = await request.fetch(href, { method: 'HEAD', timeout }).catch(() => null);
      let status = res?.status() ?? 0;
      if (!res || status === 405 || status === 501 || status === 403 || status < 1 || status >= 400) {
        res = await request.fetch(href, { method: 'GET', timeout: Math.max(timeout, 12000) }).catch(() => null);
        status = res?.status() ?? 0;
      }
      if (status === 0 || status >= 400) {
        broken.push({ url: href, status: status || 0, text });
      }
    } catch {
      broken.push({ url: href, status: 0, text });
    }
  }

  return { broken, totalChecked: ordered.length };
}

/** TeamTalk listing freshness: at least one of the top N articles must be within maxAgeMs. */
export const TEAMTALK_STALE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function shouldSkipStaleCheck(url: string): boolean {
  try {
    return /\/page\/\d+\/?$/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

export function isTeamTalkListingPage(url: string): boolean {
  try {
    const path = new URL(url).pathname.replace(/\/$/, '') || '/';
    if (path === '/') return true;
    const hubs = ['/transfer-news', '/confirmed-transfers', '/premier-league', '/exclusives'];
    if (hubs.includes(path)) return true;
    if (/^\/team\/[^/]+(\/(news|fixtures|results|squad|stats))?$/i.test(path)) return true;
    if (path.startsWith('/tag/')) return true;
    return false;
  } catch {
    return false;
  }
}

type StaleEvaluateResult = { stale: boolean; samples: string[] };

/**
 * Metadata-based stale check for TeamTalk (no body-text date scanning).
 * Listing pages: fail if neither of the top 2 articles is within 24h.
 * Article pages: fail if primary publish date is older than 24h.
 */
export async function evaluateTeamTalkStale(
  page: Page,
  pageUrl: string,
  maxAgeMs: number = TEAMTALK_STALE_MAX_AGE_MS,
): Promise<StaleEvaluateResult> {
  const cutoff = Date.now() - maxAgeMs;
  const listing = isTeamTalkListingPage(pageUrl);

  return page.evaluate(
    ({ cutoff, listing, topN }) => {
      function parsePsDateMs(el: Element): number | null {
        const attrs = ['datetime', 'datatime', 'data-ps-datetime', 'data-ps-date'] as const;
        for (const attr of attrs) {
          const raw = el.getAttribute(attr);
          if (!raw) continue;
          if (attr === 'data-ps-datetime') {
            const unix = parseInt(raw, 10);
            if (!Number.isNaN(unix)) return unix * 1000;
          } else {
            const d = Date.parse(raw);
            if (!Number.isNaN(d)) return d;
          }
        }
        return null;
      }

      function collectListingDates(): number[] {
        const dates: number[] = [];
        const cards = Array.from(
          document.querySelectorAll('main article, main [class*="article" i], main [data-component*="Article" i]'),
        );
        for (const card of cards) {
          const timeEl = card.querySelector(
            'time[datetime], time[datatime], time[data-ps-datetime], time[data-ps-date], [data-ps-datetime], [data-ps-date]',
          );
          if (!timeEl) continue;
          const ms = parsePsDateMs(timeEl);
          if (ms !== null) dates.push(ms);
          if (dates.length >= topN) break;
        }
        if (dates.length < topN) {
          for (const el of Array.from(
            document.querySelectorAll(
              'main time[datetime], main time[datatime], main time[data-ps-datetime], main time[data-ps-date]',
            ),
          )) {
            const ms = parsePsDateMs(el);
            if (ms !== null && !dates.includes(ms)) dates.push(ms);
            if (dates.length >= topN) break;
          }
        }
        return dates.slice(0, topN);
      }

      function primaryArticleDateMs(): number | null {
        const meta =
          document.querySelector('meta[property="article:modified_time"]') ||
          document.querySelector('meta[property="article:published_time"]');
        if (meta) {
          const d = Date.parse(meta.getAttribute('content') || '');
          if (!Number.isNaN(d)) return d;
        }
        const article = document.querySelector('article');
        const timeEl =
          article?.querySelector(
            'time[datetime], time[datatime], time[data-ps-datetime], time[data-ps-date]',
          ) ||
          document.querySelector(
            'main time[datetime], main time[datatime], main time[data-ps-datetime], main time[data-ps-date]',
          );
        if (timeEl) return parsePsDateMs(timeEl);
        return null;
      }

      if (listing) {
        const topDates = collectListingDates();
        if (!topDates.length) return { stale: false, samples: [] };
        const hasFresh = topDates.some((d) => d >= cutoff);
        if (hasFresh) return { stale: false, samples: [] };
        return {
          stale: true,
          samples: topDates.map((d) => new Date(d).toISOString().slice(0, 10)),
        };
      }

      const ms = primaryArticleDateMs();
      if (ms === null) return { stale: false, samples: [] };
      if (ms >= cutoff) return { stale: false, samples: [] };
      return { stale: true, samples: [new Date(ms).toISOString().slice(0, 10)] };
    },
    { cutoff, listing, topN: 2 },
  );
}

/** Scroll, poll images, and push hub-compatible Broken image failures. */
export async function assertTeamTalkBrokenImages(
  page: Page,
  request: APIRequestContext,
  sectionName: string,
  emailFailures?: string[],
): Promise<void> {
  await scrollThroughPage(page);
  const { broken, totalVisible } = await checkBrokenImages(page, request, {
    maxHttpChecks: 30,
    pollDeadlineMs: 5000,
  });
  const siteBroken = broken.filter((b) => {
    try {
      if (shouldSkipImageSrc(b.src)) return false;
      const host = new URL(b.src).hostname;
      return host.includes('teamtalk') || host.includes('ps-aws') || host.includes('planetsport');
    } catch {
      return true;
    }
  });
  if (process.env.DEBUG_TEAMTALK === '1') {
    console.log(`[DEBUG_TEAMTALK] images ${sectionName}: ${siteBroken.length} broken of ${totalVisible}`);
  }
  for (const img of siteBroken) {
    const msg = `Broken image: ${sectionName}|${img.src}`;
    if (emailFailures) emailFailures.push(msg);
  }
}

/** Metadata stale check with pagination skip. */
export async function assertTeamTalkStaleContent(
  page: Page,
  sectionName: string,
  emailFailures?: string[],
): Promise<void> {
  const url = page.url();
  if (shouldSkipStaleCheck(url)) {
    if (process.env.DEBUG_TEAMTALK === '1') {
      console.log(`[DEBUG_TEAMTALK] stale skipped (pagination): ${url}`);
    }
    return;
  }
  const { stale, samples } = await evaluateTeamTalkStale(page, url);
  if (process.env.DEBUG_TEAMTALK === '1') {
    console.log(`[DEBUG_TEAMTALK] stale ${sectionName} ${url}: stale=${stale} samples=${samples.join(',')}`);
  }
  if (!stale) return;
  const msg = `${sectionName}: stale articles detected (e.g. ${samples.slice(0, 3).join(', ')})`;
  console.warn(`⚠️ ${msg}`);
  if (emailFailures) emailFailures.push(msg);
}

export type AdDetectionResult = {
  found: boolean;
  containers: number;
  iframeAds: number;
  visibleBlocks: number;
};

const AD_CONTAINER_SELECTORS = [
  'ins.adsbygoogle',
  'iframe[src*="googlesyndication"]',
  'iframe[src*="doubleclick"]',
  'iframe[src*="securepubads"]',
  'iframe[src*="ad" i]',
  'iframe[id*="gpt-ad" i]',
  'iframe[id*="dfp" i]',
  '[id*="ad-slot" i]',
  '[class*="advert" i]',
  '[class*="ad-slot" i]',
  '[data-ad]',
  '[data-ad-unit]',
  '[data-slot]',
  'div[id^="div-gpt-ad"]',
  '[id*="google_ads" i]',
  'div[class*="ps-ad" i]',
  '[id*="gpt-ad" i]',
  '[id*="dfp" i]',
].join(',');

/**
 * Poll with scroll for visible display ads (PlanetSport sites — lazy-loaded slots).
 */
export async function detectDisplayAds(
  page: Page,
  options: { deadlineMs?: number; pollMs?: number } = {},
): Promise<AdDetectionResult> {
  const deadline = Date.now() + (options.deadlineMs ?? 30_000);
  const pollMs = options.pollMs ?? 1000;
  let last: AdDetectionResult = { found: false, containers: 0, iframeAds: 0, visibleBlocks: 0 };

  while (Date.now() < deadline) {
    for (let i = 0; i < 8; i++) {
      await page.mouse.wheel(0, 1200);
      await page.waitForTimeout(200);
    }
    await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});

    const containers = await page.locator(AD_CONTAINER_SELECTORS).count().catch(() => 0);
    const iframeAds = await page.locator('iframe').evaluateAll((frames) =>
      frames.filter((f) => {
        const src = f.getAttribute('src') || '';
        const id = f.id || '';
        return /ad|doubleclick|googlesyndication|pubmatic|rubicon|criteo|securepubads/i.test(src + id);
      }).length,
    ).catch(() => 0);
    const visibleBlocks = await page.evaluate(() => {
      const sel =
        '[id*="ad" i], [class*="advert" i], [class*="ad-slot" i], ins.adsbygoogle, iframe, [data-ad-unit], div[id^="div-gpt-ad"]';
      let n = 0;
      for (const el of document.querySelectorAll(sel)) {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        const r = el.getBoundingClientRect();
        if (r.width >= 80 && r.height >= 50) n++;
      }
      return n;
    }).catch(() => 0);

    last = {
      found: containers > 0 || iframeAds > 0 || visibleBlocks > 0,
      containers,
      iframeAds,
      visibleBlocks,
    };
    if (last.found) return last;
    await page.waitForTimeout(pollMs);
  }

  return last;
}
