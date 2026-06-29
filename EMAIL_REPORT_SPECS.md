# Email-report Playwright specs

Generated: 2026-06-16T10:01:51.314Z

Repo: /Users/davidjarrett/Documents/sport-test-automator-main-1

## GitHub Actions secrets (sport-test-automator-main-1)

- `SMTP_SERVER`
- `SMTP_PORT`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `ALERT_EMAIL_TO`
- `ALERT_EMAIL_FROM`
- `DASHBOARD_WEBHOOK_URL`
- `DASHBOARD_WEBHOOK_SECRET`
- `DRAGONBET_UK_PROXY`

## Spec inventory

| Spec | Hub name | Category | npm script | Workflow | Email report | Project | On disk |
|------|----------|----------|------------|----------|--------------|---------|---------|
| `tests/specs/planetf1/Planetf1.webpages.spec.ts` | PlanetF1 | Website Content Tests | `test:planetf1` | playwright-planetf1.yml | direct | Other Tests | yes |
| `tests/specs/teamtalk/teamtlkweb.spec.ts` | TeamTalk | Website Content Tests | `test:teamtalk` | playwright-teamtalk.yml | direct | Other Tests | yes |
| `tests/specs/teamtalk/teamtalk.Teams.spec.ts` | TeamTalk Teams | Website Content Tests | `test:teamtalk:teams` | playwright-teamtalk-teams.yml | direct | Other Tests | yes |
| `tests/specs/planetrugby/PlanetRugby.webpages.spec.ts` | PlanetRugby | Website Content Tests | `test:planetrugby` | playwright-planetrugby.yml | merge | Other Tests | yes |
| `tests/specs/planetrugby/PlanetRugby.teams-only.spec.ts` | PlanetRugby Teams | Website Content Tests | `test:planetrugby:teams` | playwright-run-spec.yml | merge | Other Tests | yes |
| `tests/specs/football365/Football365web.spec.ts` | Football365 | Website Content Tests | `test:football365` | ci.yml (Football365 Tests) | direct | Football365 Tests | yes |
| `tests/specs/golf365/Golf365web.spec.ts` | Golf365 | Website Content Tests | `test:Golf365` | playwright-golf365.yml | merge | Golf365 Tests | yes |
| `tests/specs/cricket365/Cricket365web.spec.ts` | Cricket365 | Website Content Tests | `test:cricket365` | ci.yml (Cricket365 Tests) | merge | Cricket365 Tests | yes |
| `tests/specs/planetfootball/PlanetFootball.spec.ts` | PlanetFootball | Website Content Tests | `test:planetfootball` | ci.yml (PlanetFootball Tests) | merge | PlanetFootball Tests | yes |
| `tests/specs/loverugbyleague/Loverugbyleague.spec.ts` | LoveRugbyLeague | Website Content Tests | `test:loverugbyleague` | playwright-loverugbyleague.yml | merge | Other Tests | yes |
| `tests/specs/dragonsports/dragonsports.site-content.spec.ts` | DragonSports | Website Content Tests | `test:dragonsports:site` | playwright-dragonsports.yml | merge | Other Tests | yes |
| `tests/specs/dragonsports/dragonsports.football.live-centre.spec.ts` | DragonSports Football Live Centre | Live Centre & Live Score Tests | `test:dragonsports:football-live-centre` | playwright-run-spec.yml | merge | Other Tests | yes |
| `tests/specs/dragonsports/dragonsports.Rugby.live-centre.spec.ts` | DragonSports Rugby Live Centre | Live Centre & Live Score Tests | `test:dragonsports:rugby-live-centre` | playwright-run-spec.yml | merge | Other Tests | yes |
| `tests/specs/dragonsports/dragonsports.rugby.live-scores.spec.ts` | DragonSports Rugby Live Scores | Live Centre & Live Score Tests | `test:dragonsports:rugby-live-scores` | playwright-run-spec.yml | merge | Other Tests | yes |
| `tests/specs/dragonsports/dragonsport.football.animations.spec.ts` | DragonSports Football Animation | Sports Animation Tests | `test:dragonsports:football-animations` | playwright-run-spec.yml | merge | Other Tests | yes |
| `tests/specs/betwright/Betwright.Football.Animation.spec.ts` | Betwright Football Animation | Sports Animation Tests | `test:betwright:football` | playwright-betwright.yml | helper | Other Tests | yes |
| `tests/specs/betwright/Betwright.Cricket.Animation.spec.ts` | Betwright Cricket Animation | Sports Animation Tests | `test:betwright:cricket` | playwright-betwright.yml | helper | Other Tests | yes |
| `tests/specs/betwright/Betwright.Tennis.Animation.Spec.ts` | Betwright Tennis Animation | Sports Animation Tests | `test:betwright:tennis` | playwright-betwright.yml | helper | Other Tests | yes |
| `tests/specs/dragonbet/DragonSportbet.Football.animations.spec.ts` | DragonBet Football Animation | Sports Animation Tests | `test:dragonbet:football` | playwright-dragonbet.yml | helper | DragonBet Tests | yes |
| `tests/specs/dragonbet/DragonSportbet.Cricket.animations.spec.ts` | DragonBet Cricket Animation | Sports Animation Tests | `test:dragonbet:cricket` | playwright-dragonbet.yml | helper | DragonBet Tests | yes |
| `tests/specs/dragonbet/DragonSportbet.Tennis.animations.spec.ts` | DragonBet Tennis Animation | Sports Animation Tests | `test:dragonbet:tennis` | playwright-dragonbet.yml | helper | DragonBet Tests | yes |
| `tests/specs/dragonbet/DragonSportbet.NFL.animations.spec.ts` | DragonBet American Football Animation | Sports Animation Tests | `test:dragonbet:nfl` | playwright-dragonbet.yml | helper | DragonBet Tests | yes |
| `tests/specs/planetsports/PSG.Football.Animations.spec.ts` | PlanetSports Football Animation | Sports Animation Tests | `test:football` | playwright-planetsports.yml | merge | Other Tests | yes |
| `tests/specs/planetsports/PSG.cricket.Animations.spec.ts` | PlanetSports Cricket Animation | Sports Animation Tests | `test:cricket` | playwright-planetsports.yml | merge | Other Tests | yes |
| `tests/specs/planetsports/PSG.Tennis.Animations.Spec.ts` | PlanetSports Tennis Animation | Sports Animation Tests | `test:tennis` | playwright-planetsports.yml | merge | Other Tests | yes |
| `tests/specs/planetsports/PSG.NFL.Animations.spec.ts` | PlanetSports NFL Animation | Sports Animation Tests | `test:nfl` | playwright-planetsports.yml | merge | Other Tests | yes |
| `tests/specs/starsports/starsports.football.animation.spec.ts` | StarSports Football Animation | Sports Animation Tests | `test:starsports:football` | playwright-starsports.yml | merge | Other Tests | yes |
| `tests/specs/starsports/starsports.cricket.animation.spec.ts` | StarSports Cricket Animation | Sports Animation Tests | `test:starsports:cricket` | playwright-starsports.yml | merge | Other Tests | yes |
| `tests/specs/starsports/starsports.tennis.animation.spec.ts` | StarSports Tennis Animation | Sports Animation Tests | `test:starsports:tennis` | playwright-starsports.yml | merge | Other Tests | yes |
| `tests/specs/starsports/starsports.nfl.animation.spec.ts` | StarSports NFL Animation | Sports Animation Tests | `test:starsports:nfl` | playwright-starsports.yml | merge | Other Tests | yes |
| `tests/specs/vodacom/VodaCS.comprehensive.spec.ts` | Vodacom Comprehensive | Website Content Tests | `test:vodacom:comprehensive` | playwright-vodacom.yml | merge | Other Tests | yes |
| `tests/specs/vodacom/VodaCS.quick.spec.ts` | Vodacom Quick | Website Content Tests | `test:vodacom:quick` | playwright-run-spec.yml | merge | Other Tests | yes |

**Total:** 32 specs (0 missing on disk)
