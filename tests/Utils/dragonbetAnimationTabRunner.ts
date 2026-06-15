import { BrowserContext, Page, expect } from '@playwright/test';
import {
  animationSampleCount,
  configureDragonBetTimeouts,
  detectSportAnimation,
  eventListingLinks,
  eventTitle,
  expandLiveTracker,
  spreadEventIndices,
  waitForEventListing,
} from './dragonbetAnimationDetect';
import {
  appendSportNoEventsFailure,
  mergeDragonBetSportReport,
  type DragonBetSport,
  type TabResult,
} from './dragonbetAnimationReport';

export type AnimationDetectSport = 'football' | 'nfl';

export type DragonBetTabRunOptions = {
  page: Page;
  context: BrowserContext;
  sportKey: AnimationDetectSport;
  reportSport: DragonBetSport;
  sportLabel: string;
  tabs: readonly string[];
  /** Football uses Today/Tomorrow buttons; American Football uses the main listing only. */
  tabMode?: 'date-tabs' | 'listing-only';
  /** When true, an empty Today/Tomorrow-style tab fails the run (Football). */
  failOnEmptyTab: boolean;
  noEventsMessage: string;
  tabNoEventsMessage?: string;
  tryFootballWidgetTabs?: boolean;
};

export type DragonBetTabRunResult = {
  pass: number;
  fail: number;
  results: string[];
  tabStats: Record<string, TabResult>;
  eventsTested: number;
};

function noEventsTabResult(totalListed = 0): TabResult {
  return {
    tested: 0,
    passed: 0,
    failed: 0,
    totalListed,
    noEvents: true,
    failures: ['no events listed'],
  };
}

export async function activateDragonBetDateTab(page: Page, tab: string): Promise<boolean> {
  try {
    await page.getByRole('button', { name: 'All' }).first().click({ timeout: 2000 });
    await page.waitForTimeout(350);
  } catch {}
  const tabButton = page.getByRole('button', { name: tab }).first();
  if (!(await tabButton.isVisible({ timeout: 2000 }).catch(() => false))) {
    return false;
  }
  await tabButton.click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(500);
  return true;
}

async function detectAnimation(
  detail: Page,
  sport: AnimationDetectSport,
  tryFootballWidgetTabs: boolean,
): Promise<boolean> {
  let hasAnim = await detectSportAnimation(detail, sport);
  if (hasAnim || !tryFootballWidgetTabs || sport !== 'football') return hasAnim;
  try {
    const frame = await detail.locator('#the-football-sport-widget iframe').elementHandle({ timeout: 2000 });
    const f = await frame?.contentFrame();
    await f?.locator('.swiper-slide').first().click({ timeout: 1500 });
    hasAnim = await detectSportAnimation(detail, 'football');
  } catch {}
  return hasAnim;
}

