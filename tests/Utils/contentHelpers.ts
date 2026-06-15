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
const CDN_IMAGE_HOST = /ps-aws\.com|images\.teamtalk\.com|planetsport/i;

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
      (r) => r.naturalW === 0 && r.naturalH === 0 && r.cw > 1 && r.ch > 1 && !SKIP_IMAGE_HOST.test(r.src),
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
    if (SKIP_IMAGE_HOST.test(src)) continue;
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

/** Listing freshness: each of the top N `time.text-time` articles must be within maxAgeMs. */
export const TEAMTALK_STALE_MAX_AGE_MS = 8 * 60 * 60 * 1000;
export const TEAMTALK_STALE_TOP_N = 2;

export function shouldSkipStaleCheck(url: string): boolean {
  try {
    const path = new URL(url).pathname;
    if (/\/page\/\d+\/?$/i.test(path)) return true;
    // Tag hubs are topical archives (drilled from home); freshness is checked on primary feeds only.
    if (path.startsWith('/tag/')) return true;
    return false;
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
    return false;
  } catch {
    return false;
  }
}

/** Stale freshness is checked on the homepage feed only (not hubs, drills, or articles). */
export function isTeamTalkStaleListingPage(url: string): boolean {
  try {
    const path = new URL(url).pathname.replace(/\/$/, '') || '/';
    return path === '/';
  } catch {
    return false;
  }
}

type StaleEvaluateResult = { stale: boolean; samples: string[] };

/**
 * Top-two listing freshness using TeamTalk's `time.text-time` + `data-ps-datetime`.
 * Only runs on primary listing pages (home, hubs, team news) — not articles, tags, or drills.
 */
export async function evaluateTeamTalkStale(
  page: Page,
  pageUrl: string,
  maxAgeMs: number = TEAMTALK_STALE_MAX_AGE_MS,
): Promise<StaleEvaluateResult> {
  if (!isTeamTalkStaleListingPage(pageUrl) || shouldSkipStaleCheck(pageUrl)) {
    return { stale: false, samples: [] };
  }

  await page.mouse.wheel(0, 2000).catch(() => {});
  await page.waitForTimeout(400);

  const times = page.locator('time.text-time');
  const count = await times.count();
  const topN = TEAMTALK_STALE_TOP_N;
  if (count < topN) {
    return { stale: false, samples: [] };
  }

  const now = Date.now();
  const dated: number[] = [];

  for (let i = 0; i < topN; i++) {
    const raw = await times.nth(i).getAttribute('data-ps-datetime');
    if (!raw) continue;
    const ms = parseInt(raw, 10) * 1000;
    if (Number.isNaN(ms)) continue;
    dated.push(ms);
  }

  if (dated.length < topN) return { stale: false, samples: [] };
  const samples = dated.map((ms) => new Date(ms).toISOString().slice(0, 10));
  const hasFresh = dated.some((ms) => now - ms <= maxAgeMs);
  if (hasFresh) return { stale: false, samples: [] };
  return { stale: true, samples };
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
      if (SKIP_IMAGE_HOST.test(b.src)) return false;
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
  const msg = `${sectionName}: top ${TEAMTALK_STALE_TOP_N} articles older than ${TEAMTALK_STALE_MAX_AGE_MS / 3_600_000}h (e.g. ${samples.slice(0, 3).join(', ')})`;
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
