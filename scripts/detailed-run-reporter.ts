/**
 * Playwright custom reporter: writes a full detailed markdown report when the run finishes.
 * Output: test-results/DETAILED_RUN_REPORT.md
 * This runs in the main process and is called after all tests complete, so the report
 * is always generated when the test process exits (no dependency on terminal capture).
 */
import type { Reporter, FullConfig, FullResult, Suite, TestCase, TestResult } from '@playwright/test/reporter';
import * as fs from 'fs';
import * as path from 'path';

interface TestEntry {
  title: string;
  titlePath: string[];
  status: string;
  duration: number;
  error?: string;
  errorFull?: string;
  spec: string;
  attachments?: Array<{ name: string; body?: Buffer | string }>;
}

interface Cricket365SectionResult {
  name: string;
  status: 'passed' | 'failed';
  error?: string;
}

const SPEC_DESCRIPTIONS: Record<string, string> = {
  'planetfootball': '**PlanetFootball E2E** – Homepage (links, images, text), Nav discovery, Teams dropdown (all clubs), Competitions dropdown (all leagues), Quizzes, Games, Nostalgia, Lists, layout and final summary.',
  'football365': '**Football365 E2E** – Homepage, News, Livescores (Match Previews), Teams, Premier League, F365 Favourites, Tables, Fixtures, Results; link audits and ad checks per section.',
  'cricket365': '**Cricket365** – Homepage, Live Scores, Tests, ODI, T20, Countries (parallel). Run ends after Countries. Summary: test-results/Cricket365_Test_Summary_Report.md',
  'golf365': '**Golf365 Tests** – Homepage, theme toggle, consent/overlays, Equipment, Instruction, Courses, News, footer and social links (single-session sequential).',
};

function getSpecDescription(specPath: string): string {
  const lower = specPath.toLowerCase();
  if (lower.includes('planetfootball')) return SPEC_DESCRIPTIONS['planetfootball'];
  if (lower.includes('football365')) return SPEC_DESCRIPTIONS['football365'];
  if (lower.includes('cricket365')) return SPEC_DESCRIPTIONS['cricket365'];
  if (lower.includes('golf365')) return SPEC_DESCRIPTIONS['golf365'];
  return 'E2E and section validations.';
}

