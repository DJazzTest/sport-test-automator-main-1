import { appendEmailReportFailures } from './emailReportMerge';
import { formatAnimationFailLine, oneLine } from './animationEmailReport';

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

/**
 * Only rows that failed animation checks (DETAILED RESULTS lines starting with FAIL:).
 * One email failure string per distinct FAIL; PASS rows are omitted.
 * Prefer lines that already include `| URL:`; otherwise keep legacy title-only FAIL lines.
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
      if (/\|\s*URL:\s*https?:\/\//i.test(detail)) {
        raw.push(formatAnimationFailLine({
          site: 'Betwright',
          sport,
          tab,
          title: detail.replace(/\s*\|\s*URL:\s*https?:\/\/\S+/i, '').trim(),
          url: (detail.match(/https?:\/\/\S+/i) || [''])[0],
        }));
      } else {
        raw.push(`Betwright ${sport} | ${tab} | FAIL: ${detail}`);
      }
    }
  };
  collect('Today', todayResults);
  collect('Tomorrow', tomorrowResults);
  return Array.from(new Set(raw));
}

export { formatAnimationFailLine, oneLine };

