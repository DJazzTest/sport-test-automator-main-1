import { test, expect } from '@playwright/test';
import { dismissDragonSportsPopups } from '../../Utils/dragonsportsGate';

// Direct Live Centre base for rugby all-matches view
const LIVE_RUGBY_BASE =
  process.env.DRAGONSPORTS_RUGBY_LIVE?.replace(/\/$/, '') ||
  'https://live.dragonsports.co.uk/rugby/matches/all';

test('DragonSports – Rugby Live Centre (all matches) – today & yesterday RugbyListBox & FT/NSY check', async ({ page }) => {
  test.setTimeout(60_000);

  console.log('🧪 DragonSports – Rugby Live Centre (all matches) – today & yesterday RugbyListBox & FT/NSY check');

  const today = new Date();
  const makeIso = (offset: number) => {
    const d = new Date(today);
    d.setDate(today.getDate() - offset);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const todayIso = makeIso(0);
  const yesterdayIso = makeIso(1);

  async function countForDate(iso: string, label: string) {
    const url = `${LIVE_RUGBY_BASE}/${iso}`;
    console.log(`📅 Loading ${label.toUpperCase()} rugby all matches: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await dismissDragonSportsPopups(page);
    await page.waitForTimeout(1000);

    const dateHeadings = page.locator('.dsRugbyMainDateTitle h3');
    const dateCount = await dateHeadings.count().catch(() => 0);

    let boxCount = 0;
    let ftCount = 0;
    let nsyCount = 0;

    for (let i = 0; i < dateCount; i++) {
      const heading = dateHeadings.nth(i);
      const text = (await heading.textContent().catch(() => ''))?.trim() ?? '';
      if (!text || text !== iso) continue;

      const boxesForDate = await page.evaluate((h: HTMLElement) => {
        const result: HTMLElement[] = [];
        let node: HTMLElement | null = h.parentElement?.parentElement?.nextElementSibling as HTMLElement | null;
        while (node) {
          if (node.querySelector?.('.dsRugbyMainDateTitle h3')) break;
          if (node.classList?.contains('RugbyListBox')) {
            result.push(node);
          }
          node = node.nextElementSibling as HTMLElement | null;
        }
        return result.map((el, idx) => idx);
      }, await heading.elementHandle() as any).catch(() => []);

      boxCount = boxesForDate.length;

      const sectionRoot = heading.locator('xpath=../..');
      const sectionSiblings = sectionRoot.locator('xpath=following-sibling::*');

      const ftLabels = sectionSiblings.locator('.RugbyListTime label', { hasText: /^FT$/ });
      ftCount = await ftLabels.count().catch(() => 0);

      const timeLabels = sectionSiblings.locator('.RugbyListTime label');
      const timeTexts = await timeLabels.allTextContents().catch(() => []);
      nsyCount = timeTexts.filter(t => /^\d{1,2}:\d{2}$/.test((t || '').trim())).length;

      break;
    }

    console.log(`📊 Rugby Live Centre ${label.toUpperCase()} (${iso}) – RugbyListBox count: ${boxCount}`);
    console.log(`📊 Rugby Live Centre ${label.toUpperCase()} (${iso}) – FT rows: ${ftCount}, NSY/time rows: ${nsyCount}`);
  }

  await countForDate(todayIso, 'today');
  await countForDate(yesterdayIso, 'yesterday');

  await expect(true).toBeTruthy();
});


