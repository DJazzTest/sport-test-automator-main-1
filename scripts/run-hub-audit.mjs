#!/usr/bin/env node
/**
 * Run hub/email-report Playwright specs locally and build HUB_AUDIT_REPORT.md
 *
 * Usage:
 *   node scripts/run-hub-audit.mjs --batch=a
 *   node scripts/run-hub-audit.mjs --batch=b
 *   node scripts/run-hub-audit.mjs --batch=c
 *   node scripts/run-hub-audit.mjs --batch=all
 *   node scripts/run-hub-audit.mjs --hub=TeamTalk
 *   node scripts/run-hub-audit.mjs --report-only
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EMAIL_REPORT_SPECS } from "./list-email-report-specs.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const playwrightBin = path.join(root, "node_modules", ".bin", "playwright");
const auditRoot = path.join(root, "hub-audit");
const reportPath = path.join(auditRoot, "HUB_AUDIT_REPORT.md");
const emailReportPath = path.join(root, "test-results", "email-report.json");
const summaryPath = path.join(auditRoot, "summary.json");

const args = process.argv.slice(2);
const batchArg = args.find((a) => a.startsWith("--batch="))?.split("=")[1] ?? "a";
const hubArg = args.find((a) => a.startsWith("--hub="))?.split("=")[1];
const reportOnly = args.includes("--report-only");

const BATCH_A = "Website Content Tests";
const BATCH_B = "Live Centre & Live Score Tests";
const BATCH_C = "Sports Animation Tests";

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function envForSpec(row) {
  const env = { ...process.env };
  env.PLAYWRIGHT_QUICK = env.PLAYWRIGHT_QUICK ?? "1";

  if (row.hubName === "TeamTalk Teams" || row.hubName === "PlanetRugby Teams") {
    env.MAX_TEAMS = env.MAX_TEAMS ?? "4";
  }
  if (row.hubName === "TeamTalk") {
    env.MAX_TRANSFER_ARTICLES = env.MAX_TRANSFER_ARTICLES ?? "2";
  }
  if (row.hubName === "Football365") {
    env.FOOTBALL365_TEST_TIMEOUT_MS = env.FOOTBALL365_TEST_TIMEOUT_MS ?? "900000";
  }
  if (row.hubName === "PlanetF1") {
    env.PLAYWRIGHT_QUICK = "1";
  }

  return env;
}

function filterSpecs() {
  if (hubArg) {
    const match = EMAIL_REPORT_SPECS.filter(
      (r) => r.hubName.toLowerCase() === hubArg.toLowerCase(),
    );
    if (!match.length) {
      console.error(`No hub named "${hubArg}"`);
      process.exit(1);
    }
    return match;
  }

  if (batchArg === "all") return EMAIL_REPORT_SPECS;
  if (batchArg === "a") return EMAIL_REPORT_SPECS.filter((r) => r.category === BATCH_A);
  if (batchArg === "b") return EMAIL_REPORT_SPECS.filter((r) => r.category === BATCH_B);
  if (batchArg === "c") return EMAIL_REPORT_SPECS.filter((r) => r.category === BATCH_C);

  console.error(`Unknown batch "${batchArg}". Use a, b, c, or all.`);
  process.exit(1);
}

function readJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function extractPlaywrightStatus(log) {
  const passed = /\b(\d+)\s+passed\b/.exec(log);
  const failed = /\b(\d+)\s+failed\b/.exec(log);
  const timedOut = /\b(\d+)\s+timed out\b/.exec(log);
  if (failed && Number(failed[1]) > 0) return "failed";
  if (timedOut && Number(timedOut[1]) > 0) return "timedOut";
  if (passed && Number(passed[1]) > 0) return "passed";
  return "unknown";
}

function extractFailuresFromLog(log) {
  const lines = log.split("\n");
  const failures = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 12) continue;
    if (/✅|No broken links detected|No broken images|passed in|^\d+ passed/i.test(trimmed)) continue;
    if (
      /Broken image:|Broken URL:|No ads detected:|stale articles|problematic links|\[404\]|\[40[0-9]\]|❌/i.test(
        trimmed,
      ) &&
      !/Checking|discovered|Ad containers found|Checks per section/i.test(trimmed)
    ) {
      failures.push(trimmed);
    }
  }
  return [...new Set(failures)].slice(0, 50);
}

function runSpec(row) {
  const slug = slugify(row.hubName);
  const hubDir = path.join(auditRoot, slug);
  fs.mkdirSync(hubDir, { recursive: true });

  const specPath = path.join(root, row.spec);
  if (!fs.existsSync(specPath)) {
    const result = {
      hubName: row.hubName,
      spec: row.spec,
      category: row.category,
      status: "missing",
      exitCode: 1,
      durationMs: 0,
      emailFailures: [],
      logFailures: [],
      error: "Spec file not found on disk",
    };
    fs.writeFileSync(path.join(hubDir, "result.json"), JSON.stringify(result, null, 2));
    return result;
  }

  if (fs.existsSync(emailReportPath)) {
    fs.unlinkSync(emailReportPath);
  }

  const logFile = path.join(hubDir, "run.log");
  const started = Date.now();
  console.log(`\n▶ ${row.hubName} (${row.spec})`);

  const env = envForSpec(row);
  if (!fs.existsSync(playwrightBin)) {
    const err = `Playwright not found at ${playwrightBin}. Run npm install first.`;
    fs.writeFileSync(logFile, err);
    return {
      hubName: row.hubName,
      spec: row.spec,
      category: row.category,
      status: "failed",
      exitCode: 1,
      durationMs: Date.now() - started,
      emailFailures: [],
      logFailures: [err],
      emailFailureCount: 0,
      error: err,
    };
  }

  const child = spawnSync(playwrightBin, ["test", row.spec, "--reporter=list"], {
    cwd: root,
    env,
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
  });

  const durationMs = Date.now() - started;
  const combined = `${child.stdout || ""}\n${child.stderr || ""}`;
  fs.writeFileSync(logFile, combined);

  let emailFailures = [];
  if (fs.existsSync(emailReportPath)) {
    fs.copyFileSync(emailReportPath, path.join(hubDir, "email-report.json"));
    const report = readJsonSafe(emailReportPath);
    if (Array.isArray(report?.failures)) emailFailures = report.failures;
  }

  const logFailures = extractFailuresFromLog(combined);
  const status = child.status !== 0 ? "failed" : extractPlaywrightStatus(combined);

  const result = {
    hubName: row.hubName,
    spec: row.spec,
    category: row.category,
    writesEmailReport: row.writesEmailReport,
    status,
    exitCode: child.status ?? 1,
    durationMs,
    emailFailures,
    logFailures,
    emailFailureCount: emailFailures.length,
  };

  fs.writeFileSync(path.join(hubDir, "result.json"), JSON.stringify(result, null, 2));
  console.log(
    `  ${status} in ${(durationMs / 1000).toFixed(1)}s — email failures: ${emailFailures.length}`,
  );
  return result;
}

function loadAllResults() {
  const results = [];
  for (const row of EMAIL_REPORT_SPECS) {
    const resultFile = path.join(auditRoot, slugify(row.hubName), "result.json");
    if (fs.existsSync(resultFile)) {
      results.push(readJsonSafe(resultFile));
    }
  }
  return results.filter(Boolean);
}

function guessVerifySteps(failure, hubName) {
  if (/Broken image:/i.test(failure)) {
    const parts = failure.split("|");
    const section = parts[0]?.replace(/^Broken image:\s*/i, "") || hubName;
    const url = parts[1]?.trim() || "";
    return `Open section "${section}" → scroll full page → inspect image URL ${url || "(see log)"}`;
  }
  if (/Steps:/i.test(failure)) return failure.replace(/^.*Steps:\s*/i, "");
  if (/No ads detected/i.test(failure)) return failure;
  if (/stale/i.test(failure)) return `Open hub page for ${hubName} → check article dates in main content`;
  if (/404|broken link/i.test(failure)) return `Open page from log → follow link → confirm HTTP status`;
  return `Review failure in hub run.log and reproduce manually on ${hubName}`;
}

