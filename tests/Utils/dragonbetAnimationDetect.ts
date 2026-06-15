import { Page } from '@playwright/test';

export const DRAGONBET_BASE = 'https://dragonbet.co.uk';
export const isQuick = !!(process.env.PLAYWRIGHT_QUICK || process.env.CI);
/** @deprecated Prefer animationSampleCount + spreadEventIndices for DragonBet specs. */
export const MAX_EVENTS_PER_TAB = isQuick ? 3 : 8;
/** Widget poll — shorter on CI once iframe src appears. */
export const WIDGET_POLL_MS = isQuick ? 4_000 : 6_000;

/**
 * How many events to open per tab — spread across the list, not only the first rows.
 * ≤11 listed → all; 12–19 → at least 6 (~half); ≥20 → at least 10 (~half).
 */
export function animationSampleCount(totalListed: number): number {
  if (totalListed <= 0) return 0;
  if (totalListed <= 11) return totalListed;
  const half = Math.ceil(totalListed / 2);
  if (totalListed >= 20) return Math.min(totalListed, Math.max(10, half));
  return Math.min(totalListed, Math.max(6, half));
}

/** Evenly spaced indices — skip events between samples ("miss one, test one"). */
export function spreadEventIndices(totalListed: number): number[] {
  const count = animationSampleCount(totalListed);
  if (count <= 0) return [];
  if (count >= totalListed) {
    return Array.from({ length: totalListed }, (_, i) => i);
  }
  if (count === 1) return [0];
  const indices: number[] = [];
  for (let i = 0; i < count; i++) {
    indices.push(Math.round((i * (totalListed - 1)) / (count - 1)));
  }
  return [...new Set(indices)].sort((a, b) => a - b);
}

/** Fail fast: default Playwright action timeout inherits test timeout (8m+) without this. */
export function configureDragonBetTimeouts(page: Page): void {
  page.setDefaultTimeout(10_000);
  page.setDefaultNavigationTimeout(20_000);
}

export const DRAGONBET_GEO_BLOCK_FAILURE =
  'DragonBet geo-block: GitHub-hosted runners use non-UK IPs and cannot open dragonbet.co.uk. Use a UK self-hosted Actions runner on your Mac, or set the DRAGONBET_UK_PROXY repository secret.';

export async function assertDragonBetAccessible(page: Page): Promise<void> {
  const blocked =
    (await page.getByText(/outside UK or Ireland/i).isVisible({ timeout: 2500 }).catch(() => false)) ||
    (await page
      .getByText(/blocks access from users accessing from certain territories/i)
      .isVisible({ timeout: 1000 })
      .catch(() => false));
  if (blocked) {
    throw new Error(DRAGONBET_GEO_BLOCK_FAILURE);
  }
}

export async function openDragonBetHome(page: Page): Promise<void> {
  await page.goto(DRAGONBET_BASE, { waitUntil: 'domcontentloaded', timeout: 25_000 });
  await acceptDragonBetConsent(page);
  await assertDragonBetAccessible(page);
}

export async function openDragonBetSport(
  page: Page,
  sportPath: string,
  linkPattern: RegExp | string,
): Promise<void> {
  const directUrl = `${DRAGONBET_BASE}/sport/${sportPath}`;
  try {
    const link =
      typeof linkPattern === 'string'
        ? page.getByRole('link', { name: linkPattern }).first()
        : page.getByRole('link', { name: linkPattern }).first();
    await link.click({ timeout: 4000 });
    await page.waitForURL(new RegExp(`/sport/${sportPath}`), { timeout: 10_000 });
  } catch {
    await page.goto(directUrl, { waitUntil: 'domcontentloaded', timeout: 25_000 });
    await acceptDragonBetConsent(page);
  }
  if (!page.url().includes(`/sport/${sportPath}`)) {
    await page.goto(directUrl, { waitUntil: 'domcontentloaded', timeout: 25_000 });
    await acceptDragonBetConsent(page);
  }
  await assertDragonBetAccessible(page);
  try {
    await page.getByRole('button', { name: 'All' }).first().click({ timeout: 3000 });
    await page.waitForTimeout(400);
  } catch {}
}

