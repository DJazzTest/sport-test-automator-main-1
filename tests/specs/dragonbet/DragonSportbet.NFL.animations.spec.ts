import { test } from '@playwright/test';
import { configureDragonBetTimeouts, openDragonBetHome, openDragonBetSport } from '../../Utils/dragonbetAnimationDetect';
import {
  assertDragonBetAnimationRun,
  runDragonBetAnimationTabs,
} from '../../Utils/dragonbetAnimationTabRunner';
import { AMERICAN_FOOTBALL_NO_EVENTS_FAILURE, recordDragonBetSiteBlocked } from '../../Utils/dragonbetAnimationReport';
import { DRAGONBET_GEO_BLOCK_FAILURE } from '../../Utils/dragonbetAnimationDetect';

test.describe.configure({ retries: 0 });

const NFL_TABS = ['Today', 'Tomorrow', 'Weekend'] as const;

test('DragonSport – NFL Animation Check (American Football)', async ({ page, context }) => {
  test.setTimeout(10 * 60_000);
  configureDragonBetTimeouts(page);

  try {
    await openDragonBetHome(page);
    console.log('🏈 Navigating to American Football...');
    await openDragonBetSport(page, 'american-football', /American Football/i);
    await page.waitForTimeout(500);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('geo-block') || msg.includes(DRAGONBET_GEO_BLOCK_FAILURE)) {
      recordDragonBetSiteBlocked('NFL', NFL_TABS, msg);
    }
    throw error;
  }

  const run = await runDragonBetAnimationTabs({
    page,
    context,
    sportKey: 'nfl',
    reportSport: 'NFL',
    sportLabel: 'American Football',
    tabs: NFL_TABS,
    failOnEmptyTab: false,
    noEventsMessage: AMERICAN_FOOTBALL_NO_EVENTS_FAILURE,
  });

  assertDragonBetAnimationRun({
    page,
    context,
    sportKey: 'nfl',
    reportSport: 'NFL',
    sportLabel: 'American Football',
    tabs: NFL_TABS,
    failOnEmptyTab: false,
    noEventsMessage: AMERICAN_FOOTBALL_NO_EVENTS_FAILURE,
    ...run,
  });
});
