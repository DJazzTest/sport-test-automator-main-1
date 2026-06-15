/**
 * Lists DragonBet Football event counts per tab (no event pages opened).
 * Usage: node scripts/count-dragonbet-football-events.mjs
 */
import { chromium } from 'playwright';

const BASE = 'https://dragonbet.co.uk';

async function acceptConsent(page) {
  for (const name of [/Accept All/i, /Accept & Continue/i, /Allow all/i, /^OK$/i]) {
    try {
      await page.getByRole('button', { name }).click({ timeout: 2000 });
    } catch {}
  }
}

async function countTab(page, tab) {
  const btn = page.getByRole('button', { name: tab }).first();
  if (!(await btn.isVisible({ timeout: 2000 }).catch(() => false))) {
    return { tab, visible: false, listed: 0, sample: 0, indices: [] };
  }
  await btn.click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(400);
  if (await page.getByText(/Sorry,? we haven't found any/i).isVisible({ timeout: 1000 }).catch(() => false)) {
    return { tab, visible: true, listed: 0, sample: 0, indices: [] };
  }
  const links = page.locator('[data-test="EventRowNameLink-link"], a[href*="/event/"]');
  const listed = await links.count().catch(() => 0);
  const sample = listed <= 0 ? 0 : listed <= 11 ? listed : listed >= 20 ? Math.min(listed, Math.max(10, Math.ceil(listed / 2))) : Math.min(listed, Math.max(6, Math.ceil(listed / 2)));
  const indices = [];
  if (sample > 0) {
    if (sample >= listed) {
      for (let i = 0; i < listed; i++) indices.push(i + 1);
    } else if (sample === 1) {
      indices.push(1);
    } else {
      for (let i = 0; i < sample; i++) {
        indices.push(Math.round((i * (listed - 1)) / (sample - 1)) + 1);
      }
    }
  }
  const titles = [];
  for (const idx of [...new Set(indices)]) {
    const t = (await links.nth(idx - 1).innerText().catch(() => '')).trim().split('\n')[0];
    titles.push(t);
  }
  return { tab, visible: true, listed, sample, indices: [...new Set(indices)], titles };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(15_000);
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await acceptConsent(page);
try {
  await page.getByRole('link', { name: 'Football' }).first().click({ timeout: 5000 });
} catch {
  await page.goto(`${BASE}/sport/football`, { waitUntil: 'domcontentloaded' });
  await acceptConsent(page);
}
await page.waitForTimeout(500);

const rows = [];
for (const tab of ['Today', 'Tomorrow']) {
  rows.push(await countTab(page, tab));
}
await browser.close();

console.log(JSON.stringify({ at: new Date().toISOString(), tabs: rows }, null, 2));
