import { test, Page, APIRequestContext } from '@playwright/test';
import { assertTeamTalkBrokenImages } from '../../Utils/contentHelpers';
import { TEAMTALK_MAX_LINKS, TEAMTALK_SCROLL_PASSES, TEAMTALK_TEAMS_TIMEOUT_MS } from '../../Utils/testRunConfig';
import { teamTalkTagFallbackUrl } from '../../Utils/urlCanonical';

/** Biggest clubs — fixed list per product request. */
const TEAMS_TO_TEST = ['Leeds', 'Liverpool', 'Manchester United', 'Chelsea'] as const;

const TEAM_TABS = ['Overview', 'News'] as const;

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
  await page.waitForTimeout(500);
  const direct = page.getByRole('button', { name: /Accept\s*&\s*Continue/i }).first();
  if (await direct.isVisible()) {
    await direct.click({ timeout: 5000 }).catch(() => {});
  }
}

async function dismissOverlays(page: Page) {
  await page.evaluate(() => {
    for (const id of ['uniccmp', 'ps-nav-overlay']) {
      const el = document.getElementById(id);
      if (el) {
        (el as HTMLElement).style.setProperty('display', 'none', 'important');
        (el as HTMLElement).style.setProperty('pointer-events', 'none', 'important');
      }
    }
  });
}

async function checkNoBrokenImages(
  page: Page,
  request: APIRequestContext,
  sectionName: string,
  emailFailures?: string[],
) {
  await assertTeamTalkBrokenImages(page, request, sectionName, emailFailures);
}

async function fetchLinkStatus(request: APIRequestContext, url: string): Promise<number> {
  let res = await request.fetch(url, { method: 'HEAD', timeout: 8000 }).catch(() => null);
  let status = res?.status() ?? -1;
  if (!res || status === 405 || status === 501 || status === 403 || status < 0 || status >= 400) {
    res = await request.fetch(url, { method: 'GET', timeout: 12000 }).catch(() => null);
    status = res?.status() ?? -1;
  }
  // Bare /{player} often 404s while /tag/{player} is the live topic page.
  if (status >= 400) {
    const fallback = teamTalkTagFallbackUrl(url);
    if (fallback) {
      const fbStatus = await fetchLinkStatusRaw(request, fallback);
      if (fbStatus > 0 && fbStatus < 400) return fbStatus;
    }
  }
  return status;
}

async function fetchLinkStatusRaw(request: APIRequestContext, url: string): Promise<number> {
  let res = await request.fetch(url, { method: 'HEAD', timeout: 8000 }).catch(() => null);
  let status = res?.status() ?? -1;
  if (!res || status === 405 || status === 501 || status === 403 || status < 0 || status >= 400) {
    res = await request.fetch(url, { method: 'GET', timeout: 12000 }).catch(() => null);
    status = res?.status() ?? -1;
  }
  return status;
}

async function checkBrokenLinks(
  page: Page,
  request: APIRequestContext,
  sectionName: string,
  maxLinks: number,
  emailFailures?: string[],
) {
  const hrefs = await page.$$eval('main a[href]', (as: Element[]) =>
    Array.from(new Set((as as HTMLAnchorElement[]).map((a) => a.href).filter(Boolean))),
  );
  const firstParty = hrefs
    .map(normalizeUrl)
    .filter((url, idx, arr) => arr.indexOf(url) === idx)
    .filter(isTeamTalkHost)
    .filter((url) => {
      const lower = url.toLowerCase();
      if (!/^https?:/i.test(url)) return false;
      if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.gif'))
        return false;
      if (lower.includes('/content/uploads/')) return false;
      return true;
    });

  const sample =
    firstParty.length > maxLinks
      ? firstParty.sort(() => Math.random() - 0.5).slice(0, maxLinks)
      : firstParty;

  for (const url of sample) {
    const status = await fetchLinkStatus(request, url);
    if (status >= 400 || status < 0) {
      const msg =
        status >= 400
          ? `Broken URL: ${sectionName} | ${url} (${status})`
          : `Unreachable in test: ${sectionName} | ${url}`;
      emailFailures?.push(msg);
    }
  }
}

/** Explicit /tag/ link audit (Overview + News). */
async function checkTagLinks(
  page: Page,
  request: APIRequestContext,
  sectionName: string,
  maxTags: number,
  emailFailures?: string[],
) {
  const tagHrefs = await page
    .$$eval('main a[href*="/tag/"]', (as: Element[]) =>
      Array.from(new Set((as as HTMLAnchorElement[]).map((a) => a.href).filter(Boolean))),
    )
    .catch(() => [] as string[]);

  const sample = tagHrefs
    .map(normalizeUrl)
    .filter(isTeamTalkHost)
    .filter((url, idx, arr) => arr.indexOf(url) === idx)
    .slice(0, maxTags);

  for (const url of sample) {
    // Tag URLs are already canonical — do not apply bare-slug fallback.
    const status = await fetchLinkStatusRaw(request, url);
    if (status >= 400 || status < 0) {
      const msg =
        status >= 400
          ? `Broken URL: ${sectionName} | ${url} (${status})`
          : `Unreachable in test: ${sectionName} | ${url}`;
      emailFailures?.push(msg);
    }
  }
}

async function visitTeamTab(
  page: Page,
  request: APIRequestContext,
  teamName: string,
  tab: (typeof TEAM_TABS)[number],
  emailFailures: string[],
) {
  const slug = teamName.toLowerCase().replace(/\s+/g, '-');
  const url = tab === 'Overview' ? `https://www.teamtalk.com/team/${slug}` : `https://www.teamtalk.com/team/${slug}/news`;
  const label = `${teamName} – ${tab}`;

  console.log(`\n===== ${label.toUpperCase()} =====`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await acceptUniConsent(page);
  await dismissOverlays(page);

  for (let s = 0; s < TEAMTALK_SCROLL_PASSES; s++) {
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(80);
  }
  await page.evaluate(() => window.scrollTo(0, 0));

  await checkNoBrokenImages(page, request, label, emailFailures);
  await checkBrokenLinks(page, request, label, TEAMTALK_MAX_LINKS, emailFailures);
  await checkTagLinks(page, request, label, 5, emailFailures);
}

test('TeamTalk Teams: biggest clubs — Overview & News (images, links, tags)', async ({ page, request }) => {
  test.setTimeout(TEAMTALK_TEAMS_TIMEOUT_MS);
  const emailFailures: string[] = [];

  console.log(
    `TeamTalk Teams: ${TEAMS_TO_TEST.length} teams × ${TEAM_TABS.length} tabs (Overview + News only)`,
  );

  for (const teamName of TEAMS_TO_TEST) {
    for (const tab of TEAM_TABS) {
      await visitTeamTab(page, request, teamName, tab, emailFailures);
    }
  }

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

    if (deduped.length > 0) {
      console.log(`\n❌ ${deduped.length} failure(s):`);
      deduped.forEach((f) => console.log(`  • ${f}`));
      throw new Error(`TeamTalk Teams test finished with ${deduped.length} failure(s) — see email-report.json`);
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('failure(s)')) throw e;
  }

  console.log(`\n✅ TeamTalk Teams: ${TEAMS_TO_TEST.length} teams checked (Overview + News)`);
});
