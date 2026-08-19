#!/usr/bin/env node
/** @deprecated Use scripts/sync-email-report-job-failure.cjs --site=Betwright */
if (!process.argv.some((a) => a.startsWith('--site='))) {
  process.argv.push('--site=Betwright');
}
require('./sync-email-report-job-failure.cjs');
