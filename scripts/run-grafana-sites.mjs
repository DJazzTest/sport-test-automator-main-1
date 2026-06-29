#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

/** Sites pushed to Grafana Cloud via per-site npm scripts */
export const GRAFANA_SITE_SCRIPTS = [
  "test:grafana:planetf1",
  "test:grafana:teamtalk",
  "test:grafana:planetrugby",
  "test:grafana:loverugbyleague",
  "test:grafana:planetwatch-hub",
  "test:grafana:starsports",
  "test:grafana:vodacom",
  "test:grafana:dragonbet",
  "test:grafana:dragonsports",
  "test:grafana:betwright",
  "test:grafana:golf365",
  "test:grafana:cricket365",
  "test:grafana:football365",
  "test:grafana:planetfootball",
];

function run(command, args) {
  return spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, PLAYWRIGHT_QUICK: "1" },
  });
}

const check = run("node", ["scripts/ensure-grafana-env.mjs"]);
if (check.status !== 0) {
  process.exit(check.status ?? 1);
}

console.log(`\n🚀 Running ${GRAFANA_SITE_SCRIPTS.length} site test suites → Grafana Cloud\n`);

const results = [];

for (const script of GRAFANA_SITE_SCRIPTS) {
  const label = script.replace("test:grafana:", "");
  console.log(`\n${"=".repeat(60)}\n▶ ${script}\n${"=".repeat(60)}\n`);
  const started = Date.now();
  const outcome = run("npm", ["run", script]);
  const minutes = ((Date.now() - started) / 60000).toFixed(1);
  results.push({
    site: label,
    ok: outcome.status === 0,
    minutes,
    code: outcome.status ?? 1,
  });
}

console.log(`\n${"=".repeat(60)}\n📊 Grafana site run summary\n${"=".repeat(60)}`);
for (const { site, ok, minutes, code } of results) {
  console.log(`  ${ok ? "✓" : "✗"} ${site.padEnd(20)} ${minutes}m  (exit ${code})`);
}
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} suites passed. Metrics pushed after each suite (see 📤 remote_write lines above).`);
console.log(
  "Dashboard: https://davidjarrett001.grafana.net/d/sport-test-automator/sport-test-automator-teamtalk-and-planetf1"
);
console.log("Explore: {__name__=~\"sport_e2e_.*\"} — time range Last 15 minutes\n");

process.exit(passed === results.length ? 0 : 1);
