import { test, expect, Page, APIRequestContext } from '@playwright/test';

const isCI = !!process.env.CI || !!process.env.GITHUB_ACTIONS;

function isTeamTalkHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'www.teamtalk.com' || host === 'teamtalk.com';
  } catch {
    return false;
  }
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) u.pathname = u.pathname.slice(0, -1);
    return u.toString();
  } catch {
    return url;
  }
}

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

async function checkNoBrokenImages(page: Page, sectionName: string, emailFailures?: string[]) {
  const imgs = await page.$$('img');
  for (const img of imgs) {
    try {
      if (!(await img.isVisible())) continue;
      // Trigger lazy loading
      await img.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(250);
      const width = await img.evaluate(el => (el as HTMLImageElement).naturalWidth);
      if (width === 0) {
        const src = await img.getAttribute('src').catch(() => '');
        if (!src) continue;
        const absolute = src.startsWith('http') ? src : new URL(src, page.url()).toString();
        // Ignore known tracker/pixel assets.
        if (absolute.includes('doubleclick') || absolute.includes('googletagmanager') || absolute.includes('google-analytics')) continue;
        const msg = `Broken image: ${sectionName}|${absolute}`;
        if (emailFailures) emailFailures.push(msg);
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
  const firstParty = hrefs
    .map(normalizeUrl)
    .filter((url, idx, arr) => arr.indexOf(url) === idx)
    .filter(isTeamTalkHost);
  const sample = firstParty.length > maxLinks
    ? firstParty.sort(() => Math.random() - 0.5).slice(0, maxLinks)
    : firstParty;
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
      let res = await request.fetch(url, { method: 'HEAD', timeout: 5000 }).catch(() => null);
      if (!res || res.status() === 405 || res.status() === 501) {
        res = await request.fetch(url, { method: 'GET', timeout: 7000 }).catch(() => null);
      }
      const status = res?.status() ?? -1;
      if (status >= 400 || status < 0) broken.push({ url, status });
    } catch {
      broken.push({ url, status: -1 });
    }
  }

  if (broken.length) {
    if (emailFailures) {
      broken.slice(0, 20).forEach(b => {
        if (b.status >= 400) {
          emailFailures.push(`Broken URL: ${sectionName}>${b.url} (${b.status})`);
        } else {
          emailFailures.push(`Unreachable in test: ${sectionName}>${b.url}`);
        }
      });
    }
    console.warn(`❌ ${broken.length} problematic links detected in ${sectionName}`);
    broken.slice(0, 20).forEach((b, index) => {
      const label =
        b.status >= 400
          ? 'Broken URL'
          : 'Unreachable in test (network/timeout)';
      console.log(`❌ ${label}: ${sectionName}>${b.url}`);
      console.warn(`  [${b.status}] ${b.url}`);
      console.warn(`     📋 Steps to recreate:`);
      console.warn(`        1. Navigate to: ${page.url()}`);
      console.warn(`        2. Look for a link that points to: ${b.url}`);
      console.warn(`        3. Click on that link`);
      console.warn(`        4. Expected: Page should load successfully`);
      console.warn(
        `        5. Actual: ${
          b.status >= 400
            ? `Returns HTTP ${b.status} (broken link)`
            : 'Request failed in automated check (timeout / network error)'
        }`,
      );
      if (index < Math.min(broken.length, 20) - 1) console.warn(''); // Add spacing between items
    });
  } else {
    console.log(`✅ No broken links detected in sampled links for ${sectionName}`);
  }

  await checkErrorMarkers(page, sectionName, emailFailures);
  await checkStaleArticlesOnPage(page, sectionName, emailFailures);
}

async function checkStaleArticlesOnPage(
  page: Page,
  sectionName: string,
  emailFailures?: string[],
) {
  const thresholdDays = 365; // consider articles older than 12 months as stale
  const now = Date.now();
  const maxAgeMs = thresholdDays * 24 * 60 * 60 * 1000;

  const rawDates: string[] = await page.evaluate(() => {
    const main = document.querySelector('main');
    const text = (main?.textContent || '').replace(/\s+/g, ' ') || '';
    const pattern =
      /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\b/gi;
    const dates: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      dates.push(match[0]);
    }
    return Array.from(new Set(dates));
  });

  if (!rawDates.length) return;

  const staleSamples: string[] = [];

  for (const d of rawDates) {
    const parsed = Date.parse(d);
    if (!Number.isNaN(parsed)) {
      const age = now - parsed;
      if (age > maxAgeMs) {
        staleSamples.push(d);
      }
    }
  }

  if (!staleSamples.length) return;

  const sample = Array.from(new Set(staleSamples)).slice(0, 3);
  const msg = `${sectionName}: stale articles detected (e.g. ${sample.join(', ')})`;
  console.warn(`⚠️ ${msg}`);
  if (emailFailures) {
    emailFailures.push(msg);
  }
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

  await checkNoBrokenImages(page, label, emailFailures);
  await checkAdsPresence(page);
  await checkBrokenLinksAndErrors(page, request, label, maxLinks, emailFailures);
  await drillIntoRandomTagsAndLinks(page, request, label, emailFailures);
}

