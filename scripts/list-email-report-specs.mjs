#!/usr/bin/env node
/**
 * Inventory Playwright specs tied to GitHub Actions email reporting.
 *
 * Usage:
 *   node scripts/list-email-report-specs.mjs
 *   node scripts/list-email-report-specs.mjs --write
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const writeMd = process.argv.includes("--write");

/** Spec path → metadata for email-report pipeline */
export const EMAIL_REPORT_SPECS = [
  {
    spec: "tests/specs/planetf1/Planetf1.webpages.spec.ts",
    hubName: "PlanetF1",
    category: "Website Content Tests",
    npmScript: "test:planetf1",
    workflow: "playwright-planetf1.yml",
    writesEmailReport: "direct",
    project: "Other Tests",
  },
  {
    spec: "tests/specs/planetf1/Planetf1.team-standings-widget.spec.ts",
    hubName: "PlanetF1 Team Standings Widget",
    category: "Website Content Tests",
    npmScript: "test:planetf1:team-widget",
    workflow: "playwright-planetf1.yml",
    writesEmailReport: "merge",
    project: "Other Tests",
  },
  {
    spec: "tests/specs/teamtalk/teamtlkweb.spec.ts",
    hubName: "TeamTalk",
    category: "Website Content Tests",
    npmScript: "test:teamtalk",
    workflow: "playwright-teamtalk.yml",
    writesEmailReport: "direct",
    project: "Other Tests",
  },
  {
    spec: "tests/specs/teamtalk/teamtalk.Teams.spec.ts",
    hubName: "TeamTalk Teams",
    category: "Website Content Tests",
    npmScript: "test:teamtalk:teams",
    workflow: "playwright-teamtalk-teams.yml",
    writesEmailReport: "direct",
    project: "Other Tests",
  },
  {
    spec: "tests/specs/planetrugby/PlanetRugby.webpages.spec.ts",
    hubName: "PlanetRugby",
    category: "Website Content Tests",
    npmScript: "test:planetrugby",
    workflow: "playwright-planetrugby.yml",
    writesEmailReport: "merge",
    project: "Other Tests",
  },
  {
    spec: "tests/specs/planetrugby/PlanetRugby.teams-only.spec.ts",
    hubName: "PlanetRugby Teams",
    category: "Website Content Tests",
    npmScript: "test:planetrugby:teams",
    workflow: "playwright-run-spec.yml",
    writesEmailReport: "merge",
    project: "Other Tests",
  },
  {
    spec: "tests/specs/football365/Football365web.spec.ts",
    hubName: "Football365",
    category: "Website Content Tests",
    npmScript: "test:football365",
    workflow: "ci.yml (Football365 Tests)",
    writesEmailReport: "direct",
    project: "Football365 Tests",
  },
  {
    spec: "tests/specs/golf365/Golf365web.spec.ts",
    hubName: "Golf365",
    category: "Website Content Tests",
    npmScript: "test:Golf365",
    workflow: "playwright-golf365.yml",
    writesEmailReport: "merge",
    project: "Golf365 Tests",
  },
  {
    spec: "tests/specs/cricket365/Cricket365web.spec.ts",
    hubName: "Cricket365",
    category: "Website Content Tests",
    npmScript: "test:cricket365",
    workflow: "ci.yml (Cricket365 Tests)",
    writesEmailReport: "merge",
    project: "Cricket365 Tests",
  },
  {
    spec: "tests/specs/planetfootball/PlanetFootball.spec.ts",
    hubName: "PlanetFootball",
    category: "Website Content Tests",
    npmScript: "test:planetfootball",
    workflow: "ci.yml (PlanetFootball Tests)",
    writesEmailReport: "merge",
    project: "PlanetFootball Tests",
  },
  {
    spec: "tests/specs/loverugbyleague/Loverugbyleague.spec.ts",
    hubName: "LoveRugbyLeague",
    category: "Website Content Tests",
    npmScript: "test:loverugbyleague",
    workflow: "playwright-loverugbyleague.yml",
    writesEmailReport: "merge",
    project: "Other Tests",
  },
  {
    spec: "tests/specs/dragonsports/dragonsports.site-content.spec.ts",
    hubName: "DragonSports",
    category: "Website Content Tests",
    npmScript: "test:dragonsports:site",
    workflow: "playwright-dragonsports.yml",
    writesEmailReport: "merge",
    project: "Other Tests",
  },
  {
    spec: "tests/specs/dragonsports/dragonsports.football.live-centre.spec.ts",
    hubName: "DragonSports Football Live Centre",
    category: "Live Centre & Live Score Tests",
    npmScript: "test:dragonsports:football-live-centre",
    workflow: "playwright-run-spec.yml",
    writesEmailReport: "merge",
    project: "Other Tests",
  },
  {
    spec: "tests/specs/dragonsports/dragonsports.Rugby.live-centre.spec.ts",
    hubName: "DragonSports Rugby Live Centre",
    category: "Live Centre & Live Score Tests",
    npmScript: "test:dragonsports:rugby-live-centre",
    workflow: "playwright-run-spec.yml",
    writesEmailReport: "merge",
    project: "Other Tests",
  },
  {
    spec: "tests/specs/dragonsports/dragonsports.rugby.live-scores.spec.ts",
    hubName: "DragonSports Rugby Live Scores",
    category: "Live Centre & Live Score Tests",
    npmScript: "test:dragonsports:rugby-live-scores",
    workflow: "playwright-run-spec.yml",
    writesEmailReport: "merge",
    project: "Other Tests",
  },
  {
    spec: "tests/specs/dragonsports/dragonsport.football.animations.spec.ts",
    hubName: "DragonSports Football Animation",
    category: "Sports Animation Tests",
    npmScript: "test:dragonsports:football-animations",
    workflow: "playwright-run-spec.yml",
    writesEmailReport: "merge",
    project: "Other Tests",
  },
  {
    spec: "tests/specs/betwright/Betwright.Football.Animation.spec.ts",
    hubName: "Betwright Football Animation",
    category: "Sports Animation Tests",
    npmScript: "test:betwright:football",
    workflow: "playwright-betwright.yml",
    writesEmailReport: "helper",
    project: "Other Tests",
  },
  {
    spec: "tests/specs/betwright/Betwright.Cricket.Animation.spec.ts",
    hubName: "Betwright Cricket Animation",
    category: "Sports Animation Tests",
    npmScript: "test:betwright:cricket",
    workflow: "playwright-betwright.yml",
    writesEmailReport: "helper",
    project: "Other Tests",
  },
  {
    spec: "tests/specs/betwright/Betwright.Tennis.Animation.Spec.ts",
    hubName: "Betwright Tennis Animation",
    category: "Sports Animation Tests",
    npmScript: "test:betwright:tennis",
    workflow: "playwright-betwright.yml",
    writesEmailReport: "helper",
    project: "Other Tests",
  },
  {
    spec: "tests/specs/dragonbet/DragonSportbet.Football.animations.spec.ts",
    hubName: "DragonBet Football Animation",
    category: "Sports Animation Tests",
    npmScript: "test:dragonbet:football",
    workflow: "playwright-dragonbet.yml",
    writesEmailReport: "helper",
    project: "DragonBet Tests",
  },
  {
    spec: "tests/specs/dragonbet/DragonSportbet.Cricket.animations.spec.ts",
    hubName: "DragonBet Cricket Animation",
    category: "Sports Animation Tests",
    npmScript: "test:dragonbet:cricket",
    workflow: "playwright-dragonbet.yml",
    writesEmailReport: "helper",
    project: "DragonBet Tests",
  },
  {
    spec: "tests/specs/dragonbet/DragonSportbet.Tennis.animations.spec.ts",
    hubName: "DragonBet Tennis Animation",
    category: "Sports Animation Tests",
    npmScript: "test:dragonbet:tennis",
    workflow: "playwright-dragonbet.yml",
    writesEmailReport: "helper",
    project: "DragonBet Tests",
  },
  {
    spec: "tests/specs/dragonbet/DragonSportbet.NFL.animations.spec.ts",
    hubName: "DragonBet American Football Animation",
    category: "Sports Animation Tests",
    npmScript: "test:dragonbet:nfl",
    workflow: "playwright-dragonbet.yml",
    writesEmailReport: "helper",
    project: "DragonBet Tests",
  },
  {
    spec: "tests/specs/planetsports/PSG.Football.Animations.spec.ts",
    hubName: "PlanetSports Football Animation",
    category: "Sports Animation Tests",
    npmScript: "test:football",
    workflow: "playwright-planetsports.yml",
    writesEmailReport: "merge",
    project: "Other Tests",
  },
  {
    spec: "tests/specs/planetsports/PSG.cricket.Animations.spec.ts",
    hubName: "PlanetSports Cricket Animation",
    category: "Sports Animation Tests",
    npmScript: "test:cricket",
    workflow: "playwright-planetsports.yml",
    writesEmailReport: "merge",
    project: "Other Tests",
  },
  {
    spec: "tests/specs/planetsports/PSG.Tennis.Animations.Spec.ts",
    hubName: "PlanetSports Tennis Animation",
    category: "Sports Animation Tests",
    npmScript: "test:tennis",
    workflow: "playwright-planetsports.yml",
    writesEmailReport: "merge",
    project: "Other Tests",
  },
  {
    spec: "tests/specs/planetsports/PSG.NFL.Animations.spec.ts",
    hubName: "PlanetSports NFL Animation",
    category: "Sports Animation Tests",
    npmScript: "test:nfl",
    workflow: "playwright-planetsports.yml",
    writesEmailReport: "merge",
    project: "Other Tests",
  },
  {
    spec: "tests/specs/starsports/starsports.football.animation.spec.ts",
    hubName: "StarSports Football Animation",
    category: "Sports Animation Tests",
    npmScript: "test:starsports:football",
    workflow: "playwright-starsports.yml",
    writesEmailReport: "merge",
    project: "Other Tests",
  },
  {
    spec: "tests/specs/starsports/starsports.cricket.animation.spec.ts",
    hubName: "StarSports Cricket Animation",
    category: "Sports Animation Tests",
    npmScript: "test:starsports:cricket",
    workflow: "playwright-starsports.yml",
    writesEmailReport: "merge",
    project: "Other Tests",
  },
  {
    spec: "tests/specs/starsports/starsports.tennis.animation.spec.ts",
    hubName: "StarSports Tennis Animation",
    category: "Sports Animation Tests",
    npmScript: "test:starsports:tennis",
    workflow: "playwright-starsports.yml",
    writesEmailReport: "merge",
    project: "Other Tests",
  },
  {
    spec: "tests/specs/starsports/starsports.nfl.animation.spec.ts",
    hubName: "StarSports NFL Animation",
    category: "Sports Animation Tests",
    npmScript: "test:starsports:nfl",
    workflow: "playwright-starsports.yml",
    writesEmailReport: "merge",
    project: "Other Tests",
  },
  {
    spec: "tests/specs/vodacom/VodaCS.comprehensive.spec.ts",
    hubName: "Vodacom Comprehensive",
    category: "Website Content Tests",
    npmScript: "test:vodacom:comprehensive",
    workflow: "playwright-vodacom.yml",
    writesEmailReport: "merge",
    project: "Other Tests",
  },
  {
    spec: "tests/specs/vodacom/VodaCS.quick.spec.ts",
    hubName: "Vodacom Quick",
    category: "Website Content Tests",
    npmScript: "test:vodacom:quick",
    workflow: "playwright-run-spec.yml",
    writesEmailReport: "merge",
    project: "Other Tests",
  },
];

