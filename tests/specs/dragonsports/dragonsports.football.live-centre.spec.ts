import { test, expect } from '@playwright/test';

// Direct Live Centre base for football all-matches view
const LIVE_FOOTBALL_BASE =
  process.env.DRAGONSPORTS_FOOTBALL_LIVE?.replace(/\/$/, '') ||
  'https://live.dragonsports.co.uk/football/matches/all';

test('DragonSports – Football Live Centre all-matches status breakdown for last 3 days', async ({ page }) => {
  test.setTimeout(90_000);

  console.log('🧪 DragonSports – Football Live Centre (all matches) – last 3 days status breakdown');

  const today = new Date();

  const makeIso = (offset: number) => {
    const d = new Date(today);
    d.setDate(today.getDate() - offset);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const days = [
    { label: 'today', offset: 0 },
    { label: 'yesterday', offset: 1 },
    { label: 'two days ago', offset: 2 },
  ];

  for (const day of days) {
    const iso = makeIso(day.offset);
    const url = `${LIVE_FOOTBALL_BASE}/${iso}`;
    console.log(`\n📅 Checking ${day.label.toUpperCase()} (${iso}) at ${url}`);

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Count all RugbyListBox-style rows
    const rugbyListBoxes = page.locator('.RugbyListBox');
    const boxCount = await rugbyListBoxes.count().catch(() => 0);

    // Status labels
    const ftLabels = page.locator('label.status', { hasText: /^FT$/ });
    const roLabels = page.locator('label.status', { hasText: /^R\.?O\.?$/i });
    const ppdLabels = page.locator('label.status', { hasText: /^PPD$/i });
    const fiApLabels = page.locator('label.status', { hasText: /^Fi\.?\s*AP$/i });
    const nsyTime = page.locator('label[data-testid="nsy_time"]');

    const ftCount = await ftLabels.count().catch(() => 0);
    const roCount = await roLabels.count().catch(() => 0);
    const ppdCount = await ppdLabels.count().catch(() => 0);
    const fiApCount = await fiApLabels.count().catch(() => 0);
    const nsyCount = await nsyTime.count().catch(() => 0);

    console.log(`📊 RugbyListBox rows: ${boxCount}`);
    console.log(`📊 Status breakdown – FT: ${ftCount}, R.O: ${roCount}, PPD: ${ppdCount}, Fi. AP: ${fiApCount}, NSY time: ${nsyCount}`);

    // Sanity check: we should at least see some rows for yesterday based on known data.
    if (day.offset === 1) {
      await expect(boxCount).toBeGreaterThan(0);
    }
  }
});


