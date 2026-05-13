import * as fs from 'fs';
import * as path from 'path';

const SITE = 'Betwright';

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

export function betwrightAnimationFailuresForEmail(
  sport: 'Cricket' | 'Football' | 'Tennis',
  todayResults: { results: string[] },
  tomorrowResults: { results: string[] }
): string[] {
  const lines: string[] = [];
  const pushFails = (tab: string, results: string[]) => {
    for (const r of results) {
      if (!r.startsWith('FAIL:')) continue;
      const detail = r
        .replace(/^FAIL:\s*/i, '')
        .replace(/\s+/g, ' ')
        .trim();
      lines.push(`Betwright ${sport} animation (${tab}): ${detail} — no live animation/iframe detected`);
    }
  };
  pushFails('Today', todayResults.results);
  pushFails('Tomorrow', tomorrowResults.results);
  return lines;
}
