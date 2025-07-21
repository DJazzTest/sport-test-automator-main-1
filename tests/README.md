# Test Organization

This folder contains automated tests organized by website/URL for easy management and scalability.

## Folder Structure

```
tests/
├── planetsportbet/          # PlanetSportBet website tests
│   └── animation-widget-check.spec.ts    # Animation coverage test
├── [future-site]/           # Future website tests can be added here
│   └── [test-name].spec.ts
└── README.md               # This file
```

## Running Tests

### Run All Tests
```bash
npx playwright test
```

### Run Tests for Specific Site
```bash
# PlanetSportBet tests only
npx playwright test tests/planetsportbet/

# Future site tests (example)
npx playwright test tests/[site-name]/
```

### Run Specific Test
```bash
# Animation widget check
npx playwright test tests/planetsportbet/animation-widget-check.spec.ts --headed
```

## Adding New Tests

To add tests for a new website:

1. **Create a new folder** for the site:
   ```bash
   mkdir tests/new-site-name
   ```

2. **Add your test files** in that folder:
   ```bash
   tests/new-site-name/
   ├── feature1.spec.ts
   ├── feature2.spec.ts
   └── README.md  # Optional: site-specific documentation
   ```

3. **Follow naming conventions**:
   - Use descriptive test names
   - Include `.spec.ts` extension
   - Use kebab-case for file names

## Current Tests

### PlanetSportBet
- **animation-widget-check.spec.ts**: Monitors animation coverage across In Play events
  - Detects `animated_widget` elements containing 3D sports visualizations
  - Reports PASS/FAIL for each event
  - Provides summary statistics (total events, events with animations)

## Test Configuration

Tests use the global Playwright configuration from `playwright.config.ts` in the root directory.

## Best Practices

- Keep tests organized by website/domain
- Use descriptive test names and folder names
- Include documentation for complex test logic
- Maintain consistent naming conventions
- Clean up debug/temporary test files regularly
