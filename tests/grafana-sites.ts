import { SITE_LABELS } from "./lib/grafana-metrics";

/** Grafana site keys → Playwright test directories */
export const GRAFANA_SITES = {
  planetf1: { label: SITE_LABELS.planetf1, dir: "tests/specs/planetf1" },
  teamtalk: { label: SITE_LABELS.teamtalk, dir: "tests/specs/teamtalk" },
  planetrugby: { label: SITE_LABELS.planetrugby, dir: "tests/specs/planetrugby" },
  loverugbyleague: {
    label: SITE_LABELS.loverugbyleague,
    dir: "tests/specs/loverugbyleague",
  },
  planetwatchhub: { label: "planetwatch-hub", dir: "tests/specs/planetsports" },
  starsports: { label: SITE_LABELS.starsports, dir: "tests/specs/starsports" },
  vodacom: { label: SITE_LABELS.vodacom, dir: "tests/specs/vodacom" },
  dragonbet: { label: SITE_LABELS.dragonbet, dir: "tests/specs/dragonbet" },
  dragonsports: { label: "dragonsports", dir: "tests/specs/dragonsports" },
  betwright: { label: "betwright", dir: "tests/specs/betwright" },
  golf365: { label: "golf365", dir: "tests/specs/golf365" },
  cricket365: { label: "cricket365", dir: "tests/specs/cricket365" },
  football365: { label: "football365", dir: "tests/specs/football365" },
  planetfootball: { label: "planetfootball", dir: "tests/specs/planetfootball" },
  common: { label: "common", dir: "tests/specs/common" },
  // Legacy e2e paths (still supported)
  akbets: { label: SITE_LABELS.akbets, dir: "tests/e2e/akbets" },
  gentlemanjim: { label: SITE_LABELS.gentlemanjim, dir: "tests/e2e/gentlemanjim" },
  nrg: { label: SITE_LABELS.nrg, dir: "tests/e2e/nrg" },
  pricedup: { label: SITE_LABELS.pricedup, dir: "tests/e2e/pricedup" },
} as const;

export type GrafanaSiteKey = keyof typeof GRAFANA_SITES;

export const GRAFANA_SITE_KEYS = Object.keys(GRAFANA_SITES) as GrafanaSiteKey[];
