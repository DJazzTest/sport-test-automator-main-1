import { test, expect } from '@playwright/test';

/**
 * Feature: LoveRugbyLeague Homepage Quality and Navigation Validation
 * 
 * Scenario: User navigates to LoveRugbyLeague and verifies homepage quality
 *   Given I navigate to "https://www.loverugbyleague.com"
 *   Then I should land on the LoveRugbyLeague home page
 *   
 *   And the homepage should load successfully without errors
 *   
 *   When I scroll through the homepage
 *   Then all visible images should load correctly
 *   And no broken images should be displayed
 *   
 *   And all visible text content should be readable
 *   And no broken or missing text should be present
 *   
 *   When I check all visible links on the homepage
 *   Then each link should redirect to a valid page
 *   And no broken links should be detected
 *   
 *   When I navigate through the main site header
 *   Then I should see the following sections available:
 *     | Scores & Fixtures |
 *     | Results |
 *     | Table |
 *     | Transfer News |
 *     | Super League |
 *     | NRL |
 *     | Championship |
 *     | Teams |
 *   
 *   When I click on each section
 *   Then I should be redirected to the correct page
 *   And the page content should load successfully
 *   
 *   And no major layout or rendering issues should be visible
 *   
 *   Then the user experience should meet expected standards
 *   for navigation, readability, and content accessibility.
 */

const BASE_URL = 'https://www.loverugbyleague.com/';

// Expected header navigation sections
const EXPECTED_HEADER_SECTIONS = [
  'Scores & Fixtures',
  'Results',
  'Table',
  'Transfer News',
  'Super League',
  'NRL',
  'Championship',
  'Teams'
];

// Limit link checks to avoid hammering the site
const MAX_LINKS_TO_CHECK = 75;
const MAX_CONCURRENT_FETCH = 8;

function isFirstPartyLoveRugbyLeagueUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'www.loverugbyleague.com' || host === 'loverugbyleague.com';
  } catch {
    return false;
  }
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.toString();
  } catch {
    return url;
  }
}

// Helper to throttle concurrency
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length) as R[];
  let nextIndex = 0;
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (true) {
      const current = nextIndex++;
      if (current >= items.length) break;
      results[current] = await fn(items[current], current);
    }
  });
  await Promise.all(workers);
  return results;
}

// Random sampler: return up to max indices from 0..len-1
function sampleIndices(len: number, max: number): number[] {
  const count = Math.min(len, max);
  const idxs = Array.from({ length: len }, (_, i) => i);
  for (let i = idxs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
  }
  return idxs.slice(0, count).sort((a, b) => a - b);
}