export async function acceptDragonBetConsent(page: Page): Promise<void> {
  try { await page.getByRole('button', { name: /Accept All/i }).click({ timeout: 2500 }); } catch {}
  try { await page.getByRole('button', { name: /Accept & Continue/i }).click({ timeout: 2000 }); } catch {}
  try { await page.getByRole('button', { name: /Allow all/i }).click({ timeout: 2000 }); } catch {}
  try { await page.getByRole('button', { name: /^OK$/i }).click({ timeout: 1500 }); } catch {}
}

export function eventListingLinks(page: Page) {
  return page.locator('[data-test="EventRowNameLink-link"], a[href*="/event/"]');
}

/** Wait for lazy-loaded event rows (GitHub runners often need longer than local). */
export async function waitForEventListing(page: Page, timeoutMs = 15_000): Promise<number> {
  const links = eventListingLinks(page);
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await page.getByText(/Sorry,? we haven't found any/i).isVisible({ timeout: 400 }).catch(() => false)) {
      return 0;
    }
    const n = await links.count().catch(() => 0);
    if (n > 0) return n;
    await page.waitForTimeout(350);
  }
  return links.count().catch(() => 0);
}

export async function eventTitle(link: ReturnType<typeof eventListingLinks>['nth']): Promise<string> {
  const raw = (await link.innerText().catch(() => '')).trim();
  return raw.split('\n')[0]?.trim() || raw || 'Event';
}

export async function expandLiveTracker(page: Page): Promise<void> {
  try {
    const heading = page.getByRole('heading', { name: /Live tracker/i }).first();
    if (await heading.isVisible({ timeout: 1500 }).catch(() => false)) {
      await heading.click({ timeout: 2000 });
      await page.waitForTimeout(400);
      return;
    }
  } catch {}
  try {
    const collapse = page.locator('div[class*="CollapseLabel"]').filter({ hasText: /Live tracker/i }).first();
    if (await collapse.isVisible({ timeout: 1500 }).catch(() => false)) {
      await collapse.click({ timeout: 2000 });
      await page.waitForTimeout(400);
    }
  } catch {}
}

/** Poll iframe src until thesports01 widget is visible — avoids 2s false negatives. */
export async function pollTheSportsWidget(
  page: Page,
  containerSelectors: string[],
  waitMs = WIDGET_POLL_MS,
): Promise<boolean> {
  for (const selector of containerSelectors) {
    const container = page.locator(selector).first();
    try {
      await container.scrollIntoViewIfNeeded().catch(() => {});
      await container.waitFor({ state: 'visible', timeout: 2_000 });
      const iframe = container.locator('iframe').first();
      const start = Date.now();
      while (Date.now() - start < waitMs) {
        const visible = await iframe.isVisible().catch(() => false);
        const src = await iframe.getAttribute('src').catch(() => null);
        if (visible && src && /widgets\.thesports01\.com/i.test(src)) return true;
        await page.waitForTimeout(200);
      }
    } catch {}
  }
  return false;
}

export async function detectSportAnimation(page: Page, sport: 'football' | 'cricket' | 'tennis' | 'nfl'): Promise<boolean> {
  const bySport: Record<typeof sport, string[]> = {
    football: ['.animated_widget', '#the-football-sport-widget', '#the-soccer-sport-widget'],
    cricket: ['#the-cricket-sport-widget', '.animated_widget'],
    tennis: ['#the-tennis-sport-widget', '.animated_widget'],
    nfl: ['div.animated_widget', '#the-nfl-sport-widget'],
  };
  return pollTheSportsWidget(page, bySport[sport]);
}
