#!/usr/bin/env node
/**
 * POST Playwright run results to the PlanetSport Monitoring dashboard.
 * Never fails the CI job — hub polling is the fallback when webhooks are unreachable.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function readReport(siteArg, reportArg) {
  const siteFromFlag = process.argv.find((a) => a.startsWith('--site='))?.replace('--site=', '') ?? siteArg ?? '';
  const reportFromFlag = process.argv.find((a) => a.startsWith('--report='))?.replace('--report=', '');
  const reportPath = reportFromFlag || reportArg || path.join(process.cwd(), 'test-results', 'email-report.json');

  let siteName = siteFromFlag;
  let failures = [];
  let checks = [];

  if (reportPath && fs.existsSync(reportPath)) {
    const data = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    siteName = data.siteName || siteName;
    failures = Array.isArray(data.failures) ? data.failures : [];
    checks = Array.isArray(data.checks) ? data.checks : [];
  }

  return { siteName, failures, checks, reportPath };
}

async function main() {
  const url = (process.env.DASHBOARD_WEBHOOK_URL || '').trim();
  if (!url) {
    console.log('DASHBOARD_WEBHOOK_URL not set — skipping dashboard notification');
    return;
  }

  const { siteName, failures, checks } = readReport();
  if (!siteName) {
    console.warn('No site name for dashboard notification');
    return;
  }

  const payload = JSON.stringify({
    siteName,
    failures,
    checks: checks.length ? checks : undefined,
    workflow_run_id: process.env.GITHUB_RUN_ID ? Number(process.env.GITHUB_RUN_ID) : undefined,
    workflow_file: process.env.GITHUB_WORKFLOW ? `${process.env.GITHUB_WORKFLOW}` : undefined,
    environment: process.env.GITHUB_REF_NAME || undefined,
  });

  const headers = { 'Content-Type': 'application/json' };
  const secret = (process.env.DASHBOARD_WEBHOOK_SECRET || process.env.GITHUB_WEBHOOK_SECRET || '').trim();
  if (secret) {
    headers['x-dashboard-signature'] = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  try {
    const res = await fetch(url, { method: 'POST', headers, body: payload });
    const text = await res.text();
    if (!res.ok) {
      console.warn(`Dashboard webhook failed (${res.status}): ${text.slice(0, 300)} — hub will sync via polling`);
      return;
    }
    console.log(`Dashboard notified for ${siteName}: ${text}`);
  } catch (err) {
    console.warn('notify-dashboard: fetch failed — hub will sync via polling:', err.message);
  }
}

main().catch((err) => {
  console.warn('notify-dashboard:', err.message);
});
