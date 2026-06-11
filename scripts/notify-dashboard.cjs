#!/usr/bin/env node
/**
 * POST Playwright run results to the PlanetSport Monitoring dashboard.
 *
 * Env:
 *   DASHBOARD_WEBHOOK_URL  e.g. https://your-host/api/public/webhooks/test-report
 *   DASHBOARD_WEBHOOK_SECRET (optional, same as GITHUB_WEBHOOK_SECRET on the dashboard)
 *
 * Usage:
 *   node scripts/notify-dashboard.cjs --site=PlanetF1 --report=test-results/email-report.json
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

  if (reportPath && fs.existsSync(reportPath)) {
    const data = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    siteName = data.siteName || siteName;
    failures = Array.isArray(data.failures) ? data.failures : [];
  }

  return { siteName, failures, reportPath };
}

async function main() {
  const url = (process.env.DASHBOARD_WEBHOOK_URL || '').trim();
  if (!url) {
    console.log('DASHBOARD_WEBHOOK_URL not set — skipping dashboard notification');
    return;
  }

  const { siteName, failures } = readReport();
  if (!siteName) {
    console.warn('No site name for dashboard notification');
    return;
  }

  const payload = JSON.stringify({
    siteName,
    failures,
    workflow_run_id: process.env.GITHUB_RUN_ID ? Number(process.env.GITHUB_RUN_ID) : undefined,
    workflow_file: process.env.GITHUB_WORKFLOW ? `${process.env.GITHUB_WORKFLOW}` : undefined,
    environment: process.env.GITHUB_REF_NAME || undefined,
  });

  const headers = { 'Content-Type': 'application/json' };
  const secret = (process.env.DASHBOARD_WEBHOOK_SECRET || process.env.GITHUB_WEBHOOK_SECRET || '').trim();
  if (secret) {
    headers['x-dashboard-signature'] = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  const res = await fetch(url, { method: 'POST', headers, body: payload });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Dashboard webhook failed (${res.status}): ${text.slice(0, 300)}`);
  }
  console.log(`Dashboard notified for ${siteName}: ${text}`);
}

main().catch((err) => {
  console.error('notify-dashboard:', err.message);
  process.exit(1);
});
