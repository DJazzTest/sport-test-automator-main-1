#!/usr/bin/env node
/**
 * When a Playwright CI job failed but test-results/email-report.json is missing
 * or has an empty failures array, write fallback rows so email-report.cjs can notify.
 *
 * Usage:
 *   node scripts/sync-email-report-job-failure.cjs --site=StarSports
 *   node scripts/sync-email-report-job-failure.cjs --site=Betwright --report=test-results/email-report.json
 */
const fs = require('fs');
const path = require('path');

function arg(name, fallback = '') {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const siteName = arg('site') || process.env.TEST_SITE_NAME || '';
const reportPath = path.resolve(process.cwd(), arg('report', 'test-results/email-report.json'));
const junitPath = path.join(process.cwd(), 'test-results', 'junit.xml');

if (!siteName) {
  console.warn('sync-email-report-job-failure: --site= required');
  process.exit(0);
}

function junitIndicatesFailure() {
  try {
    if (!fs.existsSync(junitPath)) return false;
    const xml = fs.readFileSync(junitPath, 'utf8');
    if (/<failure[\s>]/i.test(xml) || /<error[\s>]/i.test(xml)) return true;
    const m = xml.match(/<testsuites[^>]*\bfailures="(\d+)"/i);
    if (m && parseInt(m[1], 10) > 0) return true;
    const m2 = xml.match(/<testsuite[^>]*\bfailures="(\d+)"/i);
    if (m2 && parseInt(m2[1], 10) > 0) return true;
    return false;
  } catch {
    return false;
  }
}

function junitFailureSnippets(max = 5) {
  try {
    if (!fs.existsSync(junitPath)) return [];
    const xml = fs.readFileSync(junitPath, 'utf8');
    const snippets = [];
    const re = /<(?:failure|error)[^>]*>([\s\S]*?)<\/(?:failure|error)>/gi;
    let m;
    while ((m = re.exec(xml)) && snippets.length < max) {
      const text = m[1]
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 400);
      if (text) snippets.push(text);
    }
    return snippets;
  } catch {
    return [];
  }
}

function readReport() {
  try {
    if (!fs.existsSync(reportPath)) return null;
    return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  } catch {
    return null;
  }
}

function writeFailures(failures) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({ siteName, failures }, null, 0));
}

const report = readReport();
const existing = Array.isArray(report?.failures) ? report.failures : [];
const sameSite = !report?.siteName || report.siteName === siteName || report.siteName === 'Multi-site CI';

if (existing.length > 0 && sameSite) {
  console.log(`${siteName}: email-report.json already has ${existing.length} failure(s); no sync needed.`);
  process.exit(0);
}

if (!junitIndicatesFailure()) {
  console.log(`${siteName}: JUnit does not report failures; skipping email fallback.`);
  process.exit(0);
}

const snippets = junitFailureSnippets();
const fallback = snippets.length
  ? snippets.map((s, i) => `${siteName}: Playwright failure ${i + 1} — ${s}`)
  : [
      `${siteName}: Playwright run failed — see GitHub Actions logs and test-results / test-results-html artifacts. No rows were present in email-report.json (test may have aborted before details were recorded).`,
    ];

const merged = [...new Set([...existing, ...fallback])];
writeFailures(merged);
console.log(`${siteName}: email-report.json updated with ${merged.length} fallback failure row(s).`);
