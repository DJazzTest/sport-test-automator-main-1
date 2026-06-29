import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";
import * as fs from "fs";
import * as path from "path";
import {
  type GrafanaMetric,
  type GrafanaTestMetrics,
  parseGrafanaMetricAnnotations,
} from "../lib/grafana-metrics";

interface RecordedTestResult {
  timestamp: string;
  site: string;
  suite: string;
  testTitle: string;
  status: "passed" | "failed" | "skipped" | "timedOut" | "interrupted";
  durationMs: number;
  page?: string;
  metrics: GrafanaMetric[];
  error?: string;
}

interface GrafanaMetricsReport {
  runId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  status: FullResult["status"];
  tests: RecordedTestResult[];
}

function sanitizeLabel(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ");
}

function formatPrometheusLabels(labels: Record<string, string>): string {
  const entries = Object.entries(labels).map(
    ([key, value]) => `${key}="${sanitizeLabel(value)}"`
  );
  return entries.length > 0 ? `{${entries.join(",")}}` : "";
}

function toPrometheusLines(report: GrafanaMetricsReport): string[] {
  const lines: string[] = [];
  const metricTypes = new Map<string, GrafanaMetric["type"]>();

  for (const testResult of report.tests) {
    const baseLabels = {
      site: testResult.site,
      suite: testResult.suite,
      test: testResult.testTitle,
      ...(testResult.page ? { page: testResult.page } : {}),
    };

    const statusValue =
      testResult.status === "passed"
        ? 1
        : testResult.status === "skipped"
          ? -1
          : 0;

    const statusMetric: GrafanaMetric = {
      name: "sport_e2e_test_passed",
      value: statusValue,
      type: "gauge",
      labels: baseLabels,
    };

    const durationMetric: GrafanaMetric = {
      name: "sport_e2e_test_duration_seconds",
      value: testResult.durationMs / 1000,
      type: "gauge",
      labels: baseLabels,
    };

    for (const metric of [statusMetric, durationMetric, ...testResult.metrics]) {
      metricTypes.set(metric.name, metric.type);
      const labels = { ...baseLabels, ...(metric.labels || {}) };
      lines.push(
        `${metric.name}${formatPrometheusLabels(labels)} ${metric.value}`
      );
    }
  }

  const header = Array.from(metricTypes.entries()).map(
    ([name, type]) => `# TYPE ${name} ${type}`
  );

  return [...header, ...lines];
}

function inferSiteFromFile(test: TestCase): string {
  const filePath = test.location.file.replace(/\\/g, "/");
  const match = filePath.match(/tests\/(?:e2e|specs)\/([^/]+)/);
  const inferredSite = match?.[1] || "unknown";
  if (inferredSite === "planetsports") {
    return "planetwatch-hub";
  }
  return inferredSite;
}

class GrafanaMetricsReporter implements Reporter {
  private outputDir = "test-results";
  private runId = `run-${Date.now()}`;
  private startedAt = new Date().toISOString();
  private tests: RecordedTestResult[] = [];

  onBegin(_config: FullConfig, _suite: Suite): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const metricPayloads = parseGrafanaMetricAnnotations(result.annotations);
    const primaryPayload = metricPayloads[0];
    const site = primaryPayload?.site || inferSiteFromFile(test);
    const suite = primaryPayload?.suite || path.basename(test.location.file, ".spec.ts");
    const page = primaryPayload?.page;
    const metrics = metricPayloads.flatMap((payload) => payload.metrics);

    this.tests.push({
      timestamp: new Date().toISOString(),
      site,
      suite,
      page,
      testTitle: test.title,
      status: result.status,
      durationMs: result.duration,
      metrics,
      error: result.error?.message,
    });
  }

  async onEnd(result: FullResult): Promise<void> {
    const report: GrafanaMetricsReport = {
      runId: this.runId,
      startedAt: this.startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: result.duration,
      status: result.status,
      tests: this.tests,
    };

    const jsonPath = path.join(this.outputDir, "grafana-metrics.json");
    const promPath = path.join(this.outputDir, "grafana-metrics.prom");
    const promBody = `${toPrometheusLines(report).join("\n")}\n`;

    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    fs.writeFileSync(promPath, promBody);

    console.log(`\n📈 Grafana metrics written to ${jsonPath}`);
    console.log(`📈 Prometheus exposition written to ${promPath}`);

    const { loadConfigAndEnv, remoteWriteFromPromFile } = await import(
      "../../scripts/lib/grafana-remote-write.mjs"
    );
    const config = loadConfigAndEnv(process.cwd());

    if (!config) {
      console.log(
        "ℹ️  Skipping remote_write (set GRAFANA_CLOUD_* in .env to auto-push → grafanacloud-prom)"
      );
      return;
    }

    try {
      const { seriesCount } = await remoteWriteFromPromFile(promPath, config);
      console.log(
        `📤 remote_write: ${seriesCount} series → ${config.url} (grafanacloud-prom)`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`❌ remote_write failed: ${message}`);
    }
  }
}

export default GrafanaMetricsReporter;
