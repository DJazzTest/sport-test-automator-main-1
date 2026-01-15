# All Test Commands Reference

## Total: 28 spec.ts test files

### Quick Command Format
For any test file, use:
```bash
npm run test:playwright -- <path-to-test-file>
```

Or directly with npx:
```bash
npx playwright test <path-to-test-file>
```

---

## PlanetSports Tests (PSG)
1. **PSG Cricket Animations**
   ```bash
   npm run test:cricket
   # or: npx playwright test tests/specs/planetsports/PSG.cricket.Animations.spec.ts
   ```

2. **PSG Football Animations**
   ```bash
   npm run test:football
   # or: npx playwright test tests/specs/planetsports/PSG.Football.Animations.spec.ts
   ```

3. **PSG Tennis Animations**
   ```bash
   npm run test:tennis
   # or: npx playwright test tests/specs/planetsports/PSG.Tennis.Animations.Spec.ts
   ```

4. **PSG NFL Animations**
   ```bash
   npm run test:nfl
   # or: npx playwright test tests/specs/planetsports/PSG.NFL.Animations.spec.ts
   ```

5. **PlanetSportGroup Tennis**
   ```bash
   npx playwright test tests/specs/planetsports/planetsportgroup.tennis.spec.ts
   ```

---

## StarSports Tests
6. **StarSports Cricket Animation**
   ```bash
   npx playwright test tests/specs/starsports/starsports.cricket.animation.spec.ts
   ```

7. **StarSports Football Animation**
   ```bash
   npx playwright test tests/specs/starsports/starsports.football.animation.spec.ts
   ```

8. **StarSports Tennis Animation**
   ```bash
   npx playwright test tests/specs/starsports/starsports.tennis.animation.spec.ts
   ```

9. **StarSports NFL Animation**
   ```bash
   npx playwright test tests/specs/starsports/starsports.nfl.animation.spec.ts
   ```

10. **StarSports Inplay Automation**
    ```bash
    npx playwright test tests/specs/starsports/starsports.inplay-automation.spec.ts
    ```

---

## DragonBet/DragonSports Tests
11. **DragonSport Cricket Animations**
    ```bash
    npx playwright test tests/specs/dragonbet/DragonSport.Cricket.animations.spec.ts
    ```

12. **DragonSport Football Animations**
    ```bash
    npx playwright test tests/specs/dragonbet/DragonSport.Football.animations.spec.ts
    ```

13. **DragonSport NFL Animations**
    ```bash
    npx playwright test tests/specs/dragonbet/DragonSport.NFL.animations.spec.ts
    ```

14. **DragonSport Tennis Animations**
    ```bash
    npx playwright test tests/specs/dragonbet/DragonSport.Tennis.animations.spec.ts
    ```

15. **DragonSport Football Animations (dragonsports folder)**
    ```bash
    npx playwright test tests/specs/dragonsports/dragonsport.football.animations.spec.ts
    ```

---

## Vodacom Tests
16. **VodaCS Comprehensive**
    ```bash
    npx playwright test tests/specs/vodacom/VodaCS.comprehensive.spec.ts
    ```

17. **VodaCS Quick**
    ```bash
    npx playwright test tests/specs/vodacom/VodaCS.quick.spec.ts
    ```

18. **VodaCS Test**
    ```bash
    npx playwright test tests/specs/vodacom/VodaCS.test.spec.ts
    ```

---

## TeamTalk Tests
19. **TeamTalk Web (Comprehensive)**
    ```bash
    npm run test:teamtalk:web
    # or: npx playwright test tests/specs/teamtalk/teamtlkweb.spec.ts
    ```
    **Covers:** Home, Transfer News, Confirmed Transfers, Premier League, and Teams pages

---

## Other Tests
22. **PlanetF1 Webpages**
    ```bash
    npx playwright test tests/specs/planetf1/Planetf1.webpages.spec.ts
    ```

23. **BetWright Cricket**
    ```bash
    npx playwright test tests/specs/betwright/betwright.cricket.spec.ts
    ```

24. **Common Navigation**
    ```bash
    npx playwright test tests/specs/common/common.navigation.spec.ts
    ```

25. **Unit Server Temp**
    ```bash
    npx playwright test tests/specs/unit/unit.server.temp.spec.ts
    ```

---

## Legacy Tests (in tests/teamtalk folder)
26. **TeamTalk Home and Teams (legacy)**
    ```bash
    npx playwright test tests/teamtalk/teamtalkHomeAndTeams.spec.ts
    ```

27. **TeamTalk Ps Tag Validation**
    ```bash
    npx playwright test tests/teamtalk/teamtalkPsTagValidation.spec.ts
    ```

28. **TeamTalk Homepage Spec**
    ```bash
    npx playwright test tests/teamtalk/teamtalkHomepage.Spec.ts
    ```

---

## Run Multiple Tests

**Run all PlanetSports tests:**
```bash
npx playwright test tests/specs/planetsports/
```

**Run all StarSports tests:**
```bash
npx playwright test tests/specs/starsports/
```

**Run all DragonBet tests:**
```bash
npx playwright test tests/specs/dragonbet/
```

**Run all Vodacom tests:**
```bash
npx playwright test tests/specs/vodacom/
```

**Run all TeamTalk tests:**
```bash
npx playwright test tests/specs/teamtalk/
```

---

## Tips

- Add `--headed` to see the browser: `npx playwright test <file> --headed`
- Add `--debug` to step through: `npx playwright test <file> --debug`
- Run specific test by name: `npx playwright test <file> -g "test name"`
- View HTML report: `npx playwright show-report`
