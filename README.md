# PSG Animation Tests

This repository contains automated tests for Planet Sport Group (PSG) animation functionality using **TypeScript** and **Playwright**.

## 👋 New to This? Start Here!

**For non-technical users**: See **[START_HERE.md](START_HERE.md)** - Simple 3-step guide

**For detailed setup**: See **[SIMPLE_SETUP.md](SIMPLE_SETUP.md)** - Step-by-step instructions with troubleshooting

## 🛠️ Technology Stack

- **Language**: TypeScript
- **Testing Framework**: Playwright
- **Runtime**: Node.js 18+

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

### Quick Start (One-Line Commands)

**First-time setup** (run once):
```bash
npm run test:setup
```

**Run all tests**:
```bash
npm run test:all
```

**Run specific sport tests**:
```bash
npm run test:cricket    # PSG Cricket tests only
npm run test:football   # PSG Football tests only
npm run test:tennis     # PSG Tennis tests only
npm run test:nfl        # PSG NFL tests only
npm run test:planetf1   # PlanetF1 test only
```

**Easy way to run single tests** (for non-technical users):
- **Windows**: Double-click `run-f1-test.bat` (for F1) or `run-single-test.bat` (menu to choose)
- **Mac**: Run `./run-f1-test.sh` (for F1) or `./run-single-test.sh` (menu to choose)

**Run test suites**:
```bash
npm run test:planetsports   # All PlanetSports tests
npm run test:starsports     # All StarSports tests
npm run test:dragonbet      # All DragonBet tests
npm run test:vodacom        # All Vodacom tests
npm run test:teamtalk       # All TeamTalk tests
```

**See all 28 test commands**: Check [TEST_COMMANDS.md](TEST_COMMANDS.md) for the complete list of all test files and their commands.

**Run with browser visible** (for debugging):
```bash
npm run test:all -- --headed
```

### Prerequisites
- Node.js 18+ installed
- Works on Windows, Mac, and Linux

### First-Time Installation
```bash
# Install dependencies and Playwright browsers (one-time setup)
npm run test:setup
```

### Alternative: Manual Installation
```bash
npm install
npx playwright install
```

**If tests don't run in the IDE** (e.g. `Executable doesn't exist at ... chrome-headless-shell-mac-arm64`), run **in your terminal** on this machine: `npm run test:setup` (installs Chromium for your CPU), then `npm run test:check-browsers` to confirm. See [docs/WHY_TESTS_CANT_RUN_IN_THIS_WINDOW.md](docs/WHY_TESTS_CANT_RUN_IN_THIS_WINDOW.md).

### Legacy Commands (Still Work)
```bash
# Run all tests
npm run test:playwright

# Run specific tests with full path
npx playwright test tests/specs/planetsports/PSG.cricket.Animations.spec.ts
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

This repository is configured for GitHub Actions and GitLab CI.

### GitLab CI: Run All or Individual Tests

In GitLab, go to **Build → Pipelines → New pipeline**, then set variables.

**Run all tests (including new ones):**
```
TEST_SUITE=all
```

**Run a specific suite:**
```
TEST_SUITE=starsports
TEST_SUITE=vodacom
TEST_SUITE=planetrugby
TEST_SUITE=planetf1
TEST_SUITE=teamtalk
TEST_SUITE=planetsports
TEST_SUITE=dragonbet
TEST_SUITE=dragonsports
TEST_SUITE=betwright
TEST_SUITE=unit
TEST_SUITE=common
```

**Run a single spec file:**
```
TEST_PATH=tests/specs/planetf1/Planetf1.webpages.spec.ts
```

**Optional Playwright args:**
```
EXTRA_ARGS=--project=chromium
EXTRA_ARGS=--headed
```

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