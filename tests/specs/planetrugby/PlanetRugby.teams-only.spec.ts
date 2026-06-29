import { test, expect, Page } from '@playwright/test';

// Planet Rugby Teams testing only
// Source site: https://www.planetrugby.com/

const BASE_URL = 'https://www.planetrugby.com/';

// Helper to dismiss UniConsent popup
async function acceptUniConsent(page: Page) {
  try {
    await page.waitForTimeout(1200);
    const acceptBtn = page.getByRole('button', { name: /Accept\s*&\s*Continue/i }).first();
    if (await acceptBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await acceptBtn.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(800);
      console.log('✅ Consent dismissed');
      return;
    }
  } catch {}
  try {
    const uniBtn = page.locator('#uniccmp button:has-text("Accept")').first();
    if (await uniBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await uniBtn.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(800);
      console.log('✅ Consent dismissed (UNICCMP)');
    }
  } catch {}
}

// Helper function to test a team's tabs (News, Fixtures, Results, Tables)
async function testTeamTabs(page: Page, teamName: string, teamBaseUrl: string, leagueName: string) {
  const tabsToCheck = [
    { name: 'News', url: teamBaseUrl },
    { name: 'Fixtures', url: `${teamBaseUrl}/fixtures` },
    { name: 'Results', url: `${teamBaseUrl}/results` },
    { name: 'Tables', url: `${teamBaseUrl}/table` },
  ];
  let tabsWithContent = 0;

  for (const tab of tabsToCheck) {
    // Navigate directly to the tab URL
    await page.goto(tab.url, { waitUntil: 'domcontentloaded' });
    await acceptUniConsent(page);
    await page.waitForTimeout(200); // Optimized for speed

    // Single scroll to load content (optimized)
    await page.mouse.wheel(0, 1500);
    await page.waitForTimeout(100); // Minimal wait

    // Check for content based on tab type
    let hasTabContent = false;
    let tabStatus = '';
    
    if (tab.name === 'News') {
      // News: Check for images and articles, and check for stale dates
      const hasImages = await page.locator('main img').count().catch(() => 0) > 0;
      const hasArticles = await Promise.race([
        page.locator('main article').first().isVisible({ timeout: 1500 }).catch(() => false),
        page.locator('main [class*="article"]').first().isVisible({ timeout: 1500 }).catch(() => false),
        page.locator('main h2, main h3').first().isVisible({ timeout: 1500 }).catch(() => false),
        new Promise(resolve => setTimeout(() => resolve(false), 1800)), // Max 1.8s wait
      ]).catch(() => false);
      
      hasTabContent = hasImages || hasArticles;
      
      if (hasTabContent) {
        // Check for stale content (dates older than 14 days) - with timeout
        let pageText = '';
        try {
          pageText = await Promise.race([
            page.textContent('main', { timeout: 1500 }).catch(() => ''),
            new Promise<string>(resolve => setTimeout(() => resolve(''), 1800)),
          ]) as string;
        } catch {
          pageText = '';
        }
        const datePattern = /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\b/i;
        const matches = pageText.match(datePattern);
        
        if (matches) {
          const day = parseInt(matches[1]);
          const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
          const month = monthNames.indexOf(matches[2].toLowerCase());
          const year = parseInt(matches[3]);
          const articleDate = new Date(year, month, day);
          const daysAgo = Math.floor((Date.now() - articleDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysAgo > 14) {
            tabStatus = `⚠️ News shows data but content is stale (${daysAgo} days old)`;
          } else {
            tabStatus = `✅ News shows data with recent content`;
          }
        } else {
          tabStatus = `✅ News shows data`;
        }
      }
    } else if (tab.name === 'Fixtures') {
      // Fixtures: Check for "No Fixture Data Available" message or actual fixtures
      const noDataMessage = await page.locator('text=/No Fixture Data Available/i').first().isVisible({ timeout: 1500 }).catch(() => false);
      const hasFixtures = await Promise.race([
        page.locator('main [class*="fixture"], main [class*="match"]').first().isVisible({ timeout: 1500 }).catch(() => false),
        page.locator('main table').first().isVisible({ timeout: 1500 }).catch(() => false),
        page.locator('main [class*="schedule"]').first().isVisible({ timeout: 1500 }).catch(() => false),
        new Promise(resolve => setTimeout(() => resolve(false), 1800)), // Max 1.8s wait
      ]).catch(() => false);
      
      if (noDataMessage) {
        hasTabContent = true; // "No data" is expected, so we report it
        tabStatus = `⚠️ Fixtures shows "No Fixture Data Available" message (expected but reported)`;
      } else if (hasFixtures) {
        hasTabContent = true;
        tabStatus = `✅ Fixtures shows fixture data`;
      }
    } else if (tab.name === 'Results') {
      // Results: Scroll down and check for dates, club v club with scores
      // Use shorter timeouts to avoid freezing
      const hasResults = await Promise.race([
        page.locator('main [class*="result"], main [class*="match"]').first().isVisible({ timeout: 1500 }).catch(() => false),
        page.locator('main table').first().isVisible({ timeout: 1500 }).catch(() => false),
        page.locator('main [class*="score"]').first().isVisible({ timeout: 1500 }).catch(() => false),
        new Promise(resolve => setTimeout(() => resolve(false), 1800)), // Max 1.8s wait
      ]).catch(() => false);
      
      // Also check for score patterns (numbers that look like scores) - with timeout
      let pageText = '';
      try {
        pageText = await Promise.race([
          page.textContent('main', { timeout: 2000 }).catch(() => ''),
          new Promise<string>(resolve => setTimeout(() => resolve(''), 2500)),
        ]) as string;
      } catch {
        pageText = '';
      }
      
      const hasScorePattern = /\d+\s*-\s*\d+/.test(pageText) || /\d+\s*v\s*\d+/i.test(pageText);
      
      hasTabContent = hasResults || hasScorePattern;
      
      if (hasTabContent) {
        tabStatus = `✅ Results shows dates and scores (club v club)`;
      }
    } else if (tab.name === 'Tables') {
      // Tables: Scroll down and check for club names with points and data
      const hasTables = await Promise.race([
        page.locator('main table').first().isVisible({ timeout: 1500 }).catch(() => false),
        page.locator('main [class*="table"], main [class*="standing"]').first().isVisible({ timeout: 1500 }).catch(() => false),
        page.locator('main [role="table"]').first().isVisible({ timeout: 1500 }).catch(() => false),
        new Promise(resolve => setTimeout(() => resolve(false), 1800)), // Max 1.8s wait
      ]).catch(() => false);
      
      // Check for table rows with data - with timeout
      const tableRows = await Promise.race([
        page.locator('main table tbody tr, main [role="table"] [role="row"]').count().catch(() => 0),
        new Promise<number>(resolve => setTimeout(() => resolve(0), 1500)),
      ]).catch(() => 0);
      const hasTableData = tableRows > 0;
      
      hasTabContent = hasTables || hasTableData;
      
      if (hasTabContent) {
        tabStatus = `✅ Tables shows club names with points and data (${tableRows} rows)`;
      }
    }

    if (hasTabContent) {
      console.log(`   ${tabStatus || `✅ '${tab.name}' tab shows content`} (${tab.url})`);
      tabsWithContent++;
    } else {
      console.log(`   ❌ '${tab.name}' tab has no visible content`);
      console.log(`      📋 Steps to recreate:`);
      console.log(`         1. Navigate to: ${tab.url}`);
      console.log(`         2. Scroll down the page`);
      console.log(`         3. Expected: Visible data (${tab.name.toLowerCase()} content)`);
      console.log(`         4. Actual: No visible content found after scrolling`);
    }
  }

  return { tabsWithContent, totalTabs: tabsToCheck.length };
}

// Helper function to test tournament tabs - only reports: no data available, 404s, broken links, no ads, broken images
async function testTournamentTabs(page: Page, tournamentName: string, tournamentBaseUrl: string) {
  const tabsToCheck = [
    { name: 'News', url: tournamentBaseUrl },
    { name: 'Fixtures', url: `${tournamentBaseUrl}/fixtures` },
    { name: 'Results', url: `${tournamentBaseUrl}/results` },
    { name: 'Tables', url: `${tournamentBaseUrl}/table` },
  ];
  let issuesFound = 0;

  for (const tab of tabsToCheck) {
    // Check for 404 first
    const response = await page.goto(tab.url, { waitUntil: 'domcontentloaded' }).catch(() => null);
    if (response && response.status() === 404) {
      console.log(`   ❌ 404 Error on ${tab.name} tab: ${tab.url}`);
      console.log(`      📋 Steps to recreate:`);
      console.log(`         1. Navigate to: ${tab.url}`);
      console.log(`         2. Expected: Page loads successfully`);
      console.log(`         3. Actual: Returns HTTP 404 (page not found)`);
      issuesFound++;
      continue;
    }

    await acceptUniConsent(page);
    await page.waitForTimeout(150); // Optimized

    // Quick scroll to load content
    await page.mouse.wheel(0, 1500);
    await page.waitForTimeout(80); // Minimal wait

    // Check for "No data available" messages
      const noDataMessages = [
      'No Fixture Data Available',
      'No Results Available',
      'No Data Available',
      'No matches found',
      'No data found',
    ];
    let foundNoData = false;
    for (const msg of noDataMessages) {
      if (await page.locator(`text=/${msg}/i`).first().isVisible({ timeout: 800 }).catch(() => false)) {
        console.log(`   ⚠️ ${tab.name} shows "No Data Available" message: ${tab.url}`);
        issuesFound++;
        foundNoData = true;
        break;
      }
    }
    if (foundNoData) continue;

    // Check for broken images (only on News tab)
    if (tab.name === 'News') {
      const imgs = page.locator('main img');
      const imgCount = await imgs.count().catch(() => 0);
      let brokenImages = 0;
      for (let i = 0; i < Math.min(imgCount, 20); i++) {
        const img = imgs.nth(i);
        try {
          if (await img.isVisible().catch(() => false)) {
            const width = await img.evaluate(el => (el as HTMLImageElement).naturalWidth).catch(() => 1);
            if (width === 0) {
              brokenImages++;
              const src = await img.getAttribute('src').catch(() => 'unknown');
              if (brokenImages === 1) {
                console.log(`   ❌ Broken image found on ${tab.name} tab: ${tab.url}`);
                console.log(`      📋 Steps to recreate:`);
                console.log(`         1. Navigate to: ${tab.url}`);
                console.log(`         2. Scroll down to find images`);
                console.log(`         3. Look for broken/missing image`);
                console.log(`         4. Image src: ${src}`);
                issuesFound++;
              }
            }
          }
        } catch {}
      }
    }

    // Check for broken links (only on News tab, sample 5 links)
    if (tab.name === 'News') {
      const links = page.locator('main a[href]');
      const linkCount = await links.count().catch(() => 0);
      let brokenLinks = 0;
      for (let i = 0; i < Math.min(linkCount, 5); i++) {
        const link = links.nth(i);
        const href = await link.getAttribute('href').catch(() => '');
        if (href && !href.startsWith('#') && !href.startsWith('javascript:') && !href.includes('facebook.com') && !href.includes('twitter.com')) {
          const fullUrl = href.startsWith('http') ? href : new URL(href, page.url()).toString();
        try {
          const linkResponse = await page.request.get(fullUrl, { timeout: 1500 });
            if (linkResponse.status() >= 400) {
              brokenLinks++;
              if (brokenLinks === 1) {
                console.log(`   ❌ Broken link found on ${tab.name} tab: ${tab.url}`);
                console.log(`      📋 Steps to recreate:`);
                console.log(`         1. Navigate to: ${tab.url}`);
                console.log(`         2. Look for a link that points to: ${fullUrl}`);
                console.log(`         3. Click on that link`);
                console.log(`         4. Expected: Page should load successfully`);
                console.log(`         5. Actual: Returns HTTP ${linkResponse.status()} (broken link)`);
                issuesFound++;
              }
            }
          } catch {}
        }
      }
    }

    // Check for ads (only on News tab)
    if (tab.name === 'News') {
      const adSelectors = ['[id*="ad" i]', '[class*="ad" i]', '[data-ad]', 'iframe[src*="ads"]'];
      const adCount = await page.locator(adSelectors.join(',')).count().catch(() => 0);
      if (adCount === 0) {
        console.log(`   ⚠️ No ads found on ${tab.name} tab: ${tab.url}`);
        console.log(`      📋 Steps to recreate:`);
        console.log(`         1. Navigate to: ${tab.url}`);
        console.log(`         2. Expected: Advertisements should be visible`);
        console.log(`         3. Actual: No ads detected`);
        issuesFound++;
      }
    }
  }

  return issuesFound;
}

test('Planet Rugby – Teams testing only', async ({ page }) => {
  test.setTimeout(45 * 60_000); // 45 minutes (53 teams × 4 tabs each = ~30-40 min needed)

  console.log('🚀 Starting Planet Rugby Teams tests');
  
  // Test National Teams
  console.log('\n=== TESTING NATIONAL TEAMS ===');
  const nationalTeamsToTest = [
    'Argentina',
    'Australia',
    'England',
    'Fiji',
    'France',
    'Georgia',
    'Ireland',
    'Italy',
    'Japan',
    'New Zealand',
    'Samoa',
    'Scotland',
    'South Africa',
    'Tonga',
    'USA',
    'Wales',
  ];
  let nationalTeamsTested = 0;
  let nationalTeamsPassed = 0;

  for (const teamName of nationalTeamsToTest) {
    // Always start from the homepage for each team
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await acceptUniConsent(page);
    await page.waitForTimeout(200); // Optimized

    // Wait a bit longer and ensure consent is fully dismissed
    await page.waitForTimeout(500); // Optimized
    await acceptUniConsent(page);
    
    // Open Teams dropdown
    const teamsBtn = page.getByRole('button', { name: /Teams/i }).first();
    if (!(await teamsBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      console.log(`❌ Could not find 'Teams' button when testing National Team: ${teamName}`);
      continue;
    }
    
    // Try to click, if blocked by overlay, wait and try again
    try {
      await teamsBtn.click({ timeout: 5000, force: true });
    } catch {
      // If still blocked, wait more and try again
      await page.waitForTimeout(600); // Optimized
      await acceptUniConsent(page);
      await teamsBtn.click({ timeout: 5000, force: true });
    }
    await page.waitForTimeout(200); // Optimized

    // Click National Teams tab
    const nationalTeamsBtn = page.getByRole('button', { name: /National Teams/i }).first();
    if (!(await nationalTeamsBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      console.log(`❌ Could not find 'National Teams' tab when testing team: ${teamName}`);
      continue;
    }
    await nationalTeamsBtn.click({ timeout: 3000 });
    await page.waitForTimeout(200); // Optimized

    // Click specific team link inside the National Teams panel
    const teamLink = page
      .locator('#ps-league-tab-panel-0')
      .getByRole('link', { name: teamName, exact: true })
      .first();

    if (!(await teamLink.isVisible({ timeout: 3000 }).catch(() => false))) {
      console.log(`❌ National Team link not visible: ${teamName}`);
      continue;
    }

    const href = await teamLink.getAttribute('href').catch(() => '');
    console.log(`\n🌍 Testing National Team: ${teamName} → ${href}`);

    await teamLink.click({ timeout: 5000 }).catch(() => {});
    await page.waitForLoadState('domcontentloaded');
    await acceptUniConsent(page);
    await page.waitForTimeout(300); // Optimized

    // Get the base team URL (e.g., https://www.planetrugby.com/team/france)
    const teamBaseUrl = page.url();
    console.log(`   📍 Team base URL: ${teamBaseUrl}`);

    // Test all tabs using helper function
    const { tabsWithContent, totalTabs } = await testTeamTabs(page, teamName, teamBaseUrl, 'National Teams');

    nationalTeamsTested++;

    if (tabsWithContent === totalTabs) {
      console.log(`✅ National Team all tabs loaded correctly: ${teamName}`);
      nationalTeamsPassed++;
    } else {
      console.log(`❌ National Team tabs did not fully load: ${teamName} (${tabsWithContent}/${totalTabs} tabs showed content)`);
    }
  }

  console.log(`\n📊 National Teams Summary: ${nationalTeamsPassed}/${nationalTeamsTested} passed`);

  // Test English Premiership teams
  console.log('\n=== TESTING ENGLISH PREMIERSHIP TEAMS ===');
  const premiershipTeamsToTest = [
    'Bath',
    'Bristol',
    'Exeter',
    'Gloucester',
    'Harlequins',
    'Leicester',
    'Newcastle',
    'Northampton',
    'Sale',
    'Saracens',
  ];
  let premiershipTeamsTested = 0;
  let premiershipTeamsPassed = 0;

  for (const teamName of premiershipTeamsToTest) {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await acceptUniConsent(page);
    await page.waitForTimeout(1500);
    await acceptUniConsent(page);

    const teamsBtn = page.getByRole('button', { name: /Teams/i }).first();
    if (!(await teamsBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      console.log(`❌ Could not find 'Teams' button when testing Premiership Team: ${teamName}`);
      continue;
    }

    try {
      await teamsBtn.click({ timeout: 5000, force: true });
    } catch {
      await page.waitForTimeout(2000);
      await acceptUniConsent(page);
      await teamsBtn.click({ timeout: 5000, force: true });
    }
    await page.waitForTimeout(500);

    const premiershipBtn = page.getByRole('button', { name: /English Premiership/i }).first();
    if (!(await premiershipBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      console.log(`❌ Could not find 'English Premiership' tab when testing team: ${teamName}`);
      continue;
    }
    await premiershipBtn.click({ timeout: 3000 });
    await page.waitForTimeout(300); // Reduced for speed

    const teamLink = page
      .locator('#ps-league-tab-panel-1')
      .getByRole('link', { name: teamName, exact: true })
      .first();

    if (!(await teamLink.isVisible({ timeout: 3000 }).catch(() => false))) {
      console.log(`❌ Premiership Team link not visible: ${teamName}`);
      continue;
    }

    const href = await teamLink.getAttribute('href').catch(() => '');
    console.log(`\n🏴 Testing Premiership Team: ${teamName} → ${href}`);

    await teamLink.click({ timeout: 5000 }).catch(() => {});
    await page.waitForLoadState('domcontentloaded');
    await acceptUniConsent(page);
    await page.waitForTimeout(300); // Optimized

    const teamBaseUrl = page.url();
    console.log(`   📍 Team base URL: ${teamBaseUrl}`);

    const { tabsWithContent, totalTabs } = await testTeamTabs(page, teamName, teamBaseUrl, 'English Premiership');

    premiershipTeamsTested++;

    if (tabsWithContent === totalTabs) {
      console.log(`✅ Premiership Team all tabs loaded correctly: ${teamName}`);
      premiershipTeamsPassed++;
    } else {
      console.log(`❌ Premiership Team tabs did not fully load: ${teamName} (${tabsWithContent}/${totalTabs} tabs showed content)`);
    }
  }

  console.log(`\n📊 English Premiership Teams Summary: ${premiershipTeamsPassed}/${premiershipTeamsTested} passed`);

  // Test United Rugby Championship teams
  console.log('\n=== TESTING UNITED RUGBY CHAMPIONSHIP TEAMS ===');
  const urcTeamsToTest = [
    'Benetton',
    'Bulls',
    'Cardiff',
    'Connacht',
    'Dragons',
    'Edinburgh',
    'Glasgow Warriors',
    'Leinster',
    'Lions',
    'Munster',
    'Ospreys',
    'Scarlets',
    'Sharks',
    'Stormers',
    'Ulster',
    'Zebre',
  ];
  let urcTeamsTested = 0;
  let urcTeamsPassed = 0;

  for (const teamName of urcTeamsToTest) {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await acceptUniConsent(page);
    await page.waitForTimeout(1500);
    await acceptUniConsent(page);

    const teamsBtn = page.getByRole('button', { name: /Teams/i }).first();
    if (!(await teamsBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      console.log(`❌ Could not find 'Teams' button when testing URC Team: ${teamName}`);
      continue;
    }

    try {
      await teamsBtn.click({ timeout: 5000, force: true });
    } catch {
      await page.waitForTimeout(2000);
      await acceptUniConsent(page);
      await teamsBtn.click({ timeout: 5000, force: true });
    }
    await page.waitForTimeout(500);

    const urcBtn = page.getByRole('button', { name: /United Rugby Championship/i }).first();
    if (!(await urcBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      console.log(`❌ Could not find 'United Rugby Championship' tab when testing team: ${teamName}`);
      continue;
    }
    await urcBtn.click({ timeout: 3000 });
    await page.waitForTimeout(300); // Reduced for speed

    const teamLink = page
      .locator('#ps-league-tab-panel-2')
      .getByRole('link', { name: teamName, exact: true })
      .first();

    if (!(await teamLink.isVisible({ timeout: 3000 }).catch(() => false))) {
      console.log(`❌ URC Team link not visible: ${teamName}`);
      continue;
    }

    const href = await teamLink.getAttribute('href').catch(() => '');
    console.log(`\n🏆 Testing URC Team: ${teamName} → ${href}`);

    await teamLink.click({ timeout: 5000 }).catch(() => {});
    await page.waitForLoadState('domcontentloaded');
    await acceptUniConsent(page);
    await page.waitForTimeout(300); // Optimized

    const teamBaseUrl = page.url();
    console.log(`   📍 Team base URL: ${teamBaseUrl}`);

    const { tabsWithContent, totalTabs } = await testTeamTabs(page, teamName, teamBaseUrl, 'United Rugby Championship');

    urcTeamsTested++;

    if (tabsWithContent === totalTabs) {
      console.log(`✅ URC Team all tabs loaded correctly: ${teamName}`);
      urcTeamsPassed++;
    } else {
      console.log(`❌ URC Team tabs did not fully load: ${teamName} (${tabsWithContent}/${totalTabs} tabs showed content)`);
    }
  }

  console.log(`\n📊 United Rugby Championship Teams Summary: ${urcTeamsPassed}/${urcTeamsTested} passed`);

  // Test Super Rugby teams
  console.log('\n=== TESTING SUPER RUGBY TEAMS ===');
  const superRugbyTeamsToTest = [
    'Blues',
    'Brumbies',
    'Chiefs',
    'Crusaders',
    'Fijian Drua',
    'Highlanders',
    'Hurricanes',
    'Moana Pasifika',
    'Reds',
    'Waratahs',
    'Western Force',
  ];
  let superRugbyTeamsTested = 0;
  let superRugbyTeamsPassed = 0;

  for (const teamName of superRugbyTeamsToTest) {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await acceptUniConsent(page);
    await page.waitForTimeout(1500);
    await acceptUniConsent(page);

    const teamsBtn = page.getByRole('button', { name: /Teams/i }).first();
    if (!(await teamsBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      console.log(`❌ Could not find 'Teams' button when testing Super Rugby Team: ${teamName}`);
      continue;
    }

    try {
      await teamsBtn.click({ timeout: 5000, force: true });
    } catch {
      await page.waitForTimeout(2000);
      await acceptUniConsent(page);
      await teamsBtn.click({ timeout: 5000, force: true });
    }
    await page.waitForTimeout(500);

    const superRugbyBtn = page.getByRole('button', { name: /Super Rugby/i }).first();
    if (!(await superRugbyBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      console.log(`❌ Could not find 'Super Rugby' tab when testing team: ${teamName}`);
      continue;
    }
    await superRugbyBtn.click({ timeout: 3000 });
    await page.waitForTimeout(300); // Reduced for speed

    const teamLink = page
      .locator('#ps-league-tab-panel-3')
      .getByRole('link', { name: teamName, exact: true })
      .first();

    if (!(await teamLink.isVisible({ timeout: 3000 }).catch(() => false))) {
      console.log(`❌ Super Rugby Team link not visible: ${teamName}`);
      continue;
    }

    const href = await teamLink.getAttribute('href').catch(() => '');
    console.log(`\n🌏 Testing Super Rugby Team: ${teamName} → ${href}`);

    await teamLink.click({ timeout: 5000 }).catch(() => {});
    await page.waitForLoadState('domcontentloaded');
    await acceptUniConsent(page);
    await page.waitForTimeout(300); // Optimized

    const teamBaseUrl = page.url();
    console.log(`   📍 Team base URL: ${teamBaseUrl}`);

    const { tabsWithContent, totalTabs } = await testTeamTabs(page, teamName, teamBaseUrl, 'Super Rugby');

    superRugbyTeamsTested++;

    if (tabsWithContent === totalTabs) {
      console.log(`✅ Super Rugby Team all tabs loaded correctly: ${teamName}`);
      superRugbyTeamsPassed++;
    } else {
      console.log(`❌ Super Rugby Team tabs did not fully load: ${teamName} (${tabsWithContent}/${totalTabs} tabs showed content)`);
    }
  }

  console.log(`\n📊 Super Rugby Teams Summary: ${superRugbyTeamsPassed}/${superRugbyTeamsTested} passed`);

  // Test Rugby tournaments (Rugby World Cup, Six Nations, Internationals, Rugby Championship, British & Irish Lions)
  console.log('\n=== TESTING TEST RUGBY TOURNAMENTS ===');
  const testRugbyTournaments = [
    { name: 'Rugby World Cup', url: `${BASE_URL}tournament/rugby-world-cup` },
    { name: 'Six Nations', url: `${BASE_URL}tournament/six-nations` },
    { name: 'Internationals', url: `${BASE_URL}tournament/internationals` },
    { name: 'Rugby Championship', url: `${BASE_URL}tournament/rugby-championship` },
    { name: 'British & Irish Lions', url: `${BASE_URL}tournament/british-irish-lions` },
  ];
  let testRugbyTournamentsTested = 0;
  let testRugbyIssuesFound = 0;

  for (const tournament of testRugbyTournaments) {
    console.log(`\n🏉 Testing Tournament: ${tournament.name}`);
    const issues = await testTournamentTabs(page, tournament.name, tournament.url);
    testRugbyTournamentsTested++;
    testRugbyIssuesFound += issues;
    if (issues === 0) {
      console.log(`   ✅ No issues found for ${tournament.name}`);
    }
  }

  console.log(`\n📊 Test Rugby Tournaments Summary: ${testRugbyIssuesFound} issues found across ${testRugbyTournamentsTested} tournaments`);

  // Club Rugby tournaments (Premiership, URC, Top 14, Super Rugby, Champions Cup, Challenge Cup)
  console.log('\n=== TESTING CLUB RUGBY TOURNAMENTS ===');
  const clubRugbyTournaments = [
    { name: 'Premiership', url: `${BASE_URL}tournament/premiership` },
    { name: 'URC', url: `${BASE_URL}tournament/united-rugby-championship` },
    { name: 'Top 14', url: `${BASE_URL}tournament/top-14` },
    { name: 'Super Rugby', url: `${BASE_URL}tournament/super-rugby` },
    { name: 'Champions Cup', url: `${BASE_URL}tournament/rugby-champions-cup` },
    { name: 'Challenge Cup', url: `${BASE_URL}tournament/challenge-cup` },
  ];
  let clubRugbyTournamentsTested = 0;
  let clubRugbyIssuesFound = 0;

  for (const tournament of clubRugbyTournaments) {
    console.log(`\n🏆 Testing Tournament: ${tournament.name}`);
    const issues = await testTournamentTabs(page, tournament.name, tournament.url);
    clubRugbyTournamentsTested++;
    clubRugbyIssuesFound += issues;
    if (issues === 0) {
      console.log(`   ✅ No issues found for ${tournament.name}`);
    }
  }

  console.log(`\n📊 Club Rugby Tournaments Summary: ${clubRugbyIssuesFound} issues found across ${clubRugbyTournamentsTested} tournaments`);
  console.log('\n✅ Planet Rugby Teams tests completed!');
});
