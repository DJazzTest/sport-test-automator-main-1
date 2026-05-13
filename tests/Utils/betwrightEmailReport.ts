import * as fs from 'fs';
import * as path from 'path';

const SITE = 'Betwright';

export type BetwrightTabAnimationResults = {
  tested: number;
  passed: number;
  failed: number;
  results: string[];
};

/** Merge new failure lines into test-results/email-report.json for CI email step. */
export function appendBetwrightEmailFailures(newFailures: string[]): void {
  if (newFailures.length === 0) return;
  const reportDir = path.join(process.cwd(), 'test-results');
  const reportPath = path.join(reportDir, 'email-report.json');
  fs.mkdirSync(reportDir, { recursive: true });
  let merged: string[] = [];
  if (fs.existsSync(reportPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as { siteName?: string; failures?: string[] };
      if (data.siteName === SITE && Array.isArray(data.failures)) merged = [...data.failures];
    } catch {
      // ignore corrupt file; overwrite with new failures only
    }
  }
  const deduped = Array.from(new Set([...merged, ...newFailures]));
  fs.writeFileSync(reportPath, JSON.stringify({ siteName: SITE, failures: deduped }, null, 0));
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
