#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import {
  loadConfigAndEnv,
  remoteWriteFromPromFile,
} from "./lib/grafana-remote-write.mjs";

const metricsFile =
  process.env.GRAFANA_METRICS_FILE ||
  path.join("test-results", "grafana-metrics.prom");

loadConfigAndEnv();

if (!fs.existsSync(metricsFile)) {
  console.error(`Metrics file not found: ${metricsFile}`);
  console.error("Run tests first: npm run test:grafana");
  process.exit(1);
}

try {
  const { seriesCount } = await remoteWriteFromPromFile(metricsFile);
  console.log(`Pushed ${seriesCount} series via remote_write`);
} catch (error) {
  console.error(error.message);
  if (!String(error.message).includes("HTTP ")) {
    console.error("");
    console.error("Set in .env or environment:");
    console.error("  GRAFANA_CLOUD_REMOTE_WRITE_URL  (must end /api/prom/push)");
    console.error("  GRAFANA_CLOUD_METRICS_INSTANCE_ID  (numbers only)");
    console.error("  GRAFANA_CLOUD_API_TOKEN  (glsa_...)");
  }
  process.exit(1);
}
