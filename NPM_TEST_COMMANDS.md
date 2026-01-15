# All Test Commands - npm run Format

## Commands Available with npm run

### Run All Tests
```bash
npm run test:all
```

### PlanetSports (PSG) Tests
```bash
npm run test:cricket
npm run test:football
npm run test:tennis
npm run test:nfl
```

### StarSports Tests
```bash
npm run test:starsports:cricket
npm run test:starsports:football
npm run test:starsports:tennis
npm run test:starsports:nfl
```

### Vodacom Tests
```bash
npm run test:vodacom:comprehensive
npm run test:vodacom:quick
```

### PlanetF1 Test
```bash
npm run test:planetf1
```

### PlanetRugby Test
```bash
npm run test:planetrugby
```

### TeamTalk Tests
```bash
npm run test:teamtalk
npm run test:teamtalk:web
```

### Test Suites (Run Multiple Tests)
```bash
npm run test:planetsports    # All PlanetSports tests
npm run test:starsports      # All StarSports tests
npm run test:dragonbet       # All DragonBet tests
npm run test:vodacom         # All Vodacom tests
npm run test:teamtalk        # All TeamTalk tests
```

---

## Tests WITHOUT npm run Commands (Use Direct Commands)

### PlanetSports
```bash
# PlanetSportGroup Tennis
npx playwright test tests/specs/planetsports/planetsportgroup.tennis.spec.ts
```

### StarSports
```bash
# StarSports Inplay Automation
npx playwright test tests/specs/starsports/starsports.inplay-automation.spec.ts
```

### DragonBet (All 4 tests)
```bash
# DragonBet Cricket
npx playwright test tests/specs/dragonbet/DragonSport.Cricket.animations.spec.ts

# DragonBet Football
npx playwright test tests/specs/dragonbet/DragonSport.Football.animations.spec.ts

# DragonBet NFL
npx playwright test tests/specs/dragonbet/DragonSport.NFL.animations.spec.ts

# DragonBet Tennis
npx playwright test tests/specs/dragonbet/DragonSport.Tennis.animations.spec.ts
```

### DragonSports
```bash
# DragonSports Football
npx playwright test tests/specs/dragonsports/dragonsport.football.animations.spec.ts
```

### Vodacom
```bash
# Vodacom Test
npx playwright test tests/specs/vodacom/VodaCS.test.spec.ts
```

### TeamTalk (Legacy)
```bash
# TeamTalk Homepage
npx playwright test tests/teamtalk/teamtalkHomepage.Spec.ts

# TeamTalk Home and Teams
npx playwright test tests/teamtalk/teamtalkHomeAndTeams.spec.ts

# TeamTalk Ps Tag Validation
npx playwright test tests/teamtalk/teamtalkPsTagValidation.spec.ts
```

### Other Tests
```bash
# BetWright Cricket
npx playwright test tests/specs/betwright/betwright.cricket.spec.ts

# Common Navigation
npx playwright test tests/specs/common/common.navigation.spec.ts

# Unit Server Temp
npx playwright test tests/specs/unit/unit.server.temp.spec.ts
```

---

## Quick Copy-Paste Reference

### All npm run Commands:
```bash
npm run test:all
npm run test:cricket
npm run test:football
npm run test:tennis
npm run test:nfl
npm run test:starsports:cricket
npm run test:starsports:football
npm run test:starsports:tennis
npm run test:starsports:nfl
npm run test:vodacom:comprehensive
npm run test:vodacom:quick
npm run test:planetf1
npm run test:teamtalk
npm run test:teamtalk:web
npm run test:planetsports
npm run test:starsports
npm run test:dragonbet
npm run test:vodacom
```

### All Direct Commands (no npm script):
```bash
npx playwright test tests/specs/planetsports/planetsportgroup.tennis.spec.ts
npx playwright test tests/specs/starsports/starsports.inplay-automation.spec.ts
npx playwright test tests/specs/dragonbet/DragonSport.Cricket.animations.spec.ts
npx playwright test tests/specs/dragonbet/DragonSport.Football.animations.spec.ts
npx playwright test tests/specs/dragonbet/DragonSport.NFL.animations.spec.ts
npx playwright test tests/specs/dragonbet/DragonSport.Tennis.animations.spec.ts
npx playwright test tests/specs/dragonsports/dragonsport.football.animations.spec.ts
npx playwright test tests/specs/vodacom/VodaCS.test.spec.ts
npx playwright test tests/teamtalk/teamtalkHomepage.Spec.ts
npx playwright test tests/teamtalk/teamtalkHomeAndTeams.spec.ts
npx playwright test tests/teamtalk/teamtalkPsTagValidation.spec.ts
npx playwright test tests/specs/betwright/betwright.cricket.spec.ts
npx playwright test tests/specs/common/common.navigation.spec.ts
npx playwright test tests/specs/unit/unit.server.temp.spec.ts
```
