import { test, expect, Page } from '@playwright/test';

const DRAGONSPORTS_BASE = process.env.DRAGONSPORTS_BASE?.replace(/\/$/, '') || 'https://www.dragonsports.co.uk';

async function acceptConsent(page: Page) {
  // Best-effort consent dismiss for DragonSports (similar to other sites in the network)
  try {
    const btn = page.getByRole('button', { name: /Accept|Allow all|I agree/i }).first();
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn.click({ timeout: 5000 }).catch(() => {});
      return;
    }
  } catch {
    // ignore
  }

  // Fallback: look for common consent containers
  try {
    const root = page.locator('#uniccmp, [id*="consent"], [class*="cookie"]');
    if (await root.count()) {
      const anyBtn = root.getByRole('button').first();
      if (await anyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await anyBtn.click({ timeout: 5000 }).catch(() => {});
      }
    }
  } catch {
    // ignore
  }
}

// Heuristic A (list page): does the currently selected Live Scores date have at least one
// FT row with a non-trivial score in RugbyListStatus, e.g. "15 - 27" (not "NSY", not "0 - 0")?
async function hasRealResultFromList(page: Page): Promise<boolean> {
  const ftBoxes = page
    .locator('.RugbyListBox')
    .filter({ has: page.locator('.RugbyListTime label', { hasText: /^FT$/ }) });
  const count = await ftBoxes.count().catch(() => 0);
  if (!count) return false;

  for (let i = 0; i < count; i++) {
    const statusSpan = ftBoxes.nth(i).locator('.RugbyListStatus span').first();
    const text = (await statusSpan.textContent().catch(() => ''))?.trim() ?? '';
    if (!text) continue;
    const norm = text.replace(/\s+/g, ' ');
    if (norm === 'NSY' || norm === '0 - 0') continue;
    if (/\d+\s*-\s*\d+/.test(norm)) return true;
  }
  return false;
}

// Heuristic B (detail page): fall back to checking match detail pages via dsRugbyDetailTeamScore spans.
async function hasRealResultForCurrentDate(page: Page): Promise<boolean> {
  const fixtureLinks = page.getByRole('link', { name: / v /i });
  const count = await fixtureLinks.count().catch(() => 0);
  if (!count) return false;

  const maxSample = Math.min(count, 5);
  for (let i = 0; i < maxSample; i++) {
    const link = fixtureLinks.nth(i);
    const href = await link.getAttribute('href').catch(() => null);
    if (!href) continue;

    const absUrl = href.startsWith('http') ? href : new URL(href, DRAGONSPORTS_BASE).toString();
    const detailPage = await page.context().newPage();
    try {
      await detailPage.goto(absUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 });
      const scoreNodes = detailPage.locator('span.dsRugbyDetailTeamScore');
      const scoreTexts = await scoreNodes.allTextContents().catch(() => []);
      if (!scoreTexts.length) {
        await detailPage.close().catch(() => {});
        continue;
      }

      const hasReal = scoreTexts.some(t => {
        const v = (t || '').trim();
        if (!v) return false;
        if (v === 'NSY') return false;
        if (v.replace(/\s+/g, ' ') === '0 - 0') return false;
        return /\d+\s*-\s*\d+/.test(v);
      });

      await detailPage.close().catch(() => {});
      if (hasReal) return true;
    } catch {
      await detailPage.close().catch(() => {});
    }
  }

  return false;
}

