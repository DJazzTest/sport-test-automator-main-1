# PlanetSportBet Tests

Automated tests for PlanetSportBet website functionality.

## Tests

### Animation Widget Check (`animation-widget-check.spec.ts`)

**Purpose**: Monitors animation coverage across PlanetSportBet In Play events.

**What it does**:
- Navigates to PlanetSportBet In Play section
- Tests each live event for animation widgets
- Reports PASS/FAIL for each event based on `animated_widget` presence
- Provides summary statistics

**Key Discovery**: 
Animations are implemented via `animated_widget` elements containing iframes with 3D sports visualizations, NOT via `animate-svg` elements.

**Sample Output**:
```
🧠 Number of In Play events: 17
✅ PASS: Avispa Fukuoka vs Kyoto Sanga FC
❌ FAIL: Mio Biwako Kusatsu vs Grulla Moriok
✅ PASS: FC Gifu vs Nara Club

--- ANIMATION RESULTS ---
Live events: 17
Live events with animations: 8
Live events without animations: 9
```

**How to Run**:
```bash
# Run with browser visible
npx playwright test tests/planetsportbet/animation-widget-check.spec.ts --headed

# Run in background
npx playwright test tests/planetsportbet/animation-widget-check.spec.ts
```

**Performance**:
- Execution time: ~50 seconds for typical event loads
- Handles 14-22 events depending on availability
- May timeout on very large event lists (20+ events)

**Verified Examples**:
- ✅ **Avispa Fukuoka vs Kyoto Sanga FC**: Always PASS (has animated_widget)
- ❌ **Mio Biwako Kusatsu vs Grulla Moriok**: Always FAIL (no animated_widget)

## Future Test Ideas

Additional tests that could be added to this folder:
- Event page load time monitoring
- Betting odds accuracy checks
- Live score updates verification
- Mobile responsiveness tests
- Accessibility compliance checks
