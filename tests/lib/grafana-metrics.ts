import { expect, type TestInfo } from "@playwright/test";

/** Site label values — must match Grafana dashboard `site` filters */
export const SITE_LABELS = {
  planetf1: "planetf1",
  teamtalk: "teamtalk",
  akbets: "akbets",
  dragonbet: "dragonbet",
  gentlemanjim: "gentlemanjim",
  nrg: "nrg",
  pricedup: "pricedup",
  starsports: "starsports",
  vodacom: "vodacom",
  planetrugby: "planetrugby",
  loverugbyleague: "loverugbyleague",
  planetwatchhub: "planetwatch-hub",
  dragonsports: "dragonsports",
  betwright: "betwright",
  golf365: "golf365",
  cricket365: "cricket365",
  football365: "football365",
  planetfootball: "planetfootball",
  common: "common",
} as const;

export type SiteLabel = (typeof SITE_LABELS)[keyof typeof SITE_LABELS];

export type MetricType = "gauge" | "counter";

export interface GrafanaMetric {
  name: string;
  value: number;
  type: MetricType;
  labels?: Record<string, string>;
}

export interface GrafanaTestMetrics {
  site: SiteLabel | string;
  suite: string;
  page?: string;
  metrics: GrafanaMetric[];
}

const ANNOTATION_TYPE = "grafana-metric";

/**
 * Attach structured metrics to the current test for the Grafana metrics reporter.
 * Pipeline: recordMetrics() → onTestEnd() collects → onEnd() batches → remoteWrite()
 */
export function recordMetrics(
  testInfo: TestInfo,
  payload: GrafanaTestMetrics
): void {
  testInfo.annotations.push({
    type: ANNOTATION_TYPE,
    description: JSON.stringify(payload),
  });
}

/** @alias recordMetrics */
export const recordGrafanaMetrics = recordMetrics;

export function parseGrafanaMetricAnnotations(
  annotations: Array<{ type: string; description?: string }>
): GrafanaTestMetrics[] {
  return annotations
    .filter((annotation) => annotation.type === ANNOTATION_TYPE)
    .map((annotation) => {
      try {
        return JSON.parse(annotation.description || "{}") as GrafanaTestMetrics;
      } catch {
        return null;
      }
    })
    .filter((payload): payload is GrafanaTestMetrics => payload !== null);
}

export function metric(
  name: string,
  value: number,
  type: MetricType = "gauge",
  labels?: Record<string, string>
): GrafanaMetric {
  return { name, value, type, labels };
}

/** Standard in-play animation metrics for betting site specs */
export function recordInplayAnimationMetrics(
  testInfo: TestInfo,
  site: SiteLabel | string,
  eventCount: number,
  passCount: number,
  failCount: number,
  options?: { thresholdPercent?: number; assert?: boolean }
): void {
  const threshold = options?.thresholdPercent ?? 60;
  const successRate = eventCount > 0 ? (passCount / eventCount) * 100 : 0;

  recordMetrics(testInfo, {
    site,
    suite: "inplay-animation",
    metrics: [
      metric("sport_e2e_inplay_events_total", eventCount, "gauge"),
      metric("sport_e2e_inplay_events_passed", passCount, "gauge"),
      metric("sport_e2e_inplay_events_failed", failCount, "gauge"),
      metric("sport_e2e_animation_coverage_percent", successRate, "gauge"),
      metric(
        "sport_e2e_animation_coverage_threshold_met",
        successRate >= threshold ? 1 : 0,
        "gauge"
      ),
    ],
  });

  if (options?.assert) {
    expect(eventCount, `No in-play events found on ${site}`).toBeGreaterThan(0);
    expect(
      successRate,
      `${site} animation coverage ${successRate.toFixed(1)}% is below ${threshold}%`
    ).toBeGreaterThanOrEqual(threshold);
  }
}
