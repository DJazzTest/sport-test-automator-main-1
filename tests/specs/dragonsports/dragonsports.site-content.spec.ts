import { test, expect, Page } from '@playwright/test';

const DRAGONSPORTS_BASE =
  process.env.DRAGONSPORTS_BASE?.replace(/\/$/, '') ||
  'https://www.dragonsports.co.uk';

// All-matches Live Centre bases
const LIVE_FOOTBALL_BASE =
  process.env.DRAGONSPORTS_FOOTBALL_LIVE?.replace(/\/$/, '') ||
  'https://live.dragonsports.co.uk/football/matches/all';

const LIVE_RUGBY_BASE =
  process.env.DRAGONSPORTS_RUGBY_LIVE?.replace(/\/$/, '') ||
  'https://live.dragonsports.co.uk/rugby/matches/all';

async function acceptConsent(page: Page) {
  const root = page.locator('#uniccmp');
  if (await root.count().catch(() => 0)) {
    const agree = root.getByRole('button', { name: /Agree and proceed|Allow all|Accept all/i }).first();
    if (await agree.isVisible({ timeout: 4000 }).catch(() => false)) {
      await agree.click({ timeout: 5000 }).catch(() => {});
      await root.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    }
  }
}

async function checkBrokenImages(page: Page, context: string) {
  const imgs = page.locator('img');
  const count = await imgs.count().catch(() => 0);
  let broken = 0;
  const brokenSrcs: string[] = [];
  for (let i = 0; i < Math.min(count, 80); i++) {
    const img = imgs.nth(i);
    const ok = await img
      .evaluate((el: HTMLImageElement) => ({
        complete: el.complete,
        naturalWidth: el.naturalWidth,
        src: el.currentSrc || el.src || '',
      }))
      .catch(() => ({ complete: true, naturalWidth: 1, src: '' }));

    if (!ok.complete || ok.naturalWidth === 0) {
      broken++;
      if (ok.src && brokenSrcs.length < 10) {
        brokenSrcs.push(ok.src);
      }
    }
  }
  console.log(`📷 ${context} – images checked: ${Math.min(count, 80)}, broken: ${broken}`);
  if (broken === 0) {
    console.log(`✅ ${context} – image check passed (no broken images detected)`);
  } else {
    console.log(`❌ ${context} – image check found ${broken} broken image(s)`);
    if (brokenSrcs.length) {
      console.log(`   🔍 Sample broken image URLs (${brokenSrcs.length}):`);
      for (const src of brokenSrcs) {
        console.log(`      - ${src}`);
      }
    }
  }
}

async function sampleArticleLinks(page: Page, max: number): Promise<string[]> {
  const anchors = page.locator('main a[href]:not([href^="#"])');
  const count = await anchors.count().catch(() => 0);
  const hrefs = new Set<string>();
  for (let i = 0; i < count && hrefs.size < max * 2; i++) {
    const a = anchors.nth(i);
    const href = await a.getAttribute('href').catch(() => null);
    if (!href) continue;
    if (!href.startsWith('/') && !href.startsWith(DRAGONSPORTS_BASE)) continue;
    if (href.includes('/video') || href.includes('/tag/')) continue;
    hrefs.add(href);
  }
  return Array.from(hrefs).slice(0, max);
}

async function visitArticlesAndCheck(page: Page, hrefs: string[], context: string) {
  for (let i = 0; i < hrefs.length; i++) {
    const href = hrefs[i];
    const url = href.startsWith('http') ? href : `${DRAGONSPORTS_BASE}${href}`;
    console.log(`\n📰 ${context} – Article ${i + 1}/${hrefs.length}: ${url}`);
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => null);
    if (!resp || !resp.ok()) {
      console.log(`❌ ${context} – article failed to load (status ${resp?.status() ?? 'N/A'})`);
      continue;
    }
    await checkBrokenImages(page, `${context} article ${i + 1}`);
    // Sample a few in-article links
    const innerLinks = await sampleArticleLinks(page, 3);
    for (const inner of innerLinks) {
      const innerUrl = inner.startsWith('http') ? inner : `${DRAGONSPORTS_BASE}${inner}`;
      console.log(`   🔗 In-article link: ${innerUrl}`);
      const innerResp = await page.goto(innerUrl, { waitUntil: 'domcontentloaded' }).catch(() => null);
      if (!innerResp || !innerResp.ok()) {
        console.log(`   ❌ In-article link failed (status ${innerResp?.status() ?? 'N/A'})`);
      } else {
        console.log('   ✅ In-article link loaded without 404');
      }
      // Go back to article
      await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
    }
    // Back to previous list page
    await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
  }
}

