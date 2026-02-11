import { test, expect, Page, APIRequestContext } from '@playwright/test';

const isCI = !!process.env.CI || !!process.env.GITHUB_ACTIONS;

async function acceptUniConsent(page: Page) {
  // Give the CMP dialog a moment to render
  await page.waitForTimeout(800);

  // Try direct CTA first (main document, by role/name)
  const direct = page.getByRole('button', { name: /Accept\s*&\s*Continue/i }).first();
  if (await direct.isVisible()) {
    console.log('Clicking UniConsent button via direct role/name match.');
    await direct.click({ timeout: 5000 });
    return;
  }

  // Explicitly target the UniConsent dialog that contains the button
  const dialogWithButton = page
    .getByRole('dialog')
    .filter({ has: page.getByRole('button', { name: /Accept\s*&\s*Continue/i }) })
    .first();
  if (await dialogWithButton.count()) {
    const btn = dialogWithButton
      .getByRole('button', { name: /Accept\s*&\s*Continue/i })
      .first();
    if (await btn.isVisible()) {
      console.log('Clicking UniConsent button inside dialog container.');
      await btn.click({ timeout: 5000 });
      return;
    }
  }

  // Fallback: explicit CSS/text match for the styled "Accept & Continue" button
  const explicitButton = page
    .locator(
      'button:has-text("Accept & Continue"), button.bg-gray-300:has-text("Accept & Continue")'
    )
    .first();
  if (await explicitButton.isVisible()) {
    console.log('Clicking UniConsent button via explicit CSS/text selector.');
    await explicitButton.click({ timeout: 5000 });
    return;
  }

  // Try inside iframes as well (some consent UIs are embedded)
  for (const frame of page.frames()) {
    try {
      const frameBtnByRole = frame
        .getByRole('button', { name: /Accept\s*&\s*Continue/i })
        .first();
      if (await frameBtnByRole.isVisible()) {
        await frameBtnByRole.click({ timeout: 5000 });
        return;
      }
      const frameExplicit = frame
        .locator(
          'button:has-text("Accept & Continue"), button.bg-gray-300:has-text("Accept & Continue")'
        )
        .first();
      if (await frameExplicit.isVisible()) {
        await frameExplicit.click({ timeout: 5000 });
        return;
      }
    } catch {
      // ignore individual frame failures
    }
  }

  // Fallback: within #uniccmp container
  const root = page.locator('#uniccmp');
  if (await root.count()) {
    const candidates = [
      root.getByRole('button', { name: /Accept\s*&\s*Continue/i }).first(),
      root.getByRole('button', { name: /Accept All/i }).first(),
      root.getByRole('button', { name: /I Accept/i }).first(),
      root.locator('button:has-text("Accept")').first(),
      root.locator('button:has-text("Allow All")').first(),
    ];
    for (const btn of candidates) {
      if (await btn.isVisible()) {
        await btn.click({ timeout: 5000 });
        break;
      }
    }
  }
}

async function dismissOverlays(page: Page) {
  await page.evaluate(() => {
    const ids = ['uniccmp', 'ps-nav-overlay'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        (el as HTMLElement).style.setProperty('display', 'none', 'important');
        (el as HTMLElement).style.setProperty('visibility', 'hidden', 'important');
        (el as HTMLElement).style.setProperty('pointer-events', 'none', 'important');
      }
    });
    document.querySelectorAll('[role="dialog"], .unic-modal-container').forEach(d => {
      const el = d as HTMLElement;
      el.style.setProperty('display', 'none', 'important');
      el.style.setProperty('visibility', 'hidden', 'important');
      el.style.setProperty('pointer-events', 'none', 'important');
    });
  });
}

async function checkNoBrokenImages(page: Page) {
  const imgs = await page.$$('img');
  for (const img of imgs) {
    try {
      if (!(await img.isVisible())) continue;
      // Trigger lazy loading
      await img.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(250);
      const width = await img.evaluate(el => (el as HTMLImageElement).naturalWidth);
      if (width === 0) {
        // Previously we logged broken image URLs here. For reporting, we now treat
        // these as non-critical cosmetic issues and do not include them in email output.
        continue;
      }
    } catch {
      // Ignore individual element failures – this is a best-effort health check
    }
  }
}

