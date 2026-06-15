import { test } from '@playwright/test';
import { configureDragonBetTimeouts, openDragonBetHome, openDragonBetSport } from '../../Utils/dragonbetAnimationDetect';
import {
  assertDragonBetAnimationRun,
  runDragonBetAnimationTabs,
} from '../../Utils/dragonbetAnimationTabRunner';
import { AMERICAN_FOOTBALL_NO_EVENTS_FAILURE } from '../../Utils/dragonbetAnimationReport';

test.describe.configure({ retries: 0 });

const NFL_TABS = ['Today', 'Tomorrow', 'Weekend'] as const;

test('DragonSport – NFL Animation Check (American Football)', async ({ page, context }) => {
  test.setTimeout(10 * 60_000);
  configureDragonBetTimeouts(page);

  await openDragonBetHome(page);
  console.log('🏈 Navigating to American Football...');
  await openDragonBetSport(page, 'american-football', /American Football/i);
  await page.waitForTimeout(500);

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
