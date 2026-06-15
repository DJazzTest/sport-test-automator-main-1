import * as fs from 'fs';
import * as path from 'path';

const REPORT_DIR = path.join(process.cwd(), 'test-results');
const REPORT_PATH = path.join(REPORT_DIR, 'email-report.json');

export type DragonBetSport = 'Football' | 'Cricket' | 'Tennis' | 'NFL';

export type TabResult = {
  tested: number;
  passed: number;
  failed: number;
  failures?: string[];
  /** Events visible in listing before sampling. */
  totalListed?: number;
  /** Tab loaded but zero event rows — counts as fail (feed issue or no fixtures). */
  noEvents?: boolean;
};

export const AMERICAN_FOOTBALL_NO_EVENTS_FAILURE =
  'American Football fail: no events listed on any tab — may be off-season or a feed issue; mark Expected on dashboard if intentional, then re-run when fixtures should be live';

export const FOOTBALL_NO_EVENTS_FAILURE =
  'Football fail: no events listed on Today or Tomorrow — feed issue or wrong tab state; re-run when fixtures should be live';

export const FOOTBALL_TAB_NO_EVENTS_FAILURE =
  'Football fail: no events listed on tab';

type CoverageCheck = {
  section: string;
  name: string;
  status: 'pass' | 'fail' | 'skip';
  message?: string;
  detail?: string;
};

function loadReport(): { siteName: string; failures: string[]; checks: CoverageCheck[] } {
  if (!fs.existsSync(REPORT_PATH)) {
    return { siteName: 'DragonBet', failures: [], checks: [] };
  }
  try {
    const data = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8')) as {
      siteName?: string;
      failures?: string[];
      checks?: CoverageCheck[];
    };
    return {
      siteName: data.siteName || 'DragonBet',
      failures: Array.isArray(data.failures) ? [...data.failures] : [],
      checks: Array.isArray(data.checks) ? [...data.checks] : [],
    };
  } catch {
    return { siteName: 'DragonBet', failures: [], checks: [] };
  }
}

/** Merge one sport's tab results into test-results/email-report.json (multi-spec CI job). */
export function mergeDragonBetSportReport(
  sport: DragonBetSport,
  tabs: Record<string, TabResult>,
  siteName = process.env.DRAGONBET_REPORT_SITE || 'DragonBet Animations All',
): void {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const report = loadReport();
  const prefix = `${sport} —`;
  const checks = report.checks.filter((c) => !c.name.startsWith(prefix));
  const failures = report.failures.filter((f) => !f.startsWith(`${sport} `));
  const outSite = siteName || report.siteName || 'DragonBet Animations All';

  for (const [tab, stats] of Object.entries(tabs)) {
    const name = `${sport} — ${tab}`;
    const tabFailures = stats.failures ?? [];
    for (const line of tabFailures) {
      failures.push(`${sport} ${tab}: ${line}`);
    }
    if (stats.failed > 0 && !tabFailures.length) {
      failures.push(`${sport} ${tab}: ${stats.failed} event(s) missing live animation`);
    }
    if (stats.noEvents && stats.tested === 0) {
      failures.push(`${sport} ${tab}: no events listed`);
    }

    let status: 'pass' | 'fail' | 'skip' = 'pass';
    if (stats.noEvents && stats.tested === 0) status = 'fail';
    else if (stats.tested === 0) status = 'skip';
    else if (stats.failed > 0) status = 'fail';

    checks.push({
      section: 'Coverage',
      name,
      status,
      detail: stats.tested
        ? stats.totalListed != null
          ? `${stats.passed}/${stats.tested} passed (${stats.totalListed} listed, sampled ${stats.tested})`
          : `${stats.passed}/${stats.tested} events`
        : stats.noEvents
          ? stats.totalListed != null
            ? `no events listed (${stats.totalListed} rows)`
            : 'no events listed'
          : 'tab not available',
      message:
        tabFailures[0] ??
        (stats.noEvents ? 'no events listed' : stats.failed ? `${stats.failed} failed` : undefined),
    });
  }

  const payload = {
    siteName: outSite,
    failures: [...new Set(failures)],
    checks,
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(payload, null, 0));
}

/** Top-level failure when a sport had zero events across all tabs. */
export function appendSportNoEventsFailure(sport: DragonBetSport, message: string): void {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const report = loadReport();
  if (!report.failures.includes(message)) report.failures.push(message);
  fs.writeFileSync(
    REPORT_PATH,
    JSON.stringify(
      {
        siteName: report.siteName,
        failures: report.failures,
        checks: report.checks,
      },
      null,
      0,
    ),
  );
}