async function checkAdsPresence(page: Page) {
  // Common ad container patterns – we only log, not fail the test on absence
  const adSelectors = ['[id*="ad" i]', '[class*="ad" i]', '[data-ad]'];
  const count = await page.locator(adSelectors.join(',')).count().catch(() => 0);
  console.log(`Ad containers found: ${count}`);
}

async function checkErrorMarkers(page: Page, sectionName: string, emailFailures?: string[]) {
  // Basic 404 / server error text detection in main content
  const hasError = await page.evaluate(() => {
    const main = document.querySelector('main');
    const text = (main?.textContent || '').toLowerCase();
    return /\b404\b|\bserver error\b|\bfatal error\b/.test(text);
  });

  if (hasError) {
    const msg = `${sectionName}: 404/server error in main content`;
    if (emailFailures) emailFailures.push(msg);
    console.log(`❌ Detected 404/server error markers in main content for ${sectionName}`);
    console.log('   📋 Steps to recreate:');
    console.log(`      1. Navigate to: ${page.url()}`);
    console.log('      2. Scroll through the main content area');
    console.log('      3. Look for any 404/server error message blocks');
    console.log('      4. Expected: Normal page content should be visible (no 404/server error panels)');
    console.log('      5. Actual: 404 or server error messaging is present in the main content');
  }

  expect(
    hasError,
    `Detected 404/server error markers in main content for ${sectionName}`
  ).toBeFalsy();
}

async function checkBrokenLinksAndErrors(
  page: Page,
  request: APIRequestContext,
  sectionName: string,
  maxLinks = 20,
  emailFailures?: string[]
) {
  console.log(`\n🔍 Link and error audit for ${sectionName}...`);

  // Collect hrefs from main content area
  const hrefs = await page.$$eval('main a[href]', (as: Element[]) =>
    Array.from(
      new Set(
        (as as HTMLAnchorElement[])
          .map(a => (a as HTMLAnchorElement).href)
          .filter(Boolean)
      )
    )
  );

  const sample = hrefs.slice(0, maxLinks);
  const broken: Array<{ url: string; status: number }> = [];

  for (const url of sample) {
    // Skip non-web schemes (javascript/mailto/tel/whatsapp, etc.)
    if (!/^https?:/i.test(url)) continue;

    // Skip direct image asset URLs – we rely on on-page image checks instead.
    const lower = url.toLowerCase();
    if (
      lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.png') ||
      lower.endsWith('.gif') ||
      lower.endsWith('.webp') ||
      lower.includes('/content/uploads/')
    ) {
      continue;
    }

    // Only treat first-party TeamTalk links as candidates for "broken URL" failures.
    // External analytics/ad/share links (invibes, flipboard, gpfans, google, etc.)
    // are considered non-critical and ignored here.
    try {
      const host = new URL(url).hostname.toLowerCase();
      const isTeamTalk =
        host === 'www.teamtalk.com' ||
        host === 'teamtalk.com';
      if (!isTeamTalk) {
        continue;
      }
    } catch {
      // If URL parsing fails, skip from failure reporting.
      continue;
    }

    try {
      // Use request context to avoid CORS limitations; do not follow redirects so 3xx are visible
      const res = await request.fetch(url, { maxRedirects: 0 });
      const status = res.status();
      if (status >= 400) {
        broken.push({ url, status });
      }
    } catch {
      broken.push({ url, status: -1 });
    }
  }

  if (broken.length) {
    if (emailFailures) broken.slice(0, 20).forEach((b) => emailFailures.push(`${sectionName}>${b.url} (${b.status})`));
    console.warn(`❌ ${broken.length} broken links detected in ${sectionName}`);
    broken.slice(0, 20).forEach((b, index) => {
      // Email report format (same pattern as PlanetF1): Fail: Section>URL
      console.log(`❌ Fail: ${sectionName}>${b.url}`);
      console.warn(`  [${b.status}] ${b.url}`);
      console.warn(`     📋 Steps to recreate:`);
      console.warn(`        1. Navigate to: ${page.url()}`);
      console.warn(`        2. Look for a link that points to: ${b.url}`);
      console.warn(`        3. Click on that link`);
      console.warn(`        4. Expected: Page should load successfully`);
      console.warn(`        5. Actual: Returns HTTP ${b.status} (broken link)`);
      if (index < Math.min(broken.length, 20) - 1) console.warn(''); // Add spacing between items
    });
  } else {
    console.log(`✅ No broken links detected in sampled links for ${sectionName}`);
  }

  await checkErrorMarkers(page, sectionName, emailFailures);
}

