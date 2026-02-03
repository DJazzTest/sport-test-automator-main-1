#!/usr/bin/env bash
# Check HomeBrew and common dependencies for web + iOS/Android automation.
# Run from project root: ./scripts/check-homebrew-automation.sh

set -e
cd "$(dirname "$0")/.."
ERRORS=0

echo "========================================"
echo "  HomeBrew & automation dependencies"
echo "========================================"
echo ""

# --- HomeBrew ---
if ! command -v brew &>/dev/null; then
  echo "❌ HomeBrew is not installed."
  echo "   Install: https://brew.sh"
  echo "   /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
  echo ""
  ERRORS=$((ERRORS + 1))
else
  echo "✅ HomeBrew: $(brew --version | head -1)"
fi

# --- Web automation ---
echo ""
echo "--- Web automation ---"
if ! command -v node &>/dev/null; then
  echo "❌ Node.js not found (required for Playwright)."
  echo "   Install: brew install node"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ Node.js: $(node --version)"
fi

if ! command -v npx &>/dev/null; then
  echo "❌ npx not found."
  ERRORS=$((ERRORS + 1))
else
  echo "✅ npx available"
fi

if [ -d "node_modules" ]; then
  echo "✅ node_modules present"
  if npx playwright --version &>/dev/null; then
    echo "✅ Playwright: $(npx playwright --version 2>/dev/null | head -1)"
  else
    echo "⚠️  Playwright not installed. Run: npx playwright install"
  fi
else
  echo "⚠️  No node_modules. Run: npm install"
fi

# Chromium for Playwright (browsers are installed by `npx playwright install`)
if [ -d "$HOME/Library/Caches/ms-playwright" ] 2>/dev/null || [ -d "$HOME/.cache/ms-playwright" ] 2>/dev/null; then
  echo "✅ Playwright browser cache found (Chromium/Firefox/WebKit)"
else
  echo "⚠️  Playwright browsers may not be installed. Run: npx playwright install chromium"
fi

# --- iOS automation ---
echo ""
echo "--- iOS automation ---"
if ! xcode-select -p &>/dev/null; then
  echo "❌ Xcode Command Line Tools not installed (needed for iOS simulators/build)."
  echo "   Install: xcode-select --install"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ Xcode CLI: $(xcode-select -p)"
fi

if command -v xcrun &>/dev/null; then
  echo "✅ xcrun available (iOS simulators)"
else
  echo "⚠️  xcrun not found (full Xcode may be needed for iOS)"
fi

# Optional: ios-deploy for real devices
if command -v ios-deploy &>/dev/null; then
  echo "✅ ios-deploy: $(ios-deploy --version 2>/dev/null | head -1 || echo 'installed')"
else
  echo "ℹ️  ios-deploy not installed (optional, for real iOS devices). brew install ios-deploy"
fi

# Optional: Appium for native iOS/Android app automation
if command -v appium &>/dev/null; then
  echo "✅ Appium: $(appium --version 2>/dev/null || echo 'installed')"
else
  echo "ℹ️  Appium not installed (optional). brew install appium"
fi

# --- Android automation ---
echo ""
echo "--- Android automation ---"
if command -v adb &>/dev/null; then
  echo "✅ adb: $(adb version 2>/dev/null | head -1 || echo 'installed')"
else
  echo "⚠️  adb not found (Android Debug Bridge)."
  echo "   Install Android Studio or: brew install --cask android-platform-tools"
fi

if [ -n "$ANDROID_HOME" ] || [ -n "$ANDROID_SDK_ROOT" ]; then
  echo "✅ ANDROID_HOME or ANDROID_SDK_ROOT is set"
else
  echo "ℹ️  ANDROID_HOME not set (required for Android emulator/SDK). Set after installing Android Studio."
fi

if command -v java &>/dev/null; then
  echo "✅ Java: $(java -version 2>&1 | head -1)"
else
  echo "ℹ️  Java not in PATH (optional for Android/Appium). brew install openjdk"
fi

echo ""
echo "========================================"
if [ $ERRORS -gt 0 ]; then
  echo "❌ Some required dependencies are missing (see above)."
  exit 1
else
  echo "✅ Required items present. Optional items marked with ℹ️."
  exit 0
fi