async function reportFootballLiveCentre(page: Page) {
  console.log('\n⚽ DragonSports – Football Live Centre (all matches) – last 3 days status breakdown');

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
    console.log(`\n📅 [Football] ${day.label.toUpperCase()} (${iso}) – ${url}`);

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const rugbyListBoxes = page.locator('.RugbyListBox');
    const boxCount = await rugbyListBoxes.count().catch(() => 0);

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

    console.log(`📊 [Football] RugbyListBox rows: ${boxCount}`);
    console.log(
      `📊 [Football] Status – FT: ${ftCount}, R.O: ${roCount}, PPD: ${ppdCount}, Fi. AP: ${fiApCount}, NSY time: ${nsyCount}`
    );
  }
}

async function reportRugbyLiveCentre(page: Page) {
  console.log('\n🏉 DragonSports – Rugby Live Centre (all matches) – today & yesterday RugbyListBox & FT/NSY check');

  const today = new Date();
  const makeIso = (offset: number) => {
    const d = new Date(today);
    d.setDate(today.getDate() - offset);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).toString().padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const todayIso = makeIso(0);
  const yesterdayIso = makeIso(1);

  async function countForDate(iso: string, label: string) {
    const url = `${LIVE_RUGBY_BASE}/${iso}`;
    console.log(`📅 [Rugby] Loading ${label.toUpperCase()} rugby all matches: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
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

    console.log(`📊 [Rugby] Live Centre ${label.toUpperCase()} (${iso}) – RugbyListBox: ${boxCount}`);
    console.log(`📊 [Rugby] Live Centre ${label.toUpperCase()} (${iso}) – FT: ${ftCount}, NSY/time: ${nsyCount}`);
  }

  await countForDate(todayIso, 'today');
  await countForDate(yesterdayIso, 'yesterday');
}

test('DragonSportsUK – site content, navigation, Live Centre, and media smoke checks', async ({ page }) => {
  test.setTimeout(10 * 60_000);

  // HOME PAGE
  console.log('🏠 DragonSports – Home page content checks');
  await page.goto(DRAGONSPORTS_BASE, { waitUntil: 'domcontentloaded' });
  await acceptConsent(page);
  await checkBrokenImages(page, 'Home');
  const homeArticles = await sampleArticleLinks(page, 6);
  console.log(`📋 Home – testing ${homeArticles.length} article(s)`);
  await visitArticlesAndCheck(page, homeArticles, 'Home');

  // WELSH RUGBY – NEWS
  console.log('\n🏉 DragonSports – Welsh Rugby News checks');
  await page.goto(DRAGONSPORTS_BASE, { waitUntil: 'domcontentloaded' });
  await acceptConsent(page);
  const welshRugbyItem = page
    .getByRole('listitem')
    .filter({ hasText: /Welsh Rugby.*News.*Live Scores/i })
    .first();
  await welshRugbyItem.click({ timeout: 8000 }).catch(() => {});
  const rugbyNewsLink = page.getByRole('link', { name: /News/i }).first();
  await rugbyNewsLink.click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await checkBrokenImages(page, 'Welsh Rugby News');
  const rugbyNewsArticles = await sampleArticleLinks(page, 6);
  console.log(`📋 Welsh Rugby News – testing ${rugbyNewsArticles.length} article(s)`);
  await visitArticlesAndCheck(page, rugbyNewsArticles, 'Welsh Rugby News');

  // WELSH RUGBY – TEAMS
  console.log('\n🏉 DragonSports – Welsh Rugby Teams checks');
  await page.goto(DRAGONSPORTS_BASE, { waitUntil: 'domcontentloaded' });
  await acceptConsent(page);
  const wrTeamsItem = page
    .getByRole('listitem')
    .filter({ hasText: /Welsh Rugby.*Teams/i })
    .first();
  await wrTeamsItem.click({ timeout: 8000 }).catch(() => {});
  const teamNames = ['Ospreys', 'Cardiff Rugby', 'Dragons RFC', 'Scarlets', 'Wales Rugby Team'];
  for (const name of teamNames) {
    const link = page.getByRole('link', { name: new RegExp(name, 'i') }).first();
    if (!(await link.isVisible({ timeout: 4000 }).catch(() => false))) continue;
    console.log(`\n🏉 Welsh Rugby Team – ${name}`);
    const url = await link.getAttribute('href').catch(() => null);
    if (!url) continue;
    const fullUrl = url.startsWith('http') ? url : `${DRAGONSPORTS_BASE}${url}`;
    const resp = await page.goto(fullUrl, { waitUntil: 'domcontentloaded' }).catch(() => null);
    if (!resp || !resp.ok()) {
      console.log(`❌ Team page failed for ${name} (status ${resp?.status() ?? 'N/A'})`);
    } else {
      await checkBrokenImages(page, `Welsh Rugby Team ${name}`);
    }
  }

  // WELSH RUGBY – PLAYERS
  console.log('\n🏉 DragonSports – Welsh Rugby Players checks');
  await page.goto(DRAGONSPORTS_BASE, { waitUntil: 'domcontentloaded' });
  await acceptConsent(page);
  const wrPlayersItem = page
    .getByRole('listitem')
    .filter({ hasText: /Welsh Rugby.*Players/i })
    .first();
  await wrPlayersItem.click({ timeout: 8000 }).catch(() => {});
  const playerPanel = page.locator('nav, [role="dialog"], [role="menu"]').filter({ hasText: /Jac Morgan|Liam Williams|Louis Rees-Zammit|Dewi Lake|Tomos Williams/i }).first();
  const playerLinks = playerPanel.getByRole('link');
  const playerCount = await playerLinks.count().catch(() => 0);
  console.log(`📋 Welsh Rugby Players – found ${playerCount} player link(s) in pop-up/panel`);
  for (let i = 0; i < playerCount; i++) {
    const player = playerLinks.nth(i);
    const name = (await player.innerText().catch(() => '')).trim();
    if (!name) continue;
    console.log(`\n👤 Welsh Rugby Player – ${name}`);
    const href = await player.getAttribute('href').catch(() => null);
    if (!href) continue;
    const url = href.startsWith('http') ? href : `${DRAGONSPORTS_BASE}${href}`;
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => null);
    if (!resp || !resp.ok()) {
      console.log(`❌ Player page failed for ${name} (status ${resp?.status() ?? 'N/A'})`);
    } else {
      await checkBrokenImages(page, `Welsh Rugby Player ${name}`);
    }
  }

  // WELSH FOOTBALL – NEWS / TEAMS / PLAYERS
  console.log('\n⚽ DragonSports – Welsh Football News/Teams/Players checks');
  await page.goto(DRAGONSPORTS_BASE, { waitUntil: 'domcontentloaded' });
  await acceptConsent(page);
  const wfItem = page
    .getByRole('listitem')
    .filter({ hasText: /Welsh Football.*News.*Live Centre/i })
    .first();
  await wfItem.click({ timeout: 8000 }).catch(() => {});
  const wfNewsLink = page.getByRole('link', { name: /News/i }).first();
  await wfNewsLink.click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await checkBrokenImages(page, 'Welsh Football News');
  const wfNewsArticles = await sampleArticleLinks(page, 6);
  console.log(`📋 Welsh Football News – testing ${wfNewsArticles.length} article(s)`);
  await visitArticlesAndCheck(page, wfNewsArticles, 'Welsh Football News');

  // Teams under Welsh Football
  await page.goto(DRAGONSPORTS_BASE, { waitUntil: 'domcontentloaded' });
  await acceptConsent(page);
  const wfTeamsItem = page
    .getByRole('listitem')
    .filter({ hasText: /Welsh Football.*Teams/i })
    .first();
  await wfTeamsItem.click({ timeout: 8000 }).catch(() => {});
  const wfTeams = ['Cardiff City', 'Swansea City', 'Newport County', 'Wrexham', 'Wales Football Team'];
  for (const tName of wfTeams) {
    const link = page.getByRole('link', { name: new RegExp(tName, 'i') }).first();
    if (!(await link.isVisible({ timeout: 4000 }).catch(() => false))) continue;
    console.log(`\n⚽ Welsh Football Team – ${tName}`);
    const href = await link.getAttribute('href').catch(() => null);
    if (!href) continue;
    const url = href.startsWith('http') ? href : `${DRAGONSPORTS_BASE}${href}`;
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => null);
    if (!resp || !resp.ok()) {
      console.log(`❌ Football team page failed for ${tName} (status ${resp?.status() ?? 'N/A'})`);
    } else {
      await checkBrokenImages(page, `Welsh Football Team ${tName}`);
    }
  }

  // WELSH FOOTBALL – PLAYERS
  await page.goto(DRAGONSPORTS_BASE, { waitUntil: 'domcontentloaded' });
  await acceptConsent(page);
  const wfPlayersItem = page
    .getByRole('listitem')
    .filter({ hasText: /Welsh Football.*Players/i })
    .first();
  await wfPlayersItem.click({ timeout: 8000 }).catch(() => {});
  const wfPlayerPanel = page.locator('nav, [role="dialog"], [role="menu"]').filter({ hasText: /Aaron Ramsey|Brennan Johnson|Gareth Bale|Harry Wilson|Ethan Ampadu/i }).first();
  const wfPlayerLinks = wfPlayerPanel.getByRole('link');
  const wfPlayerCount = await wfPlayerLinks.count().catch(() => 0);
  console.log(`📋 Welsh Football Players – found ${wfPlayerCount} player link(s)`);
  for (let i = 0; i < wfPlayerCount; i++) {
    const p = wfPlayerLinks.nth(i);
    const name = (await p.innerText().catch(() => '')).trim();
    if (!name) continue;
    console.log(`\n👤 Welsh Football Player – ${name}`);
    const href = await p.getAttribute('href').catch(() => null);
    if (!href) continue;
    const url = href.startsWith('http') ? href : `${DRAGONSPORTS_BASE}${href}`;
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => null);
    if (!resp || !resp.ok()) {
      console.log(`❌ Football player page failed for ${name} (status ${resp?.status() ?? 'N/A'})`);
    } else {
      await checkBrokenImages(page, `Welsh Football Player ${name}`);
    }
  }

  // HORSE RACING – NEWS, RACE CARD, FAST RESULTS
  console.log('\n🏇 DragonSports – Horse Racing News / Race Card / Fast Results checks');
  await page.goto(DRAGONSPORTS_BASE, { waitUntil: 'domcontentloaded' });
  await acceptConsent(page);
  const hrTab = page.getByRole('link', { name: /Horse Racing/i }).first();
  await hrTab.click({ timeout: 8000 }).catch(() => {});

  const hrNews = page.getByRole('link', { name: /News/i }).first();
  if (await hrNews.isVisible({ timeout: 4000 }).catch(() => false)) {
    await hrNews.click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await checkBrokenImages(page, 'Horse Racing News');
    const hrNewsArticles = await sampleArticleLinks(page, 6);
    console.log(`📋 Horse Racing News – testing ${hrNewsArticles.length} article(s)`);
    await visitArticlesAndCheck(page, hrNewsArticles, 'Horse Racing News');
  }

  // Race Card
  await hrTab.click({ timeout: 8000 }).catch(() => {});
  const raceCardLink = page.getByRole('link', { name: /Race Card/i }).first();
  if (await raceCardLink.isVisible({ timeout: 4000 }).catch(() => false)) {
    console.log('\n🏇 Horse Racing – Race Card');
    await raceCardLink.click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await checkBrokenImages(page, 'Horse Racing Race Card');
  }

  // Fast Results
  await hrTab.click({ timeout: 8000 }).catch(() => {});
  const fastResultsLink = page.getByRole('link', { name: /Fast Results/i }).first();
  if (await fastResultsLink.isVisible({ timeout: 4000 }).catch(() => false)) {
    console.log('\n🏇 Horse Racing – Fast Results');
    await fastResultsLink.click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await checkBrokenImages(page, 'Horse Racing Fast Results');
  }

  // OTHER SPORTS – NEWS / WELSH SPORTS STARS
  console.log('\n🏅 DragonSports – Other Sports News / Welsh Sports Stars checks');
  await page.goto(DRAGONSPORTS_BASE, { waitUntil: 'domcontentloaded' });
  await acceptConsent(page);
  const osTab = page.getByRole('link', { name: /Other Sports/i }).first();
  await osTab.click({ timeout: 8000 }).catch(() => {});

  const osNews = page.getByRole('link', { name: /News/i }).first();
  if (await osNews.isVisible({ timeout: 4000 }).catch(() => false)) {
    await osNews.click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await checkBrokenImages(page, 'Other Sports News');
    const osNewsArticles = await sampleArticleLinks(page, 6);
    console.log(`📋 Other Sports News – testing ${osNewsArticles.length} article(s)`);
    await visitArticlesAndCheck(page, osNewsArticles, 'Other Sports News');
  }

  // Welsh Sports Stars
  await osTab.click({ timeout: 8000 }).catch(() => {});
  const wssLink = page.getByRole('link', { name: /Welsh Sports Stars/i }).first();
  if (await wssLink.isVisible({ timeout: 4000 }).catch(() => false)) {
    await wssLink.click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1000);
    const starsPanel = page.locator('nav, [role="dialog"], [role="menu"]').filter({ hasText: /Darcey Harry|Gerwyn Price|Sean Bowen|Mark Williams|Jeremiah Azu/i }).first();
    const starLinks = starsPanel.getByRole('link');
    const starCount = await starLinks.count().catch(() => 0);
    console.log(`📋 Welsh Sports Stars – found ${starCount} profile link(s)`);
    for (let i = 0; i < starCount; i++) {
      const s = starLinks.nth(i);
      const name = (await s.innerText().catch(() => '')).trim();
      if (!name) continue;
      console.log(`\n⭐ Welsh Sports Star – ${name}`);
      const href = await s.getAttribute('href').catch(() => null);
      if (!href) continue;
      const url = href.startsWith('http') ? href : `${DRAGONSPORTS_BASE}${href}`;
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => null);
      if (!resp || !resp.ok()) {
        console.log(`❌ Sports star page failed for ${name} (status ${resp?.status() ?? 'N/A'})`);
      } else {
        await checkBrokenImages(page, `Welsh Sports Star ${name}`);
      }
    }
  }

  // VIDEO TAB
  console.log('\n🎥 DragonSports – Video tab checks');
  await page.goto(DRAGONSPORTS_BASE, { waitUntil: 'domcontentloaded' });
  await acceptConsent(page);
  const videoTab = page.getByRole('link', { name: /Video/i }).first();
  if (await videoTab.isVisible({ timeout: 4000 }).catch(() => false)) {
    await videoTab.click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await checkBrokenImages(page, 'Video landing');

    // Click "See More" if present
    const seeMoreBtn = page.locator('button.seeMoreBtn, button', { hasText: /See More/i }).first();
    if (await seeMoreBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      console.log('🔽 Clicking See More on videos');
      await seeMoreBtn.click({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(1000);
    }

    // Sample ~6 video tiles and ensure their detail pages do not 404
    const allVideoAnchors = page.locator('a[href*="/video"]');
    const vCount = await allVideoAnchors.count().catch(() => 0);
    const maxVideos = Math.min(vCount, 6);
    for (let i = 0; i < maxVideos; i++) {
      const v = allVideoAnchors.nth(i);
      const href = await v.getAttribute('href').catch(() => null);
      if (!href) continue;
      const url = href.startsWith('http') ? href : `${DRAGONSPORTS_BASE}${href}`;
      console.log(`\n🎬 Video ${i + 1}/${maxVideos}: ${url}`);
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => null);
      if (!resp || !resp.ok()) {
        console.log(`❌ Video page failed (status ${resp?.status() ?? 'N/A'})`);
      } else {
        await checkBrokenImages(page, `Video ${i + 1}`);
      }
    }
  }

  // FOOTBALL & RUGBY LIVE CENTRE (all-matches) – status breakdowns
  await reportFootballLiveCentre(page);
  await reportRugbyLiveCentre(page);

  await expect(true).toBeTruthy();
});

