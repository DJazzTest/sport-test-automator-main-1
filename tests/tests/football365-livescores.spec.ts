import { test, expect, Page, Frame } from '@playwright/test';

async function dismissUniConsentIfPresent(page: Page): Promise<void> {
	// Try a few common consent iframe/button patterns defensively.
	// If not present, this should be a no-op.
	const potentialIframeSelectors = [
		'iframe[id^="sp_message_iframe_"]', // Sourcepoint / UniConsent common pattern
		'iframe[title*="Consent" i]',
		'iframe[src*="consent" i]'
	];

	for (const iframeSelector of potentialIframeSelectors) {
		const iframe = page.frameLocator(iframeSelector);
		if (await page.locator(iframeSelector).first().isVisible({ timeout: 2000 }).catch(() => false)) {
			// Try multiple button texts/selectors that are commonly used.
			const acceptButtonLocators = [
				iframe.getByRole('button', { name: /accept & continue/i }),
				iframe.getByRole('button', { name: /accept all/i }),
				iframe.getByRole('button', { name: /agree/i }),
				iframe.getByText(/accept & continue/i).locator('xpath=ancestor-or-self::*[self::button or self::a]'),
				iframe.locator('button:has-text("Accept & Continue")'),
				iframe.locator('button:has-text("Accept All")')
			];

			for (const acceptButton of acceptButtonLocators) {
				try {
					if (await acceptButton.first().isVisible({ timeout: 1500 })) {
						await acceptButton.first().click({ timeout: 5000 });
						// Give the overlay a moment to disappear
						await page.waitForTimeout(500);
						return;
					}
				} catch {
					// try next locator
				}
			}
		}
	}

	// Handle non-iframe UniConsent container (observed as #uniccmp)
	const uniCmp = page.locator('#uniccmp');
	if (await uniCmp.isVisible({ timeout: 1500 }).catch(() => false)) {
		const acceptButtons = [
			uniCmp.getByRole('button', { name: /accept & continue/i }),
			uniCmp.getByRole('button', { name: /accept all/i }),
			uniCmp.locator('button:has-text("Accept & Continue")'),
			uniCmp.locator('button:has-text("Accept All")')
		];
		for (const btn of acceptButtons) {
			try {
				if (await btn.first().isVisible({ timeout: 1000 })) {
					await btn.first().click({ timeout: 5000 });
					await uniCmp.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
					break;
				}
			} catch {}
		}
	}
}

test.describe('football365 Live Scores flow', () => {
	test('navigates to Live Scores and validates match rows', async ({ page }) => {
		// Start at homepage to click through the header nav as requested.
		await page.goto('https://www.football365.com/', { waitUntil: 'domcontentloaded' });

		await dismissUniConsentIfPresent(page);

		// Ensure header nav is visible and click Live Scores
		const liveScoresLink = page.getByRole('link', { name: /live scores/i });
		await expect(liveScoresLink, 'Live Scores link should be visible in header').toBeVisible();
		await liveScoresLink.click();

		// We expect to land on a livescores listing page
		await page.waitForLoadState('domcontentloaded');

		// They redirect to a subdomain like https://livescore.football365.com/en-gb
		await expect(page, 'URL should contain livescore').toHaveURL(/livescore/i);

		// Validate presence of competition blocks that are shown as inactive-link elements
		const competitionTiles = page.locator('.inactive-link');
		const competitionCount = await competitionTiles.count();
		expect(competitionCount, 'Expected at least one competition tile').toBeGreaterThan(0);

		// Some pages require selecting a competition before leg rows appear
		let legRows = page.locator('.leg-row');
		if (await legRows.count() === 0) {
			await competitionTiles.first().click();
			await page.waitForLoadState('networkidle');
			legRows = page.locator('.leg-row');
		}

		// Find leg rows which contain matches and a clickable wrapper link
		const legRowsCount = await legRows.count();
		expect(legRowsCount, 'Expected at least one match leg row').toBeGreaterThan(0);

		// Within a leg-row, we expect an anchor with class wrp-all and href containing /match/
		const matchWrapperLink = legRows.first().locator('a.wrp-all');
		// The link may be visually hidden within the row container; assert existence and attribute
		await expect(matchWrapperLink, 'Expected a match wrapper link inside first leg row').toHaveCount(1);
		await expect(matchWrapperLink, 'Match link href should contain /match/').toHaveAttribute('href', /\/match\//);

		// Optionally, assert that we can see some reference to today on the page
		// Many sites label a section as Today or show today date; check leniently.
		const today = new Date();
		const todayParts = today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).split(' ');
		const todayRegexParts = todayParts.map(p => p.replace(/[-/\\^$*+?.()|[\]{}]/g, ''));
		const todayRegex = new RegExp(todayRegexParts.join('|'), 'i');

		const hasTodayHeading = await page.locator(`text=/Today|${todayRegex.source}/i`).first().isVisible().catch(() => false);
		expect(hasTodayHeading, 'Expected Today or today\'s date to be referenced on the page').toBeTruthy();
	});
});


