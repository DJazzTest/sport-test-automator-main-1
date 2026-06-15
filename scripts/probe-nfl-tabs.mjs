import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('https://dragonbet.co.uk/sport/american-football', { waitUntil: 'domcontentloaded' });
for (const n of [/Accept All/i, /Allow all/i]) {
  try { await page.getByRole('button', { name: n }).click({ timeout: 2000 }); } catch {}
}
await page.waitForTimeout(2000);
const buttons = await page.getByRole('button').allInnerTexts();
console.log('buttons:', [...new Set(buttons.map((b) => b.trim()).filter(Boolean))].slice(0, 40));
const loc = page.locator('[data-test="EventRowNameLink-link"], a[href*="/event/"]');
console.log('events default:', await loc.count());
for (const tab of ['Today', 'Tomorrow', 'Weekend', 'All', 'In-Play', 'In Play', 'Matches']) {
  const btn = page.getByRole('button', { name: tab }).first();
  if (await btn.isVisible().catch(() => false)) {
    await btn.click().catch(() => {});
    await page.waitForTimeout(800);
    console.log(`${tab}:`, await loc.count(), 'events');
  } else {
    console.log(`${tab}: not visible`);
  }
}
await browser.close();
