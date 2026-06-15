import { test } from '@playwright/test';
import { configureDragonBetTimeouts, openDragonBetHome, openDragonBetSport } from '../../Utils/dragonbetAnimationDetect';
import {
  assertDragonBetAnimationRun,
  runDragonBetAnimationTabs,
} from '../../Utils/dragonbetAnimationTabRunner';
import {
  FOOTBALL_NO_EVENTS_FAILURE,
  FOOTBALL_TAB_NO_EVENTS_FAILURE,
} from '../../Utils/dragonbetAnimationReport';

test.describe.configure({ retries: 0 });

const FOOTBALL_TABS = ['Today', 'Tomorrow'] as const;

test('DragonSport – Football Animation Check', async ({ page, context }) => {
  test.setTimeout(12 * 60_000);
  configureDragonBetTimeouts(page);

  await openDragonBetHome(page);
  console.log('⚽ Navigating to Football...');
  await openDragonBetSport(page, 'football', 'Football');
  await page.waitForTimeout(500);

  const run = await runDragonBetAnimationTabs({
    page,
    context,
    sportKey: 'football',
    reportSport: 'Football',
    sportLabel: 'Football',
    tabs: FOOTBALL_TABS,
    failOnEmptyTab: true,
    noEventsMessage: FOOTBALL_NO_EVENTS_FAILURE,
    tabNoEventsMessage: FOOTBALL_TAB_NO_EVENTS_FAILURE,
    tryFootballWidgetTabs: true,
  });

  assertDragonBetAnimationRun({
    page,
    context,
    sportKey: 'football',
    reportSport: 'Football',
    sportLabel: 'Football',
    tabs: FOOTBALL_TABS,
    failOnEmptyTab: true,
    noEventsMessage: FOOTBALL_NO_EVENTS_FAILURE,
    tabNoEventsMessage: FOOTBALL_TAB_NO_EVENTS_FAILURE,
    tryFootballWidgetTabs: true,
    ...run,
  });
});