function writeReport(results) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  const lines = [];
  lines.push("# Hub audit report");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Repo: ${root}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| Hub | Playwright | Duration | Email failures | Spec |");
  lines.push("|-----|------------|----------|----------------|------|");

  for (const r of results) {
    const dur = r.durationMs ? `${(r.durationMs / 1000).toFixed(0)}s` : "—";
    lines.push(
      `| ${r.hubName} | ${r.status} | ${dur} | ${r.emailFailureCount ?? r.emailFailures?.length ?? 0} | \`${r.spec}\` |`,
    );
  }

  lines.push("");
  lines.push("## Failures to verify");
  lines.push("");
  lines.push("Mark each row: **Real** | **False positive** | **Flaky** | **Unclear**");
  lines.push("");

  for (const r of results) {
    const failures = [
      ...(r.emailFailures || []),
      ...(r.logFailures || []).filter((f) => !(r.emailFailures || []).includes(f)),
    ];
    if (!failures.length && r.status === "passed") continue;

    lines.push(`### ${r.hubName}`);
    lines.push("");
    lines.push(`- Spec: \`${r.spec}\``);
    lines.push(`- Playwright: **${r.status}**`);
    lines.push(`- Log: \`hub-audit/${slugify(r.hubName)}/run.log\``);
    lines.push("");

    if (!failures.length) {
      lines.push("_No email/log failures captured (check Playwright assertion failures in run.log)._");
      lines.push("");
      continue;
    }

    lines.push("| # | Failure | Steps to verify | Verdict |");
    lines.push("|---|---------|-----------------|---------|");
    failures.slice(0, 40).forEach((f, i) => {
      const steps = guessVerifySteps(f, r.hubName).replace(/\|/g, "\\|");
      const cell = f.replace(/\|/g, "\\|").slice(0, 200);
      lines.push(`| ${i + 1} | ${cell} | ${steps.slice(0, 180)} | _pending_ |`);
    });
    lines.push("");
  }

  fs.writeFileSync(reportPath, lines.join("\n"));
  fs.writeFileSync(summaryPath, JSON.stringify(results, null, 2));
  console.log(`\nWrote ${reportPath}`);
}

function main() {
  fs.mkdirSync(auditRoot, { recursive: true });

  if (reportOnly) {
    writeReport(loadAllResults());
    return;
  }

  const specs = filterSpecs();
  console.log(`Hub audit batch=${batchArg} — ${specs.length} spec(s)`);

  const results = [];
  const existing = loadAllResults();
  const existingByHub = new Map(existing.map((r) => [r.hubName, r]));

  for (const row of specs) {
    const result = runSpec(row);
    results.push(result);
    existingByHub.set(row.hubName, result);
  }

  writeReport([...existingByHub.values()]);
}

main();
