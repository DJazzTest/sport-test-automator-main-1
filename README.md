# PSG Animation Tests

This repository contains automated tests for Planet Sport Group (PSG) animation functionality using Playwright.

## 🎯 Test Coverage

### Sports Tested
- **Football** - PSG.Football.Animations.spec.ts
- **Tennis** - PSG.Tennis.Animations.Spec.ts  
- **Cricket** - PSG.cricket.Animations.spec.ts
- **NFL** - PSG.NFL.Animations.spec.ts

### Features Tested
- Live tracker functionality
- 3D animation widget loading
- Iframe content verification
- Tournament/competition context
- Detailed failure reporting

## 🚀 Running Tests

### Prerequisites
- Node.js 18+
- Playwright installed

### Installation
```bash
npm install
npx playwright install
```

### Run All Tests
```bash
npm run test:playwright
```

### Run Specific Sport Tests
```bash
# Football
npx playwright test tests/specs/planetsports/PSG.Football.Animations.spec.ts

# Tennis
npx playwright test tests/specs/planetsports/PSG.Tennis.Animations.Spec.ts

# Cricket
npx playwright test tests/specs/planetsports/PSG.cricket.Animations.spec.ts

# NFL
npx playwright test tests/specs/planetsports/PSG.NFL.Animations.spec.ts
```

### Run with Browser Visible
```bash
npx playwright test --headed
```

## 🔧 Configuration

- **Base URL**: https://planetsportbet.com/
- **Browsers**: Chromium, Firefox, WebKit
- **Timeout**: 60 seconds
- **Retries**: 0

## 📊 Test Results

Tests provide detailed reporting including:
- ✅ Pass/Fail status for each event
- 🔴 Detailed failure descriptions
- 🏆 Tournament/competition context
- 🔧 Technical debugging information
- 📈 Success rates per sport

## 🏗️ CI/CD

This repository is configured for CircleCI with:
- Automated test execution
- Multi-browser testing
- Test result reporting
- Screenshot capture on failures

## 📝 Test Logic

### Live Tracker Detection
1. Check if Live tracker is already open
2. If not open, click to activate
3. Verify window expansion
4. Check for animation iframe

### Animation Verification
1. Wait for `.animated_widget` div
2. Verify iframe presence
3. Check iframe src contains `widgets.thesports01.com`
4. Verify iframe visibility and accessibility

### Failure Reporting
- Clear red cross indicators (❌)
- Specific failure descriptions
- Tournament/competition context
- Technical debugging details
- Impact assessment for users