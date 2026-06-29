import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pushTimeseries } from "prometheus-remote-write";

const require = createRequire(import.meta.url);

const REMOTE_WRITE_TROUBLESHOOTING = {
  400: "HTTP 400 — Protobuf encoding wrong. Check protobufjs is installed: npm install prometheus-remote-write",
  401: "HTTP 401 — Wrong credentials. Instance ID must be numbers only; token must start with glsa_ or glc_",
  404: "HTTP 404 — Wrong URL path. URL must end in /api/prom/push (not /api/v1/write)",
};

export function validateNodeRuntime() {
  const major = Number(process.versions.node.split(".")[0]);
  if (major < 18) {
    throw new Error(
      `Node ${process.versions.node} is too old. remote_write needs Node 18+ (fetch built-in). Run: node --version`
    );
  }
  if (typeof fetch !== "function") {
    throw new Error(
      "fetch is not defined. Upgrade to Node 18+ or add node-fetch."
    );
  }

  try {
    require.resolve("protobufjs");
  } catch {
    throw new Error(
      "protobufjs is missing. Run: npm install prometheus-remote-write"
    );
  }
}

export function validateGrafanaCloudConfig(config) {
  const issues = [];

  if (!config?.url?.endsWith("/api/prom/push")) {
    issues.push(REMOTE_WRITE_TROUBLESHOOTING[404]);
  }

  if (!/^\d+$/.test(String(config?.auth?.username ?? ""))) {
    issues.push(
      "GRAFANA_CLOUD_METRICS_INSTANCE_ID must be numeric (copy the User value from Prometheus → Details)"
    );
  }

  const token = String(config?.auth?.password ?? "");
  if (!token.startsWith("glsa_") && !token.startsWith("glc_")) {
    issues.push(
      "GRAFANA_CLOUD_API_TOKEN should start with glsa_ or glc_ (Grafana Cloud access policy token)"
    );
  }

  if (issues.length > 0) {
    throw new Error(`Invalid Grafana Cloud config:\n- ${issues.join("\n- ")}`);
  }
}

export function formatRemoteWriteError(status, detail = "") {
  const hint = REMOTE_WRITE_TROUBLESHOOTING[status];
  if (hint) {
    return detail ? `${hint}\n${detail}` : hint;
  }
  return detail || `remote_write failed with HTTP ${status}`;
}

export function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const index = trimmed.indexOf("=");
    if (index === -1) {
      continue;
    }
    const key = trimmed.slice(0, index);
    const value = trimmed.slice(index + 1);
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function trimSecret(value) {
  return String(value ?? "").trim();
}

export function getGrafanaCloudConfig(env = process.env) {
  const url = trimSecret(env.GRAFANA_CLOUD_REMOTE_WRITE_URL);
  const username = trimSecret(
    env.GRAFANA_CLOUD_METRICS_INSTANCE_ID || env.GRAFANA_CLOUD_USERNAME
  );
  const password = trimSecret(
    env.GRAFANA_CLOUD_API_TOKEN || env.GRAFANA_CLOUD_PASSWORD
  );

  if (!url || !username || !password) {
    return null;
  }

  return {
    url,
    auth: { username, password },
    labels: {
      job: env.PROMETHEUS_JOB_NAME || "sport-test-automator",
      instance: env.PROMETHEUS_INSTANCE || "local",
    },
  };
}

export function parsePrometheusLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const match = trimmed.match(
    /^([a-zA-Z_:][\w:]*)(\{.*\})?\s+(-?\d+(?:\.\d+)?)$/
  );
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
      labels[labelMatch[1]] = labelMatch[2]
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
    }
  }

  return { labels, value: Number(value) };
}

export function promTextToTimeseries(body, timestamp = Date.now()) {
  return body
    .split("\n")
    .map(parsePrometheusLine)
    .filter(Boolean)
    .map((series) => ({
      labels: series.labels,
      samples: [{ value: series.value, timestamp }],
    }));
}

/**
 * POST batched points to Grafana Cloud Mimir via Prometheus remote_write (protobuf + snappy).
 */
export async function remoteWrite(timeseries, config, options = {}) {
  validateNodeRuntime();
  validateGrafanaCloudConfig(config);

  if (timeseries.length === 0) {
    throw new Error("No timeseries to push");
  }

  let result;
  try {
    result = await pushTimeseries(timeseries, {
      url: config.url,
      auth: config.auth,
      labels: config.labels,
      verbose: options.verbose ?? process.env.VERBOSE === "1",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("fetch is not defined")) {
      throw new Error(
        "fetch is not defined. Node < 18 — run node --version and upgrade, or add node-fetch."
      );
    }
    throw error;
  }

  if (result.status < 200 || result.status >= 300) {
    const detail = result.statusText || result.errorMessage || "";
    throw new Error(formatRemoteWriteError(result.status, detail));
  }

  return { seriesCount: timeseries.length, result };
}

export async function remoteWriteFromPromFile(
  promFilePath,
  config = getGrafanaCloudConfig()
) {
  if (!config) {
    throw new Error("Grafana Cloud credentials are not configured");
  }

  const body = fs.readFileSync(promFilePath, "utf8");
  const timeseries = promTextToTimeseries(body);
  return remoteWrite(timeseries, config);
}

export function loadConfigAndEnv(cwd = process.cwd()) {
  loadDotEnv(path.join(cwd, ".env"));
  return getGrafanaCloudConfig();
}
