#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { pushTimeseries } from "prometheus-remote-write";

const root = process.cwd();
const envPath = path.join(root, ".env");
const metricsFile = path.join(root, "test-results", "grafana-metrics.prom");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return Object.fromEntries(
    fs
      .readFileSync(filePath, "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      })
  );
}

function saveEnvFile(filePath, values) {
  const content = `# Grafana Cloud — davidjarrett001
# Dashboard: https://davidjarrett001.grafana.net/d/sport-test-automator/sport-test-automator-teamtalk-and-planetf1

GRAFANA_CLOUD_REMOTE_WRITE_URL=${values.GRAFANA_CLOUD_REMOTE_WRITE_URL}
GRAFANA_CLOUD_METRICS_INSTANCE_ID=${values.GRAFANA_CLOUD_METRICS_INSTANCE_ID}
GRAFANA_CLOUD_API_TOKEN=${values.GRAFANA_CLOUD_API_TOKEN}
PROMETHEUS_JOB_NAME=sport-test-automator
PROMETHEUS_INSTANCE=local
`;

  fs.writeFileSync(filePath, content);
}

function parsePrometheusLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const match = trimmed.match(/^([a-zA-Z_:][\w:]*)(\{.*\})?\s+(-?\d+(?:\.\d+)?)$/);
  if (!match) {
    return null;
  }

  const [, name, rawLabels = "", value] = match;
  const labels = { __name__: name };

  if (rawLabels) {
    const labelBody = rawLabels.slice(1, -1);
    const labelPattern = /([a-zA-Z_][\w]*)="((?:\\.|[^"\\])*)"/g;
    let labelMatch;
    while ((labelMatch = labelPattern.exec(labelBody)) !== null) {
      labels[labelMatch[1]] = labelMatch[2].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    }
  }

  return { labels, value: Number(value) };
}

async function pushMetrics(env) {
  const body = fs.readFileSync(metricsFile, "utf8");
  const timeseries = body
    .split("\n")
    .map(parsePrometheusLine)
    .filter(Boolean)
    .map((series) => ({
      labels: series.labels,
      samples: [{ value: series.value, timestamp: Date.now() }],
    }));

  const result = await pushTimeseries(timeseries, {
    url: env.GRAFANA_CLOUD_REMOTE_WRITE_URL,
    auth: {
      username: env.GRAFANA_CLOUD_METRICS_INSTANCE_ID,
      password: env.GRAFANA_CLOUD_API_TOKEN,
    },
    labels: {
      job: env.PROMETHEUS_JOB_NAME || "sport-test-automator",
      instance: env.PROMETHEUS_INSTANCE || "local",
    },
    verbose: true,
  });

  if (result.status < 200 || result.status >= 300) {
    throw new Error(
      `Push failed (${result.status}): ${result.statusText || result.errorMessage || "unknown error"}`
    );
  }

  return timeseries.length;
}

async function promptForCredentials(existing = {}) {
  const rl = readline.createInterface({ input, output });
  console.log("\nGrafana Cloud credentials (from grafana.com/orgs/davidjarrett001 → stack → Prometheus → Details)\n");

  const remoteWriteUrl = await rl.question(
    `Remote write URL${existing.GRAFANA_CLOUD_REMOTE_WRITE_URL ? ` [${existing.GRAFANA_CLOUD_REMOTE_WRITE_URL}]` : ""}: `
  );
  const instanceId = await rl.question(
    `Metrics instance ID (numeric User)${existing.GRAFANA_CLOUD_METRICS_INSTANCE_ID ? ` [${existing.GRAFANA_CLOUD_METRICS_INSTANCE_ID}]` : ""}: `
  );
  const apiToken = await rl.question(
    `API token (glsa_...)${existing.GRAFANA_CLOUD_API_TOKEN ? " [hidden, press Enter to keep]" : ""}: `
  );
  rl.close();

  return {
    GRAFANA_CLOUD_REMOTE_WRITE_URL:
      remoteWriteUrl.trim() || existing.GRAFANA_CLOUD_REMOTE_WRITE_URL || "",
    GRAFANA_CLOUD_METRICS_INSTANCE_ID:
      instanceId.trim() || existing.GRAFANA_CLOUD_METRICS_INSTANCE_ID || "",
    GRAFANA_CLOUD_API_TOKEN:
      apiToken.trim() || existing.GRAFANA_CLOUD_API_TOKEN || "",
    PROMETHEUS_JOB_NAME: "sport-test-automator",
    PROMETHEUS_INSTANCE: "local",
  };
}

function runTests() {
  console.log("\n▶ Running TeamTalk + PlanetF1 tests...\n");
  const result = spawnSync("npm", ["run", "test:grafana"], {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });

  if (!fs.existsSync(metricsFile)) {
    throw new Error("Tests did not produce test-results/grafana-metrics.prom");
  }

  return result.status ?? 1;
}

async function main() {
  console.log("Sport Test Automator → Grafana Cloud setup");
  console.log("Stack: davidjarrett001");

  let env = loadEnvFile(envPath);
  const missing =
    !env.GRAFANA_CLOUD_REMOTE_WRITE_URL ||
    !env.GRAFANA_CLOUD_METRICS_INSTANCE_ID ||
    !env.GRAFANA_CLOUD_API_TOKEN;

  if (missing) {
    if (!process.stdin.isTTY) {
      console.error("\nMissing .env credentials and no interactive terminal.");
      console.error("Create .env from .env.example with your Grafana Cloud Prometheus details.");
      process.exit(1);
    }

    env = await promptForCredentials(env);
    if (
      !env.GRAFANA_CLOUD_REMOTE_WRITE_URL ||
      !env.GRAFANA_CLOUD_METRICS_INSTANCE_ID ||
      !env.GRAFANA_CLOUD_API_TOKEN
    ) {
      console.error("\nAll three Grafana Cloud values are required.");
      process.exit(1);
    }

    saveEnvFile(envPath, env);
    console.log(`\n✓ Saved credentials to ${envPath}`);
  }

  const testStatus = runTests();
  const seriesCount = await pushMetrics(env);

  console.log(`\n✓ Pushed ${seriesCount} metric series to Grafana Cloud`);
  console.log("\nOpen your dashboard:");
  console.log(
    "https://davidjarrett001.grafana.net/d/sport-test-automator/sport-test-automator-teamtalk-and-planetf1"
  );
  console.log("\nIf panels still show No data:");
  console.log("1. Explore → grafanacloud-prom → {__name__=~\"sport_e2e_.*\"} (time range: Last 15 minutes)");
  console.log("2. Re-import grafana/dashboards/sport-test-automator.json if datasource UID changed");
  console.log(`\nTests finished with exit code ${testStatus} (metrics were still pushed).`);
}

main().catch((error) => {
  console.error(`\n✗ ${error.message}`);
  process.exit(1);
});
