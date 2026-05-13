#!/usr/bin/env node
/**
 * When the Betwright GitHub job failed but test-results/email-report.json is missing
 * or has an empty failures array, write a fallback row so email-report.cjs does not send
 * a false "all passed" message (e.g. test threw before specs wrote email-report.json).
 */
const fs = require('fs');
const path = require('path');

const SITE = 'Betwright';
const reportDir = path.join(process.cwd(), 'test-results');
const reportPath = path.join(reportDir, 'email-report.json');
const junitPath = path.join(reportDir, 'junit.xml');

const FALLBACK =
  'Betwright: Playwright run failed – see GitHub Actions logs and test-results / test-results-html artifacts. No rows were present in email-report.json (test may have aborted before animation or link details were recorded).';

function junitIndicatesFailure() {
  try {
    if (!fs.existsSync(junitPath)) return false;
    const xml = fs.readFileSync(junitPath, 'utf8');
    if (/<failure[\s>]/i.test(xml) || /<error[\s>]/i.test(xml)) return true;
    const m = xml.match(/<testsuites[^>]*\bfailures="(\d+)"/i);
    if (m && parseInt(m[1], 10) > 0) return true;
    return false;
  } catch {
    return false;
  }
}

function readFailures() {
  try {
    if (!fs.existsSync(reportPath)) return null;
    const data = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    if (data.siteName !== SITE || !Array.isArray(data.failures)) return null;
    return data.failures;
  } catch {
    return null;
  }
}

function writeFailures(failures) {
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({ siteName: SITE, failures }, null, 0));
}

const existing = readFailures();
const hasDetails = existing && existing.length > 0;

if (hasDetails) {
  console.log('Betwright email-report.json already has failure details; no sync needed.');
  process.exit(0);
}

if (!junitIndicatesFailure()) {
  console.log('JUnit does not report failures; skipping Betwright email fallback.');
  process.exit(0);
}

const merged = Array.from(new Set([...(existing || []), FALLBACK]));
writeFailures(merged);
console.log('Betwright email-report.json updated with fallback failure row for failed CI run.');
