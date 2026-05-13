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
      const st = res?.status() ?? 0;
      if (!res || st === 405 || st === 501) {
        res = await request.fetch(href, { method: 'GET', timeout }).catch(() => null);
      }
      const status = res?.status() ?? 0;
      if (status === 0 || status >= 400) {
        broken.push({ url: href, status: status || 0, text });
      }
    } catch {
      broken.push({ url: href, status: 0, text });
    }
  }

  return { broken, totalChecked: ordered.length };
}
