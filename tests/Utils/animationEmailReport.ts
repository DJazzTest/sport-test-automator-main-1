import { appendEmailReportFailures } from './emailReportMerge';

/** Collapse whitespace for a single email/report line. */
export function oneLine(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Standard failure line used in console, assertions, and email-report.json.
 * Example: `DragonBet NFL | FAIL: Cardinals vs Panthers | URL: https://.../event/123`
 */
export function formatAnimationFailLine(opts: {
  site: string;
  sport: string;
  title: string;
  url: string;
  tab?: string;
}): string {
  const title = oneLine(opts.title);
  const url = oneLine(opts.url || '(url unavailable)');
  const tabPart = opts.tab ? ` | ${opts.tab}` : '';
  return `${opts.site} ${opts.sport}${tabPart} | FAIL: ${title} | URL: ${url}`;
}

/** Extract bare URL from a formatted fail line, if present. */
export function urlFromFailLine(line: string): string | null {
  const m = line.match(/\|\s*URL:\s*(https?:\/\/\S+)/i);
  return m ? m[1] : null;
}

/** Merge animation failure lines into test-results/email-report.json for CI email. */
export function appendAnimationEmailFailures(siteName: string, failLines: string[]): void {
  const cleaned = failLines.map(oneLine).filter(Boolean);
  if (cleaned.length === 0) return;
  appendEmailReportFailures(siteName, Array.from(new Set(cleaned)));
}

/** Build assertion message that lists failed event URLs. */
export function missingAnimationsAssertMessage(failLines: string[]): string {
  const urls = failLines
    .map((l) => urlFromFailLine(l) || oneLine(l))
    .filter(Boolean);
  const count = failLines.length;
  const list = urls.length ? `\nFailed URLs:\n${urls.map((u, i) => `  ${i + 1}. ${u}`).join('\n')}` : '';
  return `Expected no missing live animations; ${count} event(s) failed animation detection.${list}`;
}