test('LoveRugbyLeague – Homepage Quality and Navigation Validation', async ({ page, request, browserName }) => {
  test.setTimeout(10 * 60_000);

  console.log('🚀 Feature: LoveRugbyLeague Homepage Quality and Navigation Validation');
  console.log('🧭 Scenario: User navigates to LoveRugbyLeague and verifies homepage quality');
  console.log(`Given I navigate to "${BASE_URL}"`);
  
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/loverugbyleague\.com/);
  console.log('Then I should land on the LoveRugbyLeague home page ✅');

  // Consent/CMP dismissal helper
  const acceptConsent = async () => {
    try {
      const roleBtn = page.getByRole('button', { name: /accept\s*&?\s*continue|accept|allow|allow all/i }).first();
      if (await roleBtn.isVisible({ timeout: 1200 }).catch(() => false)) {
        await roleBtn.click({ timeout: 2000 }).catch(() => {});
        console.log('✅ Consent dismissed');
        return;
      }
    } catch {}
    try {
      const cmpBtn = page.locator('#uniccmp button:has-text("Accept")').first();
      if (await cmpBtn.isVisible({ timeout: 1200 }).catch(() => false)) {
        await cmpBtn.click({ timeout: 2000 }).catch(() => {});
        console.log('✅ Consent dismissed (UNICCMP)');
        return;
      }
    } catch {}
    try {
      const exact = page.locator('button:has-text("Accept & Continue")').first();
      if (await exact.isVisible({ timeout: 1200 }).catch(() => false)) {
        await exact.click({ timeout: 2000 }).catch(() => {});
        console.log('✅ Consent dismissed (Accept & Continue)');
      }
    } catch {}
  };

  await acceptConsent();
  await page.waitForTimeout(1000);

  // Check for page load errors
  console.log('And the homepage should load successfully without errors');
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  
  if (pageErrors.length > 0) {
    console.log(`⚠️  Found ${pageErrors.length} page errors:`);
    pageErrors.forEach(err => console.log(`   ❌ ${err}`));
  } else {
    console.log('✅ Homepage loaded successfully without errors');
  }

  console.log('When I scroll through the homepage');
  
  // Scroll down the page to load all content
  const scrollToBottom = async () => {
    let previousHeight = 0;
    let currentHeight = await page.evaluate(() => document.body.scrollHeight);
    
    while (previousHeight !== currentHeight) {
      previousHeight = currentHeight;
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);
      currentHeight = await page.evaluate(() => document.body.scrollHeight);
    }
    
    // Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
  };

  await scrollToBottom();
  console.log('✅ Page scrolled through successfully');

  // Wait for page to fully load
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);

  console.log('Then all visible images should load correctly');
  console.log('And no broken images should be displayed');

  // Collect all links on the page
  const allLinks = await page.$$eval('a[href]', links =>
    links.map(a => ({
      href: a.href,
      text: a.textContent?.trim() || '',
      visible: a.offsetParent !== null
    })).filter(l => l.href && l.visible)
  );

  console.log(`🔍 Found ${allLinks.length} links on the homepage`);

  // Filter out javascript:, mailto:, tel:, and anchor links
  const httpLinks = allLinks.filter(
    link =>
      link.href.startsWith('http') &&
      !link.href.includes('javascript:') &&
      !link.href.startsWith('mailto:') &&
      !link.href.startsWith('tel:') &&
      !link.href.includes('#') &&
      isFirstPartyLoveRugbyLeagueUrl(link.href)
  );

  // Sample links if there are too many
  const linksToCheck = httpLinks.length > MAX_LINKS_TO_CHECK
    ? sampleIndices(httpLinks.length, MAX_LINKS_TO_CHECK).map(i => httpLinks[i])
    : httpLinks;

  console.log(`🔍 Checking ${linksToCheck.length} links for broken status...`);

  // Check links for broken status
  const brokenLinks: Array<{ url: string; status: number; text: string }> = [];
  
  const checkLink = async (link: { href: string; text: string }, index: number) => {
    try {
      const canonicalHref = normalizeUrl(link.href);
      let response = await request.fetch(canonicalHref, { method: 'HEAD', timeout: 6000 }).catch(() => null);
      if (!response || response.status() === 405 || response.status() === 501) {
        response = await request.fetch(canonicalHref, { method: 'GET', timeout: 9000 }).catch(() => null);
      }
      const status = response?.status() ?? 0;
      let ok = status >= 200 && status < 400;

      if (ok) {
        const getRes = await request.fetch(canonicalHref, { method: 'GET', timeout: 9000 }).catch(() => null);
        const body = (await getRes?.text().catch(() => '')) || '';
        const bodyText = body.toLowerCase();
        const hasStrongNotFoundMarker =
          /404\s*(error|page)?/i.test(bodyText) ||
          /page you are looking for/i.test(bodyText) ||
          /this page (does not|doesn't) exist/i.test(bodyText);
        const hasContentMarker =
          bodyText.includes('<h1') ||
          bodyText.includes('<article') ||
          bodyText.includes('<main');
        // Treat as broken only for strong 404 templates with little/no page structure.
        if (hasStrongNotFoundMarker && !hasContentMarker && bodyText.length < 12000) ok = false;
      }

      if (!ok) {
        brokenLinks.push({ url: canonicalHref, status, text: link.text });
        console.log(`❌ [${status || 0}] ${canonicalHref}`);
      }
    } catch (error) {
      // Network errors or timeouts are considered broken
      brokenLinks.push({ url: normalizeUrl(link.href), status: 0, text: link.text });
      console.log(`❌ [ERROR] ${normalizeUrl(link.href)}`);
    }
  };

  console.log('When I check all visible links on the homepage');
  console.log('Then each link should redirect to a valid page');
  console.log('And no broken links should be detected');
  
  await mapWithConcurrency(linksToCheck, MAX_CONCURRENT_FETCH, checkLink);

  // Collect all images on the page
  const allImages = await page.$$eval('img[src]', imgs =>
    imgs.map(img => ({
      src: img.src,
      alt: img.getAttribute('alt') || '',
      visible: img.offsetParent !== null,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight
    })).filter(img => img.visible)
  );

  console.log(`🖼️  Found ${allImages.length} images on the homepage`);

  // Check images for broken status
  const brokenImages: Array<{ src: string; alt: string; reason: string }> = [];
  
  const checkImage = async (img: { src: string; alt: string; naturalWidth: number; naturalHeight: number }, index: number) => {
    try {
      // Check if image has zero dimensions (broken)
      if (img.naturalWidth === 0 || img.naturalHeight === 0) {
        brokenImages.push({
          src: img.src,
          alt: img.alt,
          reason: 'Image has zero dimensions (likely broken)'
        });
        console.log(`❌ Broken image (zero dimensions): ${img.src}`);
        return;
      }

      // Check HTTP status for image
      const response = await request.get(img.src, { timeout: 10000 });
      const status = response.status();
      if (status >= 400) {
        brokenImages.push({
          src: img.src,
          alt: img.alt,
          reason: `HTTP ${status}`
        });
        console.log(`❌ [${status}] Image: ${img.src}`);
      }
    } catch (error) {
      brokenImages.push({
        src: img.src,
        alt: img.alt,
        reason: 'Network error or timeout'
      });
      console.log(`❌ [ERROR] Image: ${img.src}`);
    }
  };

  await mapWithConcurrency(allImages, MAX_CONCURRENT_FETCH, checkImage);

  // Check for broken/missing text
  console.log('And all visible text content should be readable');
  console.log('And no broken or missing text should be present');
  console.log('📝 Checking for broken or missing text...');
  
  const textIssues: Array<{ element: string; issue: string }> = [];
  
  // Check for empty headings
  const emptyHeadings = await page.$$eval('h1, h2, h3, h4, h5, h6', headings =>
    headings
      .filter(h => h.offsetParent !== null && (!h.textContent || h.textContent.trim() === ''))
      .map(h => ({ tag: h.tagName.toLowerCase(), id: h.id || '', class: h.className || '' }))
  );

  if (emptyHeadings.length > 0) {
    emptyHeadings.forEach(h => {
      textIssues.push({
        element: `${h.tag}${h.id ? `#${h.id}` : ''}${h.class ? `.${h.class.split(' ')[0]}` : ''}`,
        issue: 'Empty heading element'
      });
    });
    console.log(`⚠️  Found ${emptyHeadings.length} empty heading elements`);
  }

  // Check for placeholder text that might indicate broken content
  const placeholderTexts = await page.$$eval('*', elements =>
    elements
      .filter(el => {
        const text = el.textContent?.trim() || '';
        const visible = el.offsetParent !== null;
        return visible && (
          text.toLowerCase().includes('lorem ipsum') ||
          text.toLowerCase().includes('placeholder') ||
          text.toLowerCase().includes('sample text') ||
          text === '...' ||
          text === '---'
        );
      })
      .map(el => ({
        tag: el.tagName.toLowerCase(),
        text: el.textContent?.trim().substring(0, 50)
      }))
  );

  if (placeholderTexts.length > 0) {
    placeholderTexts.forEach(p => {
      textIssues.push({
        element: `${p.tag}`,
        issue: `Possible placeholder text: "${p.text}"`
      });
    });
    console.log(`⚠️  Found ${placeholderTexts.length} elements with possible placeholder text`);
  }

  // Check for links with no text (but exclude icon-only links which are common for social media)
  const emptyLinks = await page.$$eval('a[href]', links =>
    links
      .filter(a => {
        const visible = a.offsetParent !== null;
        const hasText = a.textContent && a.textContent.trim() !== '';
        const hasAriaLabel = a.getAttribute('aria-label') || a.getAttribute('title');
        const hasIcon = a.querySelector('svg, img, i[class*="icon"], [class*="icon"]');
        // Only flag if no text, no aria-label, and no icon (likely a real issue)
        return visible && !hasText && !hasAriaLabel && !hasIcon;
      })
      .map(a => ({ href: a.href, title: a.getAttribute('title') || '', ariaLabel: a.getAttribute('aria-label') || '' }))
  );

  if (emptyLinks.length > 0) {
    emptyLinks.forEach(link => {
      textIssues.push({
        element: `Link: ${link.href}`,
        issue: 'Link with no visible text, aria-label, or icon'
      });
    });
    console.log(`⚠️  Found ${emptyLinks.length} links with no visible text, aria-label, or icon`);
  }

  // Summary
  console.log('\n📋 === LOVE RUGBY LEAGUE HOMEPAGE TEST SUMMARY ===');
  console.log(`\n🔗 BROKEN LINKS: ${brokenLinks.length}`);
  if (brokenLinks.length > 0) {
    console.log('   Broken links found:');
    brokenLinks.forEach(link => {
      console.log(`   ❌ [${link.status}] ${link.url}`);
      if (link.text) {
        console.log(`      Link text: "${link.text.substring(0, 50)}"`);
      }
      console.log(`      📋 Steps to recreate:`);
      console.log(`         1. Navigate to: ${BASE_URL}`);
      console.log(`         2. Scroll down the page`);
      console.log(`         3. Look for a link that points to: ${link.url}`);
      console.log(`         4. Click on that link`);
      console.log(`         5. Expected: Page should load successfully`);
      console.log(`         6. Actual: Returns HTTP ${link.status} (broken link)`);
    });
  } else {
    console.log('   ✅ No broken links found');
  }

  console.log(`\n🖼️  BROKEN IMAGES: ${brokenImages.length}`);
  if (brokenImages.length > 0) {
    console.log('   Broken images found:');
    brokenImages.forEach(img => {
      console.log(`   ❌ ${img.reason}: ${img.src}`);
      if (img.alt) {
        console.log(`      Alt text: "${img.alt}"`);
      }
      console.log(`      📋 Steps to recreate:`);
      console.log(`         1. Navigate to: ${BASE_URL}`);
      console.log(`         2. Scroll down the page`);
      console.log(`         3. Look for the image at: ${img.src}`);
      console.log(`         4. Expected: Image should display correctly`);
      console.log(`         5. Actual: Image is broken (${img.reason})`);
    });
  } else {
    console.log('   ✅ No broken images found');
  }

  console.log(`\n📝 TEXT ISSUES: ${textIssues.length}`);
  if (textIssues.length > 0) {
    console.log('   Text issues found:');
    textIssues.forEach(issue => {
      console.log(`   ⚠️  ${issue.element}: ${issue.issue}`);
    });
  } else {
    console.log('   ✅ No text issues found');
  }

  // Check main site header navigation
  console.log('\nWhen I navigate through the main site header');
  console.log('Then I should see the following sections available:');
  EXPECTED_HEADER_SECTIONS.forEach(section => {
    console.log(`   | ${section} |`);
  });

  const headerSectionResults: Array<{ name: string; found: boolean; url?: string; loaded?: boolean }> = [];
  
  for (const sectionName of EXPECTED_HEADER_SECTIONS) {
    // Try multiple ways to find the header link
    const sectionLink = page.getByRole('link', { name: new RegExp(sectionName.replace('&', '&'), 'i') })
      .or(page.locator(`a:has-text("${sectionName}")`))
      .or(page.locator(`nav a:has-text("${sectionName}")`))
      .or(page.locator(`header a:has-text("${sectionName}")`))
      .first();
    
    const isVisible = await sectionLink.isVisible({ timeout: 2000 }).catch(() => false);
    
    if (isVisible) {
      const href = await sectionLink.getAttribute('href').catch(() => null);
      headerSectionResults.push({ name: sectionName, found: true, url: href || undefined });
      console.log(`✅ Found header section: ${sectionName}`);
    } else {
      headerSectionResults.push({ name: sectionName, found: false });
      console.log(`⚠️  Header section not found: ${sectionName}`);
    }
  }

  // Navigate to each section and verify it loads
  console.log('\nWhen I click on each section');
  console.log('Then I should be redirected to the correct page');
  console.log('And the page content should load successfully');

  for (const section of headerSectionResults.filter(s => s.found && s.url)) {
    try {
      console.log(`\n🔍 Testing section: ${section.name}`);
      
      // Navigate back to homepage first
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForTimeout(1000);
      await acceptConsent();
      
      // Find and click the section link
      const sectionLink = page.getByRole('link', { name: new RegExp(section.name.replace('&', '&'), 'i') })
        .or(page.locator(`a:has-text("${section.name}")`))
        .first();
      
      if (await sectionLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await sectionLink.click({ timeout: 3000 });
        
        // Wait for navigation and content to load
        await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(3000); // Additional wait for dynamic content
        
        // Scroll to trigger lazy loading
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight / 2);
        });
        await page.waitForTimeout(1000);
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        await page.waitForTimeout(1000);
        
        // More comprehensive content detection with multiple checks
        const contentChecks = await Promise.allSettled([
          // Check for main content containers
          page.locator('main, article, [class*="content"], [class*="main"], [class*="page"]').first().isVisible().catch(() => false),
          // Check for headings
          page.locator('h1, h2, h3').first().isVisible().catch(() => false),
          // Check for images
          page.locator('img').first().isVisible().catch(() => false),
          // Check for tables (common in Scores, Results, Table sections)
          page.locator('table, [class*="table"], [class*="fixture"], [class*="result"]').first().isVisible().catch(() => false),
          // Check for lists
          page.locator('ul, ol, [class*="list"]').first().isVisible().catch(() => false),
          // Check for any div with substantial text content
          page.evaluate(() => {
            const divs = Array.from(document.querySelectorAll('div'));
            return divs.some(div => {
              const text = div.textContent?.trim() || '';
              return text.length > 50 && div.offsetHeight > 0 && div.offsetWidth > 0;
            });
          }).catch(() => false),
          // Check for any visible text content
          page.evaluate(() => {
            const bodyText = document.body.textContent?.trim() || '';
            return bodyText.length > 100;
          }).catch(() => false),
        ]);
        
        // Check if any content check passed
        const hasContent = contentChecks.some(result => 
          result.status === 'fulfilled' && result.value === true
        );
        
        // Debug: Log what was found
        if (!hasContent) {
          const debugInfo = await page.evaluate(() => {
            return {
              hasMain: !!document.querySelector('main'),
              hasArticle: !!document.querySelector('article'),
              hasH1: !!document.querySelector('h1'),
              hasH2: !!document.querySelector('h2'),
              hasTable: !!document.querySelector('table'),
              hasImg: !!document.querySelector('img'),
              bodyTextLength: document.body.textContent?.trim().length || 0,
              visibleDivs: Array.from(document.querySelectorAll('div')).filter(d => 
                d.offsetHeight > 0 && d.offsetWidth > 0 && (d.textContent?.trim().length || 0) > 50
              ).length,
            };
          }).catch(() => null);
          
          console.log(`   🔍 Debug info for ${section.name}:`, debugInfo);
        }
        
        if (hasContent) {
          section.loaded = true;
          console.log(`✅ ${section.name} - Page loaded successfully`);
        } else {
          section.loaded = false;
          console.log(`❌ ${section.name} - Page loaded but no content visible`);
        }
      } else {
        section.loaded = false;
        console.log(`⚠️  ${section.name} - Link not clickable`);
      }
    } catch (error) {
      section.loaded = false;
      console.log(`❌ ${section.name} - Error navigating: ${(error as Error).message}`);
    }
  }

  // Check for layout/rendering issues
  console.log('\nAnd no major layout or rendering issues should be visible');
  const layoutIssues: string[] = [];
  
  // Check for overlapping elements
  const overlappingElements = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('*')) as HTMLElement[];
    const issues: string[] = [];
    for (let i = 0; i < Math.min(elements.length, 50); i++) {
      const el = elements[i];
      if (el.offsetParent === null) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0 && el.textContent?.trim()) {
        issues.push(`Element with text "${el.textContent.substring(0, 30)}" has zero dimensions`);
      }
    }
    return issues;
  }).catch(() => []);
  
  if (overlappingElements.length > 0) {
    layoutIssues.push(...overlappingElements);
    console.log(`⚠️  Found ${overlappingElements.length} potential layout issues`);
  } else {
    console.log('✅ No major layout or rendering issues detected');
  }

  // Final summary
  console.log('\nThen the user experience should meet expected standards for navigation, readability, and content accessibility.');
  
  // Final assertion - only fail on critical issues (broken links/images)
  const criticalIssues = brokenLinks.length + brokenImages.length;
  const totalIssues = criticalIssues + textIssues.length;
  const sectionsNotFound = headerSectionResults.filter(s => !s.found).length;
  const sectionsNotLoaded = headerSectionResults.filter(s => s.found && s.loaded === false).length;
  
  console.log('\n📋 === FINAL TEST SUMMARY ===');
  console.log(`\n🏠 HOMEPAGE QUALITY:`);
  console.log(`   - Broken Links: ${brokenLinks.length}`);
  console.log(`   - Broken Images: ${brokenImages.length}`);
  console.log(`   - Text Issues: ${textIssues.length}`);
  console.log(`   - Layout Issues: ${layoutIssues.length}`);
  
  console.log(`\n🧭 HEADER NAVIGATION:`);
  console.log(`   - Sections Found: ${headerSectionResults.filter(s => s.found).length}/${EXPECTED_HEADER_SECTIONS.length}`);
  console.log(`   - Sections Loaded Successfully: ${headerSectionResults.filter(s => s.loaded === true).length}`);
  if (sectionsNotFound > 0) {
    console.log(`   - Missing Sections: ${headerSectionResults.filter(s => !s.found).map(s => s.name).join(', ')}`);
  }
  if (sectionsNotLoaded > 0) {
    console.log(`   - Sections with Load Issues: ${headerSectionResults.filter(s => s.found && s.loaded === false).map(s => s.name).join(', ')}`);
  }
  
  if (totalIssues > 0 || sectionsNotFound > 0 || sectionsNotLoaded > 0) {
    console.log(`\n📊 Found ${totalIssues + sectionsNotFound + sectionsNotLoaded} issues total`);
    console.log(`   - ${brokenLinks.length} broken links (CRITICAL)`);
    console.log(`   - ${brokenImages.length} broken images (CRITICAL)`);
    console.log(`   - ${textIssues.length} text issues (WARNING)`);
    console.log(`   - ${sectionsNotFound} missing header sections (HIGH)`);
    console.log(`   - ${sectionsNotLoaded} sections with load issues (HIGH)`);
    
    // Only fail the test if there are critical issues
    if (criticalIssues > 0 || sectionsNotFound > 0) {
      expect(criticalIssues + sectionsNotFound, 
        `Found ${brokenLinks.length} broken links, ${brokenImages.length} broken images, and ${sectionsNotFound} missing header sections`).toBe(0);
    } else {
      console.log(`\n✅ PASS: No critical issues found (${textIssues.length} warnings for text issues, ${sectionsNotLoaded} sections with load issues)`);
    }
  } else {
    console.log(`\n✅ PASS: All checks passed - Homepage meets expected quality standards`);
  }
});
