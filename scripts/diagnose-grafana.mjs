#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import {
  getGrafanaCloudConfig,
  loadConfigAndEnv,
  remoteWriteFromPromFile,
  validateGrafanaCloudConfig,
  validateNodeRuntime,
} from "./lib/grafana-remote-write.mjs";

const promFile = path.join("test-results", "grafana-metrics.prom");
const envFile = path.join(".env");

console.log("Grafana Cloud diagnostics (davidjarrett001)\n");

loadConfigAndEnv();
const url = process.env.GRAFANA_CLOUD_REMOTE_WRITE_URL?.trim();
const instanceId = (
  process.env.GRAFANA_CLOUD_METRICS_INSTANCE_ID ||
  process.env.GRAFANA_CLOUD_USERNAME ||
  ""
).trim();
const token = (
  process.env.GRAFANA_CLOUD_API_TOKEN ||
  process.env.GRAFANA_CLOUD_PASSWORD ||
  ""
).trim();
const config = getGrafanaCloudConfig();

console.log("1. Credentials");
if (fs.existsSync(envFile)) {
  console.log("   .env file: found");
} else {
  console.log("   .env file: MISSING ← metrics are never pushed without this");
}
console.log(`   GRAFANA_CLOUD_REMOTE_WRITE_URL: ${url ? "set" : "NOT SET"}`);
console.log(
  `   GRAFANA_CLOUD_METRICS_INSTANCE_ID: ${instanceId ? "set" : "NOT SET"}`
);
console.log(
  `   GRAFANA_CLOUD_API_TOKEN: ${token ? "set (hidden)" : "EMPTY ← this is why Grafana has no data"}`
);

console.log("\n2. Local metrics file");
if (fs.existsSync(promFile)) {
  const lines = fs
    .readFileSync(promFile, "utf8")
    .split("\n")
    .filter((l) => l.startsWith("sport_e2e"));
  console.log(`   ${promFile}: ${lines.length} series ready to push`);
} else {
  console.log(`   ${promFile}: MISSING — run: npm run test:grafana`);
}

console.log("\n3. CI");
const ghWorkflow = ".github/workflows/grafana-e2e.yml";
console.log(
  `   ${ghWorkflow}: ${fs.existsSync(ghWorkflow) ? "present locally" : "missing"}`
);
console.log(
  "   GitHub/CircleCI secrets: must match .env (check repo settings — not readable from here)"
);

if (!config) {
  console.log("\n❌ BLOCKER: credentials incomplete — nothing has been pushed to Grafana.");
  if (!token) {
    console.log("\n   Add your API token to .env line 4:");
    console.log("   GRAFANA_CLOUD_API_TOKEN=glc_...");
    console.log("\n   Create token: grafana.com/orgs/davidjarrett001/access-policies");
    console.log("   → open policy → Add token → scope: metrics:write");
  }
  process.exit(1);
}

try {
  validateNodeRuntime();
  validateGrafanaCloudConfig(config);
} catch (error) {
  console.log(`\n❌ Config invalid: ${error.message}`);
  process.exit(1);
}

if (!fs.existsSync(promFile)) {
  console.log("\n⚠️  Credentials OK but no metrics file. Run: npm run test:grafana");
  process.exit(1);
}

console.log("\n4. Attempting remote_write...");
try {
  const { seriesCount } = await remoteWriteFromPromFile(promFile, config);
  console.log(`   ✓ Pushed ${seriesCount} series successfully`);
  console.log("\n5. Verify in Grafana");
  console.log("   Explore → grafanacloud-prom → {__name__=~\"sport_e2e_.*\"}");
  console.log("   Time range: Last 15 minutes");
  console.log(
    "   Dashboard: https://davidjarrett001.grafana.net/d/sport-test-automator/sport-test-automator-teamtalk-and-planetf1"
  );
  console.log(
    "\n   If Explore has data but dashboard does not: Connections → Data sources → copy Prometheus UID"
  );
  console.log("   and update grafana/dashboards/sport-test-automator.json if UID ≠ grafanacloud-prom");
} catch (error) {
  console.log(`   ✗ Push failed: ${error.message}`);
  process.exit(1);
}