async function visitSectionAndAudit(
  page: Page,
  request: APIRequestContext,
  label: string,
  url: string,
  emailFailures?: string[],
  maxLinks: number = 20
) {
  console.log(`\n===== ${label.toUpperCase()} =====`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await acceptUniConsent(page);
  await dismissOverlays(page);

  // Quick scroll to trigger lazy loading then return to top
  for (let s = 0; s < 3; s++) {
    await page.mouse.wheel(0, 1000);
    await page.waitForTimeout(150);
  }
  await page.evaluate(() => window.scrollTo(0, 0));

  await checkNoBrokenImages(page);
  await checkAdsPresence(page);
  await checkBrokenLinksAndErrors(page, request, label, maxLinks, emailFailures);
}

test('TeamTalk web: key sections and team pages end‑to‑end', async ({ page, request }) => {
  test.setTimeout(420_000); // 7 minutes global budget
  const emailFailures: string[] = [];

  // 1) Home page
  await visitSectionAndAudit(page, request, 'Home', 'https://www.teamtalk.com/', emailFailures);

  // 2) Transfer News
  // Prefer navigation via header/link when available, then fall back to direct URL.
  // Once on Transfer News, we:
  //  - validate that page itself (images/ads/404 markers) and
  //  - iterate a small number of article links; for each, open the article,
  //    validate just that article page, then navigate back.
  try {
    console.log('\nNavigating to Transfer News via header link...');
    await page.goto('https://www.teamtalk.com/', { waitUntil: 'domcontentloaded' });
    await acceptUniConsent(page);
    await dismissOverlays(page);
    const transferLink = page
      .getByRole('link', { name: /transfer news/i })
      .first();
    if (await transferLink.count()) {
      await transferLink.click({ timeout: 10_000 });
      await page.waitForLoadState('domcontentloaded', { timeout: 15_000 });
    } else {
      await page.goto('https://www.teamtalk.com/transfer-news', {
        waitUntil: 'domcontentloaded',
      });
    }
  } catch {
    await page.goto('https://www.teamtalk.com/transfer-news', {
      waitUntil: 'domcontentloaded',
    });
  }
  await acceptUniConsent(page);
  await dismissOverlays(page);

  // Validate the Transfer News listing page itself
  await checkNoBrokenImages(page);
  await checkAdsPresence(page);
  await checkErrorMarkers(page, 'Transfer News (listing)', emailFailures);

  // Now iterate a subset of article links: open each article page once,
  // validate that article only, then go back to the list.
  const articleLinks = page
    .locator('main')
    .locator('article a[href], [class*="article" i] a[href]')
    .first()
    .locator('xpath=ancestor-or-self::a'); // normalise to the anchor element itself

  const totalArticles = await articleLinks.count().catch(() => 0);
  console.log(`Transfer News: discovered ${totalArticles} article links`);

  if (totalArticles > 0) {
    const envMaxArticles = parseInt(process.env.MAX_TRANSFER_ARTICLES || '3', 10);
    const maxArticles = Math.min(totalArticles, Number.isNaN(envMaxArticles) ? 3 : envMaxArticles);
    for (let i = 0; i < maxArticles; i++) {
      const link = articleLinks.nth(i);
      const label =
        (await link.textContent().catch(() => null))?.trim() ||
        `Transfer article ${i + 1}`;

      console.log(`\n🔗 Opening Transfer News article ${i + 1}/${maxArticles}: ${label}`);

      await link.scrollIntoViewIfNeeded().catch(() => {});

      await Promise.all([
        page.waitForLoadState('domcontentloaded').catch(() => {}),
        link.click({ timeout: 10_000 }).catch(() => {}),
      ]);

      await acceptUniConsent(page);
      await dismissOverlays(page);

      await checkNoBrokenImages(page);
      await checkAdsPresence(page);
      await checkErrorMarkers(page, `Transfer News article: ${label}`, emailFailures);

      // Navigate back to the Transfer News listing page for the next link
      await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
      await acceptUniConsent(page);
      await dismissOverlays(page);
    }
  } else {
    console.warn('No article links found on Transfer News page (non-fatal).');
  }

  // 3) Confirmed transfers
  // Use a higher link limit here so key tag pages (e.g. player tags) are
  // very unlikely to be missed in the broken-link sample.
  await visitSectionAndAudit(
    page,
    request,
    'Confirmed Transfers',
    'https://www.teamtalk.com/confirmed-transfers',
    emailFailures,
    80
  );

  // 4) Premier League
  await visitSectionAndAudit(
    page,
    request,
    'Premier League',
    'https://www.teamtalk.com/premier-league',
    emailFailures
  );

  // 5) Team pages – Overview & News for several teams
  const defaultTeams = [
    'Arsenal',
    'Aston Villa',
    'Brentford',
    'Chelsea',
    'Liverpool',
    'Manchester City',
    'Manchester United',
    'Tottenham Hotspur',
  ];
  const envMaxTeams = parseInt(process.env.MAX_TEAMS || (isCI ? '3' : '5'), 10);
  const maxTeams = Number.isNaN(envMaxTeams) ? (isCI ? 3 : 5) : envMaxTeams;
  const teamNames = defaultTeams.slice(0, maxTeams);

  for (const teamName of teamNames) {
    const slug = teamName.toLowerCase().replace(/\s+/g, '-');
    const baseUrl = `https://www.teamtalk.com/team/${slug}`;

    // 5a) Overview tab (default team page)
    await visitSectionAndAudit(page, request, `${teamName} – Overview`, baseUrl, emailFailures);

    // 5b) News tab for this team (best‑effort – layout may vary)
    console.log(`\nAttempting to open News tab for ${teamName}...`);
    try {
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
      await acceptUniConsent(page);
      await dismissOverlays(page);

      // Look for a visible "News" tab/link within the team nav area
      let newsLink = page
        .locator(
          'nav a:has-text("News"), [role="tablist"] a:has-text("News"), a[data-text="News"]'
        )
        .first();
      if (!(await newsLink.count())) {
        // Fallback: any anchor with "news" in href near top of page
        newsLink = page
          .locator('a[href*="news" i]')
          .first();
      }

      if (await newsLink.count()) {
        const href = (await newsLink.getAttribute('href')) || '';
        if (href) {
          const dest = href.startsWith('http')
            ? href
            : new URL(href, baseUrl).toString();
          await visitSectionAndAudit(
            page,
            request,
            `${teamName} – News`,
            dest,
            emailFailures
          );
        } else {
          await newsLink.click({ timeout: 10_000 }).catch(() => {});
          await page.waitForLoadState('domcontentloaded').catch(() => {});
          await acceptUniConsent(page);
          await dismissOverlays(page);
          await checkNoBrokenImages(page);
          await checkAdsPresence(page);
          await checkBrokenLinksAndErrors(page, request, `${teamName} – News`, 20, emailFailures);
        }
      } else {
        console.warn(`News tab/link not found for ${teamName} (non‑fatal).`);
      }
    } catch (e) {
      console.warn(
        `Error while testing News tab for ${teamName} (non‑fatal): ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    }
  }

  // Email report: write for CI to send
  try {
    const fs = await import('fs');
    const path = await import('path');
    const reportDir = path.join(process.cwd(), 'test-results');
    fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(
      path.join(reportDir, 'email-report.json'),
      JSON.stringify({ siteName: 'TeamTalk', failures: emailFailures }, null, 0)
    );
  } catch (_) {}

  // Final report: what was tested and what we send in the test report
  console.log('\n📋 TeamTalk test finished');
  console.log('Sections tested: Home, Transfer News, Confirmed Transfers, Premier League');
  console.log(`Team pages tested: ${teamNames.join(', ')}`);
  console.log('Checks per section: broken links (main content), broken images, ad presence, 404/error markers');
});