function escapeMd(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

class DetailedRunReporter implements Reporter {
  private entries: TestEntry[] = [];
  private startTime = 0;

  printsToStdio(): boolean {
    return false;
  }

  onBegin(_config: FullConfig, _suite: Suite): void {
    this.startTime = Date.now();
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const titlePath = test.titlePath();
    const errMsg = result.error?.message ?? undefined;
    const errorSnippet = errMsg?.split('\n')[0]?.slice(0, 200) ?? undefined;
    const attachments = result.attachments?.map((a) => ({
      name: a.name,
      body: a.body,
    }));
    this.entries.push({
      title: test.title,
      titlePath: titlePath.slice(),
      status: result.status,
      duration: result.duration,
      error: errorSnippet,
      errorFull: errMsg,
      spec: test.location?.file ?? '',
      attachments,
    });
  }

  async onEnd(result: FullResult): Promise<void> {
    try {
      const reportDir = path.join(process.cwd(), 'test-results');
      fs.mkdirSync(reportDir, { recursive: true });
      const outPath = path.join(reportDir, 'DETAILED_RUN_REPORT.md');

      const durationMs = result.duration ?? (Date.now() - this.startTime);
      const durationSec = (durationMs / 1000).toFixed(1);
      const durationMin = (durationMs / 60000).toFixed(1);
      const passed = this.entries.filter((e) => e.status === 'passed').length;
      const failed = this.entries.filter((e) => e.status === 'failed').length;
      const skipped = this.entries.filter((e) => e.status === 'skipped').length;
      const timedOut = this.entries.filter((e) => e.status === 'timedOut').length;
      const failedEntries = this.entries.filter((e) => e.status === 'failed' || e.status === 'timedOut');

      const bySpec = new Map<string, TestEntry[]>();
      for (const e of this.entries) {
        const key = e.spec ? path.relative(process.cwd(), e.spec) : 'Unknown';
        if (!bySpec.has(key)) bySpec.set(key, []);
        bySpec.get(key)!.push(e);
      }

      const rows = this.entries
        .map(
          (e) =>
            `| ${e.status === 'passed' ? '✅' : e.status === 'failed' || e.status === 'timedOut' ? '❌' : '⏭️'} | ${escapeMd(e.title)} | ${e.status} | ${(e.duration / 1000).toFixed(1)}s | ${e.spec ? path.relative(process.cwd(), e.spec) : '-'} | ${e.error ? escapeMd(e.error) : '-'} |`
        )
        .join('\n');

      let failuresSection = '';
      if (failedEntries.length > 0) {
        failuresSection = `
---

## Failures detail

${failedEntries
  .map(
    (e) =>
      `### ${escapeMd(e.title)}

- **Spec:** ${e.spec ? path.relative(process.cwd(), e.spec) : '-'}
- **Duration:** ${(e.duration / 1000).toFixed(1)}s
- **Status:** ${e.status}

\`\`\`
${e.errorFull ? e.errorFull.replace(/```/g, '`​`​`') : e.error || 'No message'}
\`\`\`
`
  )
  .join('\n')}
`;
      }

      let bySpecSection = '';
      if (bySpec.size > 0) {
        const specBlocks = Array.from(bySpec.entries()).map(([specRel, tests]) => {
          const specDesc = getSpecDescription(specRel);
          const totalDur = tests.reduce((s, t) => s + t.duration, 0);
          const subRows = tests
            .map(
              (e) =>
                `| ${e.status === 'passed' ? '✅' : e.status === 'failed' || e.status === 'timedOut' ? '❌' : '⏭️'} | ${escapeMd(e.title)} | ${e.status} | ${(e.duration / 1000).toFixed(1)}s | ${e.error ? escapeMd(e.error) : '-'} |`
            )
            .join('\n');
          return `#### ${specRel}\n\n${specDesc}\n\n**Total duration (this spec):** ${(totalDur / 1000).toFixed(1)}s\n\n| Status | Test | Result | Duration | Error |\n|--------|------|--------|----------|-------|\n${subRows}`;
        });
        bySpecSection = `
---

## Results by spec

${specBlocks.join('\n\n')}
`;
      }

      const runCommand =
        this.entries.length > 0 && this.entries[0].spec
          ? this.entries[0].spec.includes('planetfootball')
            ? '`npm run test:planetfootball -- --headed`'
            : this.entries[0].spec.includes('football365')
              ? '`npm run test:football365 -- --headed`'
              : this.entries[0].spec.includes('cricket365')
                ? '`npx playwright test Cricket365web.spec.ts --headed`'
                : this.entries[0].spec.includes('golf365')
                  ? '`npx playwright test Golf365web.spec.ts --headed`'
                  : '`npx playwright test <spec> --headed`'
          : '`npx playwright test --headed`';

      const report = `# Playwright Run – Detailed Report

**Generated:** ${new Date().toISOString()}
**Run status:** ${result.status}
**Duration:** ${durationSec}s (${durationMin} min)
**Tests:** ${passed} passed, ${failed} failed, ${timedOut} timed out, ${skipped} skipped

---

## Executive summary

| Metric     | Count   |
|-----------|---------|
| Passed    | ${passed} |
| Failed    | ${failed} |
| Timed out | ${timedOut} |
| Skipped   | ${skipped} |
| **Total** | **${this.entries.length}** |
| **Duration** | **${durationSec}s** |

---

## Per-test results (all)

| Status | Test | Result | Duration | Spec | Error |
|--------|------|--------|----------|------|-------|
${rows}
${bySpecSection}${failuresSection}

---

## Artifacts and re-run

| Artifact | Path |
|----------|------|
| This report | \`test-results/DETAILED_RUN_REPORT.md\` |
| HTML report | \`test-results-html/index.html\` (open in browser) |
| JUnit XML | \`test-results/junit.xml\` |
| Football365 summary | \`test-results/FOOTBALL365_E2E_REPORT.md\` (when running Football365) |
| Cricket365 summary | \`test-results/Cricket365_Test_Summary_Report.md\` (when running Cricket365) |

**Re-run command (headed):** ${runCommand}
`;

      fs.writeFileSync(outPath, report, 'utf8');
      console.log('\n📋 Detailed run report written to: test-results/DETAILED_RUN_REPORT.md');

      // Cricket365: generate and emit summary report (for sending on completion)
      const cricket365Entries = this.entries.filter((e) => e.spec && e.spec.toLowerCase().includes('cricket365'));
      if (cricket365Entries.length > 0) {
        const c365Entry = cricket365Entries[0];
        const c365Passed = cricket365Entries.filter((e) => e.status === 'passed').length;
        const c365Failed = cricket365Entries.filter((e) => e.status === 'failed' || e.status === 'timedOut').length;
        const c365Skipped = cricket365Entries.filter((e) => e.status === 'skipped').length;
        const c365Failures = cricket365Entries.filter((e) => e.status === 'failed' || e.status === 'timedOut');
        const summaryPath = path.join(reportDir, 'Cricket365_Test_Summary_Report.md');

        let sectionResults: Cricket365SectionResult[] = [];
        const sectionsAttachment = c365Entry.attachments?.find((a) => a.name === 'cricket365-sections.json');
        if (sectionsAttachment?.body) {
          try {
            const raw = typeof sectionsAttachment.body === 'string' ? sectionsAttachment.body : sectionsAttachment.body.toString('utf8');
            sectionResults = JSON.parse(raw) as Cricket365SectionResult[];
          } catch {
            sectionResults = [];
          }
        }

        const allSectionNames = ['Homepage', 'Live Scores', 'Tests', 'ODI', 'T20', 'Countries', 'Country Pagination (Page 2)'];
        const completedNames = new Set(sectionResults.map((s) => s.name));
        const testFailed = c365Entry.status === 'failed' || c365Entry.status === 'timedOut';
        if (testFailed && sectionResults.length < allSectionNames.length) {
          for (const name of allSectionNames) {
            if (!completedNames.has(name)) {
              sectionResults.push({ name, status: 'failed', error: c365Entry.errorFull || c365Entry.error });
              completedNames.add(name);
            }
          }
        }

        const sectionTableRows =
          sectionResults.length > 0
            ? sectionResults.map((s) => {
                const status = s.status === 'passed' ? '✅ Passed' : '❌ Failed';
                const details = s.status === 'failed' && s.error ? escapeMd(s.error) : s.status === 'passed' ? 'No issues found' : '-';
                return `| ${s.name} | ${status} | ${details} |`;
              })
            : allSectionNames.map((name) => {
                const status = c365Entry.status === 'passed' ? '✅ Passed' : '❌ Failed';
                const details = c365Entry.status === 'passed' ? 'No issues found' : escapeMd(c365Entry.error || '-');
                return `| ${name} | ${status} | ${details} |`;
              });

        let countryPagination404Lines: string[] = [];
        const pagination404Attachment = c365Entry.attachments?.find((a) => a.name === 'cricket365-country-pagination-404.json');
        if (pagination404Attachment?.body) {
          try {
            const raw = typeof pagination404Attachment.body === 'string' ? pagination404Attachment.body : pagination404Attachment.body.toString('utf8');
            const affected: Array<{ countryName: string; countryUrl: string; page2Url: string; status?: number }> = JSON.parse(raw);
            if (Array.isArray(affected) && affected.length > 0) {
              countryPagination404Lines = [
                '',
                '### Country pagination 404 – affected URLs',
                '',
                '| Country | Country page | Page 2 URL | HTTP status |',
                '|---------|--------------|------------|-------------|',
                ...affected.map(
                  (a) =>
                    `| ${escapeMd(a.countryName)} | ${escapeMd(a.countryUrl)} | ${escapeMd(a.page2Url)} | ${a.status ?? '—'} |`
                ),
                '',
              ];
            }
          } catch {
            // ignore parse errors
          }
        }

        const summaryLines = [
          '# Cricket365 Test Summary Report',
          '',
          `**Generated:** ${new Date().toISOString()}`,
          `**Status:** ${c365Failed === 0 ? 'All passed' : `${c365Failed} failed`}`,
          `**Passed:** ${c365Passed} | **Failed:** ${c365Failed} | **Skipped:** ${c365Skipped} | **Total:** ${cricket365Entries.length}`,
          `**Duration:** ${((c365Entry.duration ?? 0) / 1000).toFixed(1)}s`,
          '',
          '## Results by section',
          '',
          '| Section | Result | Details |',
          '|---------|--------|---------|',
          ...sectionTableRows,
          ...countryPagination404Lines,
          '',
          '## Test result',
          '',
          `- ${c365Entry.status === 'passed' ? '✅ Passed' : c365Entry.status === 'failed' || c365Entry.status === 'timedOut' ? '❌ Failed' : '⏭️ Skipped'} **${escapeMd(c365Entry.title)}** (${((c365Entry.duration ?? 0) / 1000).toFixed(1)}s)`,
          '',
        ];
        if (c365Failures.length > 0 && (c365Entry.errorFull || c365Entry.error)) {
          summaryLines.push('## Failures', '');
          summaryLines.push(`### ${escapeMd(c365Entry.title)}`);
          summaryLines.push('');
          summaryLines.push('```');
          summaryLines.push((c365Entry.errorFull || c365Entry.error || 'No message').replace(/```/g, '`​`​`'));
          summaryLines.push('```');
          summaryLines.push('');
        }
        summaryLines.push('---', '', `**Report path (for sending):** \`${path.resolve(summaryPath)}\``);
        fs.writeFileSync(summaryPath, summaryLines.join('\n'), 'utf8');
        console.log('📋 Cricket365 summary report written to: test-results/Cricket365_Test_Summary_Report.md');
      }
    } catch (e) {
      console.warn('DetailedRunReporter: could not write report', e);
    }
  }
}

export default DetailedRunReporter;