test('DragonSports – Welsh Rugby Live Scores – results over last 4 days', async ({ page }) => {
  test.setTimeout(90_000);

  console.log('🧪 DragonSports – Welsh Rugby Live Scores multi-day check');

  // 1) Go to DragonSports home
  await page.goto(DRAGONSPORTS_BASE, { waitUntil: 'domcontentloaded' });

  // 1a) Handle Uniconsent pop‑up FIRST – "Agree and proceed"
  const agree = page.getByRole('button', { name: 'Agree and proceed' }).first();
  if (await agree.isVisible({ timeout: 5000 }).catch(() => false)) {
    await agree.click({ timeout: 5000 }).catch(() => {});
    await page.locator('#uniccmp').first().waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  }

  // 2) Open Welsh Rugby → Live using the nav list item with combined text "Welsh RugbyNewsLive"
  const welshRugbyItem = page
    .getByRole('listitem')
    .filter({ hasText: 'Welsh RugbyNewsLive' })
    .first();
  await expect(welshRugbyItem, 'Welsh Rugby list item should be present in the main nav').toBeVisible();

  // Click the chevron / SVG path to expand / navigate (matches your recorded step)
  await welshRugbyItem.locator('path').first().click({ timeout: 8000, force: true });

  // 3) Ensure we are on the Live view
  const liveScoresLink = page.getByRole('link', { name: /Live Scores/i }).first();
  if (await liveScoresLink.isVisible({ timeout: 5000 }).catch(() => false)) {
    await liveScoresLink.click({ timeout: 8000 }).catch(() => {});
  }

  // Compute today and previous days in YYYY-MM-DD to match the text content used in the calendar.
  const today = new Date();
  const makeDateStr = (offsetDays: number) => {
    const d = new Date(today);
    d.setDate(today.getDate() - offsetDays);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return { d, str: `${yyyy}-${mm}-${dd}` };
  };
  const { str: todayStr } = makeDateStr(0);

  // Helper to click a raw ISO date cell if human-readable button isn't available
  const selectDate = async (dateStr: string) => {
    const dateCell = page.locator('div').filter({ hasText: new RegExp(`^${dateStr}$`) }).first();
    await dateCell.click({ timeout: 8000 }).catch(() => {});
  };

  // We want to explicitly check: today, yesterday, and three days ago (18th) – i.e. today-0, -1, -3.
  const dayChecks = [
    { label: 'today', offset: 0, iso: todayStr },
    { label: 'yesterday', offset: 1, iso: makeDateStr(1).str },
    { label: 'three days ago', offset: 3, iso: makeDateStr(3).str },
  ];

  const calendarRoot = page.getByTestId('calendar');
  const resultsSummary: { label: string; iso: string; hasResult: boolean }[] = [];
  let anyResult = false;

  for (const day of dayChecks) {
    if (day.offset > 0) {
      // Re-open calendar and select the day.
      if (await calendarRoot.count().catch(() => 0)) {
        const icon = calendarRoot.getByRole('img').first();
        if (await icon.isVisible({ timeout: 5000 }).catch(() => false)) {
          await icon.click({ timeout: 8000 }).catch(() => {});
        } else {
          await calendarRoot.click({ timeout: 8000 }).catch(() => {});
        }
      }

      const { d } = makeDateStr(day.offset);
      const humanLabel = new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'long',
      }).format(d);

      const dayButton = page.getByRole('button', { name: new RegExp(`^${humanLabel}$`) }).first();
      if (await dayButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await dayButton.click({ timeout: 8000 }).catch(() => {});
      } else {
        await selectDate(day.iso);
      }
    }

    // Scroll through the page to ensure all competitions for this date are loaded.
    await page.evaluate(() => {
      const doc = document.documentElement || document.body;
      if (doc) {
        window.scrollTo(0, doc.scrollHeight || 0);
      }
    });
    await page.waitForTimeout(500);

    // Count FT rows for this date using RugbyListTime: <div class="RugbyListTime"><label>FT</label></div>
    const ftLocator = page.locator('.RugbyListTime label', { hasText: /^FT$/ });
    const ftCount = await ftLocator.count().catch(() => 0);
    console.log(`   • FT matches for ${day.label} (${day.iso}): ${ftCount}`);

    let hasResult = false;
    if (ftCount > 0) {
      // First try to confirm results directly from the FT rows on the list page
      hasResult = await hasRealResultFromList(page);
      // If that fails for some reason, fall back to opening detail pages
      if (!hasResult) {
        hasResult = await hasRealResultForCurrentDate(page);
      }
    }

    resultsSummary.push({ label: day.label, iso: day.iso, hasResult });
    if (hasResult) anyResult = true;

    const icon = hasResult ? '✅' : (ftCount === 0 ? 'ℹ️' : '❌');
    const status = hasResult
      ? 'real results found'
      : (ftCount === 0 ? 'no FT matches found for this date' : 'FT matches but no valid final scores (NSY / 0-0 only)');
    console.log(`${icon} ${day.label.toUpperCase()} (${day.iso}) – ${status}`);
  }

  console.log('📋 DragonSports – Live Scores summary (today, yesterday, 3 days ago):');
  for (const r of resultsSummary) {
    console.log(`   - ${r.label} (${r.iso}): ${r.hasResult ? 'HAS RESULTS' : 'no confirmed results'}`);
  }

  await expect(
    anyResult,
    'Expected at least one real rugby result across today, yesterday, and three days ago (e.g. 18th)'
  ).toBeTruthy();
});

