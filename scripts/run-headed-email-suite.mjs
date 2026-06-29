#!/usr/bin/env node
/**
 * Run all email-report specs and write HEADED_EMAIL_SUITE_REPORT.md
 *
 * Usage:
 *   node scripts/run-headed-email-suite.mjs              # headed (default)
 *   node scripts/run-headed-email-suite.mjs --headless   # faster CI-style validation
 *   node scripts/run-headed-email-suite.mjs --only planetf1,teamtalk
 *   PLAYWRIGHT_QUICK=1 node scripts/run-headed-email-suite.mjs --headless
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EMAIL_REPORT_SPECS } from "./list-email-report-specs.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const headless = args.includes("--headless");
const onlyFilter = args.find((a) => a.startsWith("--only="))?.slice("--only=".length)?.split(",") ?? null;

function readEmailFailureCount() {
  const p = path.join(root, "test-results", "email-report.json");
  if (!fs.existsSync(p)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(p, "utf8"));
    return Array.isArray(data.failures) ? data.failures.length : 0;
  } catch {
    return null;
  }
}

function runSpec(row) {
  const started = Date.now();
  const playwrightArgs = ["playwright", "test", row.spec, "--project", row.project];
  if (!headless) {
    playwrightArgs.push("--headed");
    process.env.PLAYWRIGHT_HEADLESS = "false";
  }

  // Clean prior email report so failure count is per-spec
  const reportPath = path.join(root, "test-results", "email-report.json");
  if (fs.existsSync(reportPath)) fs.unlinkSync(reportPath);

  const outcome = spawnSync("npx", playwrightArgs, {
    cwd: root,
    stdio: "pipe",
    env: { ...process.env, FORCE_COLOR: "0" },
    encoding: "utf8",
  });

  const minutes = ((Date.now() - started) / 60000).toFixed(2);
  const emailFailures = readEmailFailureCount();
  const ok = outcome.status === 0 && (emailFailures === null || emailFailures === 0);

  return {
    hubName: row.hubName,
    spec: row.spec,
    ok,
    exitCode: outcome.status ?? 1,
    minutes,
    emailFailures,
    mode: headless ? "headless" : "headed",
  };
}

const specs = EMAIL_REPORT_SPECS.filter((row) => {
  if (!onlyFilter?.length) return true;
  const hay = `${row.hubName} ${row.spec}`.toLowerCase();
  return onlyFilter.some((f) => hay.includes(f.trim().toLowerCase()));
});

console.log(`\nRunning ${specs.length} email-report specs (${headless ? "headless" : "headed"})…\n`);

const results = [];
for (const row of specs) {
  console.log(`▶ ${row.hubName} → ${row.spec}`);
  const r = runSpec(row);
  results.push(r);
  console.log(`  ${r.ok ? "✓" : "✗"} ${r.minutes}m exit=${r.exitCode} emailFailures=${r.emailFailures ?? "n/a"}\n`);
}

const passed = results.filter((r) => r.ok);
const failed = results.filter((r) => !r.ok);

const lines = [];
lines.push("# Headed email-report suite results\n");
lines.push(`Generated: ${new Date().toISOString()}\n`);
lines.push(`Mode: ${headless ? "headless" : "headed"}\n`);
lines.push(`Passed: ${passed.length}/${results.length}\n`);
lines.push("\n| Hub name | Spec | Pass | Minutes | Exit | Email failures |");
lines.push("|----------|------|------|---------|------|----------------|");
for (const r of results) {
  lines.push(
    `| ${r.hubName} | \`${r.spec}\` | ${r.ok ? "yes" : "no"} | ${r.minutes} | ${r.exitCode} | ${r.emailFailures ?? "n/a"} |`,
  );
}

if (failed.length) {
  lines.push("\n## Failed specs\n");
  for (const r of failed) {
    lines.push(`- ${r.hubName} (\`${r.spec}\`) — exit ${r.exitCode}, emailFailures=${r.emailFailures ?? "n/a"}`);
  }
}

const outDir = path.join(root, "test-results");
fs.mkdirSync(outDir, { recursive: true });
const reportPath = path.join(outDir, "HEADED_EMAIL_SUITE_REPORT.md");
const jsonPath = path.join(outDir, "HEADED_EMAIL_SUITE_REPORT.json");
fs.writeFileSync(reportPath, lines.join("\n"));
fs.writeFileSync(jsonPath, JSON.stringify({ generated: new Date().toISOString(), results }, null, 2));

console.log(`\nWrote ${reportPath}`);
console.log(`${passed.length}/${results.length} passed.\n`);
process.exit(failed.length ? 1 : 0);
