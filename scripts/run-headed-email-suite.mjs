#!/usr/bin/env node
/**
 * Run email-report specs with sensible defaults (fast + headless).
 *
 * Usage:
 *   node scripts/run-headed-email-suite.mjs                    # quick + headless (default)
 *   node scripts/run-headed-email-suite.mjs --headed           # quick + headed (visual check)
 *   node scripts/run-headed-email-suite.mjs --full             # no PLAYWRIGHT_QUICK (slow)
 *   node scripts/run-headed-email-suite.mjs --only planetf1,teamtalk
 *   node scripts/run-headed-email-suite.mjs --category="Website Content Tests"
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EMAIL_REPORT_SPECS } from "./list-email-report-specs.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const headed = args.includes("--headed");
const fullRun = args.includes("--full");
const onlyFilter = args.find((a) => a.startsWith("--only="))?.slice("--only=".length)?.split(",") ?? null;
const categoryFilter =
  args.find((a) => a.startsWith("--category="))?.slice("--category=".length) ?? null;

const PER_SPEC_TIMEOUT_MS = headed
  ? parseInt(process.env.SUITE_HEADED_SPEC_TIMEOUT_MS || "480000", 10)
  : parseInt(process.env.SUITE_SPEC_TIMEOUT_MS || "420000", 10);

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
  const reportPath = path.join(root, "test-results", "email-report.json");
  if (fs.existsSync(reportPath)) fs.unlinkSync(reportPath);

  const env = {
    ...process.env,
    FORCE_COLOR: "0",
    PLAYWRIGHT_EMAIL_SUITE: "1",
    ...(fullRun ? {} : { PLAYWRIGHT_QUICK: "1" }),
    ...(headed ? { PLAYWRIGHT_HEADLESS: "false" } : {}),
    // Cap heavy specs in suite mode
    MAX_TEAMS: process.env.MAX_TEAMS || (fullRun ? "16" : "3"),
    F365_TEST_TIMEOUT_MS: process.env.F365_TEST_TIMEOUT_MS || (fullRun ? "3600000" : "480000"),
    F365_AUDIT_MAX_LINKS: process.env.F365_AUDIT_MAX_LINKS || (fullRun ? "8" : "4"),
    MAX_NEWS_ARTICLES: process.env.MAX_NEWS_ARTICLES || (fullRun ? "2" : "1"),
    PR_TEAMS_MAX: process.env.PR_TEAMS_MAX || (fullRun ? "16" : "2"),
  };

  const playwrightArgs = ["playwright", "test", row.spec, "--project", row.project];
  if (headed) playwrightArgs.push("--headed");

  return new Promise((resolve) => {
    const child = spawn("npx", playwrightArgs, {
      cwd: root,
      env,
      stdio: "pipe",
      detached: process.platform !== "win32",
    });

    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d) => { stdout += d; });
    child.stderr?.on("data", (d) => { stderr += d; });

    const killTree = (signal) => {
      if (!child.pid) return;
      try {
        if (process.platform !== "win32") process.kill(-child.pid, signal);
        else child.kill(signal);
      } catch {
        child.kill(signal);
      }
    };

    const timer = setTimeout(() => {
      killTree("SIGTERM");
      setTimeout(() => killTree("SIGKILL"), 5000);
    }, PER_SPEC_TIMEOUT_MS);

    child.on("close", (code, signal) => {
      clearTimeout(timer);
      const minutes = ((Date.now() - started) / 60000).toFixed(2);
      const emailFailures = readEmailFailureCount();
      const timedOut = signal === "SIGTERM" || signal === "SIGKILL";
      const exitCode = timedOut ? 124 : (code ?? 1);
      const ok = !timedOut && exitCode === 0 && (emailFailures === null || emailFailures === 0);

      if (timedOut) {
        console.error(`  ⏱️ Spec exceeded ${(PER_SPEC_TIMEOUT_MS / 60000).toFixed(0)}m wall clock — killed`);
      } else if (exitCode !== 0 && stderr) {
        const tail = stderr.trim().split("\n").slice(-3).join(" ");
        if (tail) console.error(`  stderr: ${tail}`);
      }

      resolve({
        hubName: row.hubName,
        spec: row.spec,
        ok,
        exitCode,
        minutes,
        emailFailures,
        timedOut,
        mode: headed ? "headed" : "headless",
        quick: !fullRun,
      });
    });
  });
}

const specs = EMAIL_REPORT_SPECS.filter((row) => {
  if (categoryFilter && row.category !== categoryFilter) return false;
  if (!onlyFilter?.length) return true;
  const hay = `${row.hubName} ${row.spec}`.toLowerCase();
  return onlyFilter.some((f) => hay.includes(f.trim().toLowerCase()));
});

const modeLabel = `${headed ? "headed" : "headless"}${fullRun ? "" : " + quick"}`;
console.log(`\nRunning ${specs.length} email-report specs (${modeLabel}, ${PER_SPEC_TIMEOUT_MS / 60000}m cap/spec)…\n`);

const results = [];
for (const row of specs) {
  console.log(`▶ ${row.hubName} → ${row.spec}`);
  const r = await runSpec(row);
  results.push(r);
  console.log(
    `  ${r.ok ? "✓" : "✗"} ${r.minutes}m exit=${r.exitCode}${r.timedOut ? " (timeout)" : ""} emailFailures=${r.emailFailures ?? "n/a"}\n`,
  );
}

const passed = results.filter((r) => r.ok);
const failed = results.filter((r) => !r.ok);

const lines = [];
lines.push("# Email-report suite results\n");
lines.push(`Generated: ${new Date().toISOString()}\n`);
lines.push(`Mode: ${modeLabel}\n`);
lines.push(`Per-spec cap: ${PER_SPEC_TIMEOUT_MS / 60000} minutes\n`);
lines.push(`Passed: ${passed.length}/${results.length}\n`);
lines.push("\n| Hub name | Spec | Pass | Minutes | Exit | Email failures |");
lines.push("|----------|------|------|---------|------|----------------|");
for (const r of results) {
  lines.push(
    `| ${r.hubName} | \`${r.spec}\` | ${r.ok ? "yes" : "no"} | ${r.minutes} | ${r.exitCode}${r.timedOut ? " (timeout)" : ""} | ${r.emailFailures ?? "n/a"} |`,
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
