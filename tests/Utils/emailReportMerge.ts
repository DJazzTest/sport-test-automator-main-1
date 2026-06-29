import * as fs from 'fs';
import * as path from 'path';

const REPORT_DIR = path.join(process.cwd(), 'test-results');
const REPORT_PATH = path.join(REPORT_DIR, 'email-report.json');

/**
 * Merge failure strings into test-results/email-report.json for CI
 * (`node scripts/email-report.cjs --report=...`).
 *
 * - Same `siteName` across calls in one job: failures are deduped and merged.
 * - Different `siteName` in one job: `siteName` becomes `Multi-site CI` so the email subject reflects a combined run.
 *
 * Call from any spec’s failure path with a stable site label (e.g. "StarSports", "Betwright").
 */
export function appendEmailReportFailures(siteName: string, newFailures: string[]): void {
  if (newFailures.length === 0) return;
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  let merged: string[] = [];
  let outSite = siteName;
  if (fs.existsSync(REPORT_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8')) as { siteName?: string; failures?: string[] };
      if (Array.isArray(data.failures)) merged = [...data.failures];
      if (data.siteName && data.siteName !== siteName) outSite = 'Multi-site CI';
    } catch {
      // ignore corrupt file
    }
  }
  const deduped = Array.from(new Set([...merged, ...newFailures]));
  fs.writeFileSync(REPORT_PATH, JSON.stringify({ siteName: outSite, failures: deduped }, null, 0));
}
