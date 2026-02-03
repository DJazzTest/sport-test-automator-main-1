# Automatic Dependency Checking

## What It Does

All test runner scripts now automatically check for missing dependencies **before** running tests. If anything is missing, you'll get clear instructions on how to fix it.

## What Gets Checked

1. **Node.js** - Required runtime
2. **npm** - Package manager (comes with Node.js)
3. **Dependencies** - Checks if `node_modules` folder exists
4. **Playwright** - Browser automation tool

## How It Works

When you run any test script:
- `run-tests.bat` / `run-tests.sh`
- `run-f1-test.bat` / `run-f1-test.sh`
- `run-single-test.bat` / `run-single-test.sh`

The script will:
1. ✅ Check all dependencies
2. ✅ Show what's installed
3. ❌ Show what's missing (with instructions)
4. ⚠️ Stop before running tests if anything is missing

## Example Output

### If Everything is Ready:
```
========================================
  Checking Dependencies...
========================================

✅ Node.js is installed: v18.17.0
✅ npm is installed: 9.6.7
✅ Dependencies installed (node_modules found)
✅ Playwright is installed: Version 1.54.1

========================================
✅ All dependencies are ready!
```

### If Something is Missing:
```
========================================
  Checking Dependencies...
========================================

❌ ERROR: Node.js is not installed!

   Please install Node.js:
   1. Go to https://nodejs.org/
   2. Download the LTS version
   3. Install it
   4. Close and reopen Terminal
   5. Run this command again

========================================
❌ Some dependencies are missing!

Quick fix - Run this command:
  npm run test:setup

This will install everything you need.
```

## Manual Check

You can also check dependencies manually:

**Windows:**
```cmd
check-dependencies.bat
```

**Mac/Linux:**
```bash
./check-dependencies.sh
```

**Or using npm:**
```bash
npm run test:check
```

## HomeBrew & iOS/Android automation (macOS)

For web + iOS/Android automation dependencies (HomeBrew, Xcode CLI, adb, etc.):

```bash
./scripts/check-homebrew-automation.sh
```

This checks:

- **Web:** HomeBrew, Node.js, npx, Playwright, Playwright browser cache (Chromium/Firefox/WebKit).
- **iOS:** Xcode Command Line Tools, xcrun; optional: ios-deploy, Appium.
- **Android:** adb (Android Debug Bridge), ANDROID_HOME; optional: Java/OpenJDK.

Install suggestions:

- **Android (adb):** `brew install --cask android-platform-tools`
- **iOS (real device):** `brew install ios-deploy`
- **Appium (native mobile):** `brew install appium`

## Benefits

- ✅ **No more confusing errors** - Clear messages about what's missing
- ✅ **Automatic detection** - Checks before every test run
- ✅ **Helpful instructions** - Tells you exactly how to fix issues
- ✅ **Saves time** - Catches problems before tests start

## First Time Setup

If dependencies are missing, the script will tell you to run:

```bash
npm run test:setup
```

This installs everything automatically!
