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
};

type CheckBrokenLinksOptions = {
  maxLinks?: number;
  timeout?: number;
};

/**
 * Sample visible images and flag likely-broken ones (zero dimensions with a real remote src).
 */
export async function checkBrokenImages(
  page: Page,
  _request: APIRequestContext,
  options: CheckBrokenImagesOptions = {}
): Promise<{ broken: BrokenImageResult[]; totalVisible: number }> {
  const maxHttp = Math.max(1, options.maxHttpChecks ?? 25);

  const evaluated = await page.evaluate(() => {
    const imgs = Array.from(document.images) as HTMLImageElement[];
    const rows: Array<{ src: string; alt: string; naturalW: number; naturalH: number; cw: number; ch: number }> = [];
    for (const img of imgs) {
      const src = (img.currentSrc || img.src || '').trim();
      if (!src || src.startsWith('data:') || src === window.location.href) continue;
      const rect = img.getBoundingClientRect();
      const inView = rect.width > 0 && rect.height > 0;
      if (!inView) continue;
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

  const totalVisible = evaluated.length;
  const broken: BrokenImageResult[] = [];

  for (const row of evaluated.slice(0, maxHttp)) {
    const { src, alt, naturalW, naturalH, cw, ch } = row;
    if (naturalW === 0 && naturalH === 0 && cw > 0 && ch > 0) {
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
