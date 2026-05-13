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

/**
 * One email "failure" entry with newlines — mirrors console (tab counts, detailed PASS/FAIL lines, overall).
 * CI email body shows this as the main narrative when animations fail.
 */
export function formatBetwrightAnimationEmailReportBlock(
  sport: 'Cricket' | 'Football' | 'Tennis',
  todayResults: BetwrightTabAnimationResults,
  tomorrowResults: BetwrightTabAnimationResults
): string {
  const indent = (s: string) =>
    s
      .split('\n')
      .map((line) => (line.length ? `   ${line}` : ''))
      .join('\n');

  const tabBlock = (tabLabel: 'Today' | 'Tomorrow', data: BetwrightTabAnimationResults) =>
    [
      `📋 === TESTING ${tabLabel.toUpperCase()} EVENTS (summary) ===`,
      `   Events tested: ${data.tested} | PASS: ${data.passed} | FAIL (no animation): ${data.failed}`,
      '',
      `📋 === DETAILED RESULTS (${tabLabel}) ===`,
      ...data.results.map((r) => indent(r)),
      '',
    ].join('\n');

  const totalTested = todayResults.tested + tomorrowResults.tested;
  const totalPassed = todayResults.passed + tomorrowResults.passed;
  const totalFailed = todayResults.failed + tomorrowResults.failed;

  return [
    `=== Betwright ${sport} – animation failure report ===`,
    '',
    tabBlock('Today', todayResults),
    tabBlock('Tomorrow', tomorrowResults),
    `🏁 === FINAL ${sport.toUpperCase()} SUMMARY ===`,
    '',
    `   Today tab:    tested ${todayResults.tested} | PASS ${todayResults.passed} | FAIL ${todayResults.failed}`,
    `   Tomorrow tab: tested ${tomorrowResults.tested} | PASS ${tomorrowResults.passed} | FAIL ${tomorrowResults.failed}`,
    `   OVERALL:      tested ${totalTested} | PASS ${totalPassed} | FAIL ${totalFailed}`,
    '',
    'Where: betwright.com → sport navigation → event pages (Today / Tomorrow tabs).',
    'What:  live animation iframe / SVG / YouTube tracker not detected for listed FAIL rows.',
    '=== End report ===',
  ].join('\n');
}
