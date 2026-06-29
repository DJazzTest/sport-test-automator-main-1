import { appendEmailReportFailures } from './emailReportMerge';

export type BetwrightTabAnimationResults = {
  tested: number;
  passed: number;
  failed: number;
  results: string[];
};

/** Merge Betwright failure lines into test-results/email-report.json for CI email step. */
export function appendBetwrightEmailFailures(newFailures: string[]): void {
  appendEmailReportFailures('Betwright', newFailures);
}

/** Collapse internal newlines (e.g. event title + kick-off) to a single line for email. */
function oneLine(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Only rows that failed animation checks (DETAILED RESULTS lines starting with FAIL:).
 * One email failure string per distinct FAIL; PASS rows are omitted.
 */
export function betwrightAnimationFailLinesForEmail(
  sport: 'Cricket' | 'Football' | 'Tennis',
  todayResults: BetwrightTabAnimationResults,
  tomorrowResults: BetwrightTabAnimationResults
): string[] {
  const raw: string[] = [];
  const collect = (tab: 'Today' | 'Tomorrow', data: BetwrightTabAnimationResults) => {
    for (const r of data.results) {
      if (!r.startsWith('FAIL:')) continue;
      const detail = oneLine(r.replace(/^FAIL:\s*/i, ''));
      raw.push(`Betwright ${sport} | ${tab} | FAIL: ${detail}`);
    }
  };
  collect('Today', todayResults);
  collect('Tomorrow', tomorrowResults);
  return Array.from(new Set(raw));
}