export async function runDragonBetAnimationTabs(
  options: DragonBetTabRunOptions,
): Promise<DragonBetTabRunResult> {
  const {
    page,
    context,
    sportKey,
    reportSport,
    sportLabel,
    tabs,
    tabMode = 'date-tabs',
    failOnEmptyTab,
    tryFootballWidgetTabs = false,
  } = options;

  let pass = 0;
  let fail = 0;
  const results: string[] = [];
  const tabStats: Record<string, TabResult> = {};

  const tabsToRun = tabMode === 'listing-only' ? [tabs[0] ?? 'Listing'] : tabs;

  for (const tab of tabsToRun) {
    console.log(`\n🔍 Testing ${sportLabel} – ${tab}`);
    let tabPass = 0;
    let tabFail = 0;
    const tabFailures: string[] = [];

    if (tabMode === 'date-tabs') {
      const tabVisible = await activateDragonBetDateTab(page, tab);
      if (!tabVisible) {
        console.log(`   ℹ️ Tab "${tab}" not visible`);
        tabStats[tab] = {
          tested: 0,
          passed: 0,
          failed: 0,
          noEvents: true,
          failures: [`tab "${tab}" not visible`],
        };
        if (failOnEmptyTab) fail++;
        continue;
      }
    } else {
      console.log('   ℹ️ Listing-only mode (no date tabs on this sport page)');
    }

    if (await page.getByText(/Sorry,? we haven't found any/i).isVisible({ timeout: 1500 }).catch(() => false)) {
      console.log(`   ℹ️ No events on ${tab} (empty state message)`);
      tabStats[tab] = {
        ...noEventsTabResult(),
        failures: ['no events listed — empty state on site'],
      };
      if (failOnEmptyTab) fail++;
      continue;
    }

    const eventLinks = eventListingLinks(page);
    const total = await waitForEventListing(page, 20_000);
    const sampleCount = animationSampleCount(total);
    const indices = spreadEventIndices(total);

    console.log(
      `   📊 ${tab}: ${total} events listed → testing ${sampleCount} (spread indices: ${indices.map((i) => i + 1).join(', ') || 'none'})`,
    );

    if (!total) {
      console.log(`   ℹ️ No events listed on ${tab}`);
      tabStats[tab] = noEventsTabResult();
      if (failOnEmptyTab) fail++;
      continue;
    }

    for (const i of indices) {
      const link = eventLinks.nth(i);
      const title = await eventTitle(link);
      const href = await link.getAttribute('href').catch(() => null);
      console.log(`   🎯 ${i + 1}/${total} (sample ${indices.indexOf(i) + 1}/${indices.length}): ${title}`);

      if (!href) {
        fail++;
        tabFail++;
        tabFailures.push(`${title} — no event link`);
        results.push(`FAIL: ${tab} — ${title} — no event link`);
        continue;
      }

      const detail = await context.newPage();
      configureDragonBetTimeouts(detail);
      try {
        await detail.goto(new URL(href, page.url()).toString(), { waitUntil: 'domcontentloaded' });
        await expandLiveTracker(detail);
        const hasAnim = await detectAnimation(detail, sportKey, tryFootballWidgetTabs);
        if (hasAnim) {
          pass++;
          tabPass++;
          results.push(`PASS: ${tab} — ${title}`);
        } else {
          fail++;
          tabFail++;
          tabFailures.push(`${title} — no live animation`);
          results.push(`FAIL: ${tab} — ${title} — no live animation`);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        fail++;
        tabFail++;
        tabFailures.push(`${title} — ${msg}`);
        results.push(`FAIL: ${tab} — ${title} — ${msg}`);
      } finally {
        await detail.close().catch(() => {});
      }
    }

    tabStats[tab] = {
      tested: tabPass + tabFail,
      passed: tabPass,
      failed: tabFail,
      totalListed: total,
      failures: tabFailures,
    };
  }

  const eventsTested = tabsToRun.reduce((n, t) => n + (tabStats[t]?.tested ?? 0), 0);
  console.log(`\n🧪 ${sportLabel.toUpperCase()} RESULTS — PASS: ${pass} | FAIL: ${fail} | events tested: ${eventsTested}`);
  for (const tab of tabsToRun) {
    const s = tabStats[tab];
    if (!s) continue;
    console.log(
      `   ${tab}: ${s.totalListed ?? 0} listed, ${s.tested} tested, ${s.passed} pass, ${s.failed} animation fail${s.noEvents ? ', NO EVENTS' : ''}`,
    );
  }

  mergeDragonBetSportReport(reportSport, tabStats);
  return { pass, fail, results, tabStats, eventsTested };
}

export function assertDragonBetAnimationRun(
  options: DragonBetTabRunOptions & DragonBetTabRunResult,
): void {
  const { tabs, failOnEmptyTab, noEventsMessage, tabNoEventsMessage, fail, results, tabStats, eventsTested } =
    options;

  if (failOnEmptyTab && tabNoEventsMessage) {
    const emptyTabs = tabs.filter((t) => tabStats[t]?.noEvents);
    if (emptyTabs.length) {
      const msg = `${tabNoEventsMessage}: ${emptyTabs.join(', ')}`;
      appendSportNoEventsFailure(options.reportSport, msg);
      expect(emptyTabs, msg).toEqual([]);
    }
  }

  if (eventsTested === 0) {
    const emptyTabs = tabs.filter((t) => tabStats[t]?.noEvents).join(', ');
    appendSportNoEventsFailure(
      options.reportSport,
      `${noEventsMessage}${emptyTabs ? ` (checked: ${emptyTabs})` : ''}`,
    );
    expect(eventsTested, noEventsMessage).toBeGreaterThan(0);
  }

  expect(
    fail,
    `${options.sportLabel} failures:\n${results.filter((r) => r.startsWith('FAIL:')).slice(0, 20).join('\n')}`,
  ).toBe(0);
}