const SECRETS = [
  "SMTP_SERVER",
  "SMTP_PORT",
  "SMTP_USERNAME",
  "SMTP_PASSWORD",
  "ALERT_EMAIL_TO",
  "ALERT_EMAIL_FROM",
  "DASHBOARD_WEBHOOK_URL",
  "DASHBOARD_WEBHOOK_SECRET",
  "DRAGONBET_UK_PROXY",
];

function exists(spec) {
  return fs.existsSync(path.join(root, spec));
}

const lines = [];
lines.push("# Email-report Playwright specs\n");
lines.push(`Generated: ${new Date().toISOString()}\n`);
lines.push(`Repo: ${root}\n`);
lines.push("## GitHub Actions secrets (sport-test-automator-main-1)\n");
for (const s of SECRETS) lines.push(`- \`${s}\``);
lines.push("\n## Spec inventory\n");
lines.push("| Spec | Hub name | Category | npm script | Workflow | Email report | Project | On disk |");
lines.push("|------|----------|----------|------------|----------|--------------|---------|---------|");

let missing = 0;
for (const row of EMAIL_REPORT_SPECS) {
  const onDisk = exists(row.spec) ? "yes" : "**missing**";
  if (!exists(row.spec)) missing++;
  lines.push(
    `| \`${row.spec}\` | ${row.hubName} | ${row.category} | \`${row.npmScript}\` | ${row.workflow} | ${row.writesEmailReport} | ${row.project} | ${onDisk} |`,
  );
}

lines.push(`\n**Total:** ${EMAIL_REPORT_SPECS.length} specs (${missing} missing on disk)\n`);

const outPath = path.join(root, "EMAIL_REPORT_SPECS.md");
const body = lines.join("\n");
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(body);
  if (writeMd) {
    fs.writeFileSync(outPath, body);
    console.log(`\nWrote ${outPath}`);
  }
}
