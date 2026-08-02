#!/usr/bin/env node
/**
 * Reusable email report for Playwright test suites.
 *
 * Default: send only when failures are present (skips clean passes).
 * Exception: PlanetSports scheduled animation runs always email (pass or fail),
 * or pass --always / EMAIL_ALWAYS_SEND=1.
 *
 * Usage:
 *   node scripts/email-report.cjs --site=PlanetF1 --report=test-results/email-report.json
 *   node scripts/email-report.cjs --site=PlanetSports --report=test-results/email-report.json --always
 *
 * Report file format: { "siteName": "PlanetF1", "failures": ["desc1", "desc2"] }
 * If reportPath is provided and file exists, siteName and failures are read from file.
 * Otherwise siteName is first arg and failures are [].
 *
 * Env (from GitHub Actions secrets): SMTP_SERVER, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, ALERT_EMAIL_TO, ALERT_EMAIL_FROM
 * Optional: EMAIL_ALWAYS_SEND=1 to force send even with zero failures.
 */
const fs = require('fs');
const path = require('path');

const siteName = process.env.TEST_SITE_NAME || '';
const reportPath = process.env.TEST_EMAIL_REPORT_PATH || '';

/** Sites that should still email on clean passes (scheduled animation digests). */
const ALWAYS_SEND_SITES = [
  /^planetsports$/i,
  /^planetsport\s*bet/i,
  /planetsports?\s*(football|cricket|tennis|nfl|animation)/i,
];

function shouldAlwaysSend(site) {
  if (process.env.EMAIL_ALWAYS_SEND === '1') return true;
  if (process.argv.includes('--always')) return true;
  const name = String(site || '').trim();
  return ALWAYS_SEND_SITES.some((re) => re.test(name));
}

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

/** Prefer `section | https://...` form; for legacy `section>url>url` take the last http(s) URL. */
function extractReportedUrl(detail) {
  const pipe = detail.match(/\|\s*(https?:\/\/[^\s|>]+)/i);
  if (pipe) return pipe[1].replace(/[),.;]+$/, '');
  const all = [...detail.matchAll(/https?:\/\/[^\s|>]+/gi)].map((m) => m[0]);
  if (all.length) return all[all.length - 1].replace(/[),.;]+$/, '');
  return '';
}

function buildSubjectAndBody(siteName, failures) {
  const hasFailures = failures.length > 0;
  const subject = hasFailures
    ? `${siteName} test completed – failures detected`
    : `${siteName} test completed – no failures`;
  let body = hasFailures
    ? `❌ ${siteName} test finished completed❌\n`
    : `✅ ${siteName} test finished completed\n`;
  if (hasFailures) {
    const classifyFailure = (failure) => {
      const lower = failure.toLowerCase();
      if (lower.startsWith('broken url:')) return { label: 'Broken URL', detail: failure.replace(/^Broken URL:\s*/i, '') };
      if (lower.startsWith('unreachable in test:')) return { label: 'Unreachable URL', detail: failure.replace(/^Unreachable in test:\s*/i, '') };
      if (lower.startsWith('broken image:') || lower.startsWith('brokenimage:')) return { label: 'Broken image', detail: failure.replace(/^Broken image:\s*/i, '').replace(/^BrokenImage:\s*/i, '') };
      if (lower.startsWith('stale content:') || lower.includes('top 2 articles older')) return { label: 'Stale content', detail: failure.replace(/^Stale content:\s*/i, '') };
      if (lower.startsWith('functional:')) return { label: 'Functional issue', detail: failure.replace(/^Functional:\s*/i, '') };
      if (lower.startsWith('no ads:') || lower.startsWith('noads:')) return { label: 'No ads', detail: failure.replace(/^No ads:\s*/i, '').replace(/^NoAds:\s*/i, '') };
      if (
        lower.startsWith('betwright ') &&
        (lower.includes('fail:') || lower.includes('animation'))
      ) {
        return { label: 'Animation / live widget', detail: failure };
      }
      return { label: 'Issue', detail: failure };
    };

    const buildManualSteps = (label, detail) => {
      const url = extractReportedUrl(detail);

      if (label === 'Broken URL' || label === 'Unreachable URL') {
        if (url) {
          return `1) Open the source section/page on ${siteName} 2) Click link ${url} 3) Expected: destination loads with content 4) Actual: request fails or returns error status`;
        }
        return `1) Open the referenced section/page on ${siteName} 2) Click the reported link 3) Expected: destination loads with content 4) Actual: request fails or returns error status`;
      }
      if (label === 'Broken image') {
        if (url) {
          return `1) Open the reported page/section 2) Inspect image ${url} 3) Expected: image renders 4) Actual: image missing/broken`;
        }
        return `1) Open the reported page/section 2) Locate the reported image slot 3) Expected: image renders 4) Actual: image missing/broken`;
      }
      if (label === 'Stale content') {
        const section = detail.split(':')[0];
        return `1) Open ${siteName} 2) Navigate to ${section} 3) Open the listed article(s) 4) Check published/updated date and confirm it is older than the threshold`;
      }
      if (label === 'Functional issue') {
        return `1) Open the affected page 2) Reproduce the user flow mentioned in the issue 3) Confirm expected section/data should be present 4) Verify actual missing/incorrect behavior`;
      }
      if (label === 'Animation / live widget') {
        return `1) Open betwright.com 2) Open the sport and tab (Today/Tomorrow) named in the line 3) Open the listed event 4) Expected: live animation iframe/SVG/YouTube tracker 5) Actual: missing or not loading`;
      }
      return `1) Open the affected page/section 2) Follow the reported flow 3) Compare expected vs actual behavior`;
    };

    const lines = [];
    for (let i = 0; i < failures.length; i++) {
      const failure = failures[i];
      if (/^steps:/i.test(failure)) continue;

      const { label, detail } = classifyFailure(failure);
      lines.push(`❌ ${label} detected:`);
      lines.push(`- ${detail}`);

      const next = failures[i + 1] || '';
      if (/^steps:/i.test(next)) {
        lines.push(`   ${next}`);
        i += 1;
      } else {
        lines.push(`   Steps: ${buildManualSteps(label, detail)}`);
      }
    }

    body += lines.join('\n');
  } else {
    body += '✅ No failures detected';
  }
  return { subject, body };
}

async function sendEmail(subject, body) {
  // Trim whitespace/newlines (GitHub Secrets can get a trailing newline when pasted)
  const server = (process.env.SMTP_SERVER || '').trim();
  const port = (process.env.SMTP_PORT || '587').trim();
  const user = (process.env.SMTP_USERNAME || '').trim();
  const pass = (process.env.SMTP_PASSWORD || '').trim();
  const to = (process.env.ALERT_EMAIL_TO || '').trim();
  const from = (process.env.ALERT_EMAIL_FROM || '').trim();
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
  const alwaysSend = shouldAlwaysSend(name);
  console.log(`Email report: site=${name}, failures=${failures.length}, alwaysSend=${alwaysSend}`);
  if (failures.length === 0 && !alwaysSend) {
    console.log('No failures detected — skipping email send (failures-only reporting).');
    return;
  }
  const { subject, body } = buildSubjectAndBody(name, failures);
  await sendEmail(subject, body);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
