import { test, expect } from '@playwright/test';
import { InPlayPage } from './InPlayPage';

test('Navigate to In Play and select an active game', async ({ page }) => {
  const inPlay = new InPlayPage(page);

  // Given I navigate to "https://planetsportbet.com/"
  await inPlay.gotoHome();

  // Then the In Play page should be returned
  expect(await inPlay.isInPlayPage()).toBeTruthy();

  // And I should see a list of events with the label "In Play"
  // (isInPlayPage already checks for at least one such label)

  // When I click on one of these "In Play" event elements
  const clicked = await inPlay.clickFirstInPlayEvent();
  expect(clicked).toBeTruthy();

  // Then I should be navigated to the event detail page
  expect(await inPlay.isOnEventDetailPage()).toBeTruthy();
});
