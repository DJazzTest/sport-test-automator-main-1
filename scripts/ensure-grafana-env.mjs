#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { loadConfigAndEnv } from "./lib/grafana-remote-write.mjs";

const root = process.cwd();
const envPath = path.join(root, ".env");
const reporterPath = path.join(
  root,
  "tests/reporters/grafana-metrics-reporter.ts"
);
const documentsCopy = path.join(
  process.env.HOME || "",
  "Documents/sport-test-automator-main-1"
);

const issues = [];

if (!fs.existsSync(reporterPath)) {
  issues.push(
    "This folder has no Grafana metrics reporter (tests/reporters/grafana-metrics-reporter.ts)."
  );
  const cursorWorkspace = path.join(process.env.HOME || "", "sport-test-automator-main-1");
  if (path.resolve(root) === path.resolve(documentsCopy)) {
    issues.push(
      `This is the Documents copy (email tests only). Switch to the Grafana-enabled repo:\n  cd ${cursorWorkspace}`
    );
  } else if (fs.existsSync(path.join(documentsCopy, "package.json"))) {
    issues.push(
      `If you also use ~/Documents/sport-test-automator-main-1 — that folder cannot push to Grafana.`
    );
  }
}

const config = loadConfigAndEnv(root);
if (!config) {
  issues.push(
    "GRAFANA_CLOUD_* credentials are missing from .env (metrics will NOT be pushed)."
  );
  if (fs.existsSync(envPath)) {
    const body = fs.readFileSync(envPath, "utf8");
    if (body.includes("SMTP_") && !body.includes("GRAFANA_CLOUD_REMOTE_WRITE_URL")) {
      issues.push(
        ".env only has email (SMTP) settings — copy GRAFANA_CLOUD_* from .env.example or the Cursor workspace .env."
      );
    }
  } else {
    issues.push("No .env file — copy .env.example and fill in Grafana Cloud values.");
  }
}

if (issues.length > 0) {
  console.error("\n❌ Grafana metrics will not reach Grafana Cloud:\n");
  for (const issue of issues) {
    console.error(`   • ${issue}\n`);
  }
  console.error("After fixing, run tests and confirm you see:\n");
  console.error("   📤 remote_write: N series → ...grafana.net/api/prom/push\n");
  process.exit(1);
}

console.log("✓ Grafana push credentials and reporter are configured");