async function drillIntoRandomTagsAndLinks(
  page: Page,
  request: APIRequestContext,
  sectionName: string,
  emailFailures?: string[]
) {
  const baseUrl = page.url();

  const tagLinks = await page.$$eval('main a[href*="/tag/"]', (as: Element[]) =>
    Array.from(new Set((as as HTMLAnchorElement[]).map(a => a.href).filter(Boolean)))
  ).catch(() => []);
  const generalLinks = await page.$$eval('main a[href]', (as: Element[]) =>
    Array.from(new Set((as as HTMLAnchorElement[]).map(a => a.href).filter(Boolean)))
  ).catch(() => []);

  const sample = (arr: string[], max: number) =>
    arr
      .map(normalizeUrl)
      .filter((url, idx, list) => list.indexOf(url) === idx)
      .filter(isTeamTalkHost)
      .sort(() => Math.random() - 0.5)
      .slice(0, max);

  const tagSample = sample(tagLinks, 2);
  const linkSample = sample(generalLinks.filter((u) => !u.includes('/tag/')), 2);
  const targets = Array.from(new Set([...tagSample, ...linkSample]));

  for (const target of targets) {
    try {
      await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await acceptUniConsent(page);
      await dismissOverlays(page);
      await checkNoBrokenImages(page, `${sectionName} (drill)`, emailFailures);
      await checkErrorMarkers(page, `${sectionName} drill>${target}`, emailFailures);
      await checkBrokenLinksAndErrors(page, request, `${sectionName} drill>${target}`, 8, emailFailures);
    } catch (e) {
      if (emailFailures) emailFailures.push(`Unreachable in test: ${sectionName} drill>${target}`);
    } finally {
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
      await acceptUniConsent(page);
      await dismissOverlays(page);
    }
  }
}

test('TeamTalk Tests: key sections end‑to‑end', async ({ page, request }) => {
  test.setTimeout(12 * 60_000);
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
  await checkNoBrokenImages(page, 'Transfer News (listing)', emailFailures);
  await checkAdsPresence(page);
  await checkErrorMarkers(page, 'Transfer News (listing)', emailFailures);
  await checkBrokenLinksAndErrors(page, request, 'Transfer News (listing)', 25, emailFailures);
  await drillIntoRandomTagsAndLinks(page, request, 'Transfer News (listing)', emailFailures);

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

      await checkNoBrokenImages(page, `Transfer News article: ${label}`, emailFailures);
      await checkAdsPresence(page);
      await checkErrorMarkers(page, `Transfer News article: ${label}`, emailFailures);
      await checkBrokenLinksAndErrors(page, request, `Transfer News article: ${label}`, 15, emailFailures);

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
  await visitSectionAndAudit(
    page,
    request,
    'Exclusives',
    'https://www.teamtalk.com/exclusives',
    emailFailures
  );

  // Email report: write for CI to send (merge-safe across TeamTalk specs)
  try {
    const fs = await import('fs');
    const path = await import('path');
    const reportDir = path.join(process.cwd(), 'test-results');
    const reportPath = path.join(reportDir, 'email-report.json');
    fs.mkdirSync(reportDir, { recursive: true });
    let mergedFailures: string[] = [];
    if (fs.existsSync(reportPath)) {
      try {
        const previous = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        if (previous?.siteName === 'TeamTalk' && Array.isArray(previous?.failures)) {
          mergedFailures = previous.failures;
        }
      } catch {}
    }
    const deduped = Array.from(new Set([...mergedFailures, ...emailFailures]));
    fs.writeFileSync(reportPath, JSON.stringify({ siteName: 'TeamTalk', failures: deduped }, null, 0));
  } catch (_) {}

  // Final report: what was tested and what we send in the test report
  console.log('\n📋 TeamTalk test finished');
  console.log('Sections tested: Home, Transfer News, Confirmed Transfers, Premier League, Exclusives');
  console.log('Checks per section: broken links (main content), broken images, ad presence, 404/error markers');
});


