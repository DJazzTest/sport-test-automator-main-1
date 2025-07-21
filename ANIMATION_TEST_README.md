# PlanetSportBet Animation Detection Test

## Overview
This test monitors animation coverage across PlanetSportBet In Play events by detecting `animated_widget` elements that contain 3D sports visualization iframes.

## Key Discovery
Animations on PlanetSportBet are implemented via `animated_widget` elements containing iframes with 3D sports widgets, NOT via `animate-svg` elements as initially expected.

## Test Results Summary
- **Test File**: `tests/planetsportbet/animation-widget-check.spec.ts`
- **Detection Method**: Looks for `.animated_widget` elements on event pages
- **Current Coverage**: ~47% of live events have animations (8 out of 17 events)
- **Execution Time**: ~60 seconds for full test run

## How to Run

### Run the Animation Detection Test
```bash
npx playwright test tests/planetsportbet/animation-widget-check.spec.ts --headed
```

### Run in Headless Mode
```bash
npx playwright test tests/planetsportbet/animation-widget-check.spec.ts
```

### Run All PlanetSportBet Tests
```bash
npx playwright test tests/planetsportbet/
```

## Sample Output
```
🧠 Number of In Play events: 17
✅ PASS: Avispa Fukuoka vs Kyoto Sanga FC
❌ FAIL: Mio Biwako Kusatsu vs Grulla Moriok
✅ PASS: FC Gifu vs Nara Club
...

--- ANIMATION RESULTS ---
Live events: 17
Live events with animations: 8
Live events without animations: 9
```

## Test Logic
1. **Navigate to PlanetSportBet In Play section**
2. **For each event:**
   - Click into the event page
   - Wait 3 seconds for widgets to load
   - Check for `.animated_widget` elements
   - Report PASS (has animation) or FAIL (no animation)
   - Return to In Play list via clicking "In Play" link
3. **Generate summary report** with total counts

## Key Features
- ✅ **Accurate Detection**: Correctly identifies events with/without animations
- ✅ **Reliable Navigation**: Uses In Play link clicks instead of browser back
- ✅ **Clean Output**: Simple PASS/FAIL results with summary counts
- ✅ **Production Ready**: Stable execution with proper error handling

## Verified Examples
- **Avispa Fukuoka vs Kyoto Sanga FC**: ✅ PASS (has animated_widget)
- **Mio Biwako Kusatsu vs Grulla Moriok**: ❌ FAIL (no animated_widget)

## Technical Details
- **Animation Element**: `.animated_widget` (contains iframe with 3D sports visualization)
- **Wait Time**: 3 seconds after page load for widgets to initialize
- **Navigation**: Direct In Play link clicks for reliable page transitions
- **Browser**: Runs in headed mode by default for visual monitoring

## Troubleshooting
If the test fails to find events or has navigation issues:
1. Check that PlanetSportBet is accessible
2. Verify In Play events are available
3. Ensure stable internet connection for widget loading
4. Try running with longer wait times if widgets load slowly

## Future Enhancements
- Add screenshot capture for events with animations
- Export results to JSON/CSV format
- Add filtering by sport type
- Monitor animation load times
