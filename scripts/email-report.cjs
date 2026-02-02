#!/usr/bin/env node
/**
 * Reusable email report for Playwright test suites.
 * Sends a formatted email when a test run finishes (no failures vs failures).
 *
 * Usage:
 *   node scripts/email-report.cjs <siteName> [reportPath]
 *   Or: node scripts/email-report.cjs --site=PlanetF1 --report=test-results/email-report.json
 *
 * Report file format: { "siteName": "PlanetF1", "failures": ["desc1", "desc2"] }
 * If reportPath is provided and file exists, siteName and failures are read from file.
 * Otherwise siteName is first arg and failures are [].
 *
 * Env (from GitHub Actions secrets): SMTP_SERVER, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, ALERT_EMAIL_TO, ALERT_EMAIL_FROM
 */
const fs = require('fs');
const path = require('path');

const siteName = process.env.TEST_SITE_NAME || '';
const reportPath = process.env.TEST_EMAIL_REPORT_PATH || '';

function getReportFromArgs() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const reportFile = process.argv.find((a) => a.startsWith('--report='));
  const siteArg = process.argv.find((a) => a.startsWith('--site='));
  let site = siteArg ? siteArg.replace('--site=', '') : (args[0] || process.env.TEST_SITE_NAME || '');
  let failures = [];
  const defaultReportPath = path.join(process.cwd(), 'test-results', 'email-report.json');
  const reportPathToRead = reportFile ? reportFile.replace('--report=', '') : (reportPath || defaultReportPath);
  if (reportPathToRead && fs.existsSync(reportPathToRead)) {
    try {
      const data = JSON.parse(fs.readFileSync(reportPathToRead, 'utf8'));
      site = data.siteName || site;
      failures = Array.isArray(data.failures) ? data.failures : [];
    } catch (e) {
      console.warn('Could not read report file:', e.message);
    }
  } else if (args[0]) {
    site = args[0];
  }
  return { siteName: site, failures };
}

function buildSubjectAndBody(siteName, failures) {
  const hasFailures = failures.length > 0;
  const subject = hasFailures
    ? `${siteName} test completed – failures detected`
    : `${siteName} test completed – no failures`;
  let body = `✅ ${siteName} test finished completed\n`;
  if (hasFailures) {
    body += failures.map((f) => `❌ Broken URL or image link found:\n- ${f}`).join('\n');
  } else {
    body += '✅ No failures detected';
  }
  return { subject, body };
}

async function sendEmail(subject, body) {
  const server = process.env.SMTP_SERVER;
  const port = process.env.SMTP_PORT || '587';
  const user = process.env.SMTP_USERNAME;
  const pass = process.env.SMTP_PASSWORD;
  const to = process.env.ALERT_EMAIL_TO;
  const from = process.env.ALERT_EMAIL_FROM;
  console.log('SMTP env: SMTP_SERVER=' + (server ? 'set' : 'MISSING') + ', SMTP_USERNAME=' + (user ? 'set' : 'MISSING') + ', SMTP_PASSWORD=' + (pass ? 'set' : 'MISSING') + ', ALERT_EMAIL_TO=' + (to ? 'set' : 'MISSING') + ', ALERT_EMAIL_FROM=' + (from ? 'set' : 'MISSING'));
  if (!server || !user || !pass || !to || !from) {
    console.log('');
    console.log('⚠️  EMAIL NOT SENT: SMTP or alert email secrets are not set.');
    console.log('    To receive test report emails, add these repository secrets:');
    console.log('    Settings → Secrets and variables → Actions → New repository secret');
    console.log('    - SMTP_SERVER (e.g. smtp.gmail.com)');
    console.log('    - SMTP_PORT (e.g. 587)');
    console.log('    - SMTP_USERNAME');
    console.log('    - SMTP_PASSWORD (e.g. Gmail app password)');
    console.log('    - ALERT_EMAIL_TO (recipient address)');
    console.log('    - ALERT_EMAIL_FROM (sender address)');
    console.log('');
    return;
  }
  try {
    console.log('Loading nodemailer...');
    const nodemailer = require('nodemailer');
    console.log('Creating SMTP transporter...');
    const transporter = nodemailer.createTransport({
      host: server,
      port: parseInt(port, 10),
      secure: port === '465',
      auth: { user, pass },
    });
    await transporter.sendMail({
      from,
      to,
      subject,
      text: body,
    });
    console.log('Email sent successfully: ' + subject);
  } catch (e) {
    console.error('Failed to send email:', e.message);
    if (e.code) console.error('Error code:', e.code);
    throw e;
  }
}

async function main() {
  const { siteName: name, failures } = getReportFromArgs();
  if (!name) {
    console.warn('No site name; use --site=PlanetF1 or TEST_SITE_NAME');
    process.exit(0);
  }
  console.log(`Email report: site=${name}, failures=${failures.length}`);
  const { subject, body } = buildSubjectAndBody(name, failures);
  await sendEmail(subject, body);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
