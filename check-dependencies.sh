#!/bin/bash

echo "========================================"
echo "  Checking Dependencies..."
echo "========================================"
echo ""

ERRORS=0

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ ERROR: Node.js is not installed!"
    echo ""
    echo "   Please install Node.js:"
    echo "   1. Go to https://nodejs.org/"
    echo "   2. Download the LTS version"
    echo "   3. Install it"
    echo "   4. Close and reopen Terminal"
    echo "   5. Run this command again"
    echo ""
    ERRORS=$((ERRORS + 1))
else
    NODE_VERSION=$(node --version)
    echo "✅ Node.js is installed: $NODE_VERSION"
    
    # Check if Node.js version is 18 or higher
    NODE_MAJOR=$(echo "$NODE_VERSION" | sed 's/v\([0-9]*\).*/\1/')
    if [ "$NODE_MAJOR" -lt 18 ]; then
        echo "⚠️  WARNING: Node.js version is $NODE_VERSION"
        echo "   Recommended: Node.js 18 or higher"
        echo "   Current version may work, but 18+ is recommended"
        echo ""
    fi
fi

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ ERROR: npm is not installed!"
    echo ""
    echo "   npm usually comes with Node.js."
    echo "   If you just installed Node.js, try:"
    echo "   1. Close and reopen Terminal"
    echo "   2. Run this command again"
    echo ""
    ERRORS=$((ERRORS + 1))
else
    NPM_VERSION=$(npm --version)
    echo "✅ npm is installed: $NPM_VERSION"
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo ""
    echo "⚠️  WARNING: Dependencies not installed"
    echo "   Run this command first:"
    echo "   npm install"
    echo ""
    ERRORS=$((ERRORS + 1))
else
    echo "✅ Dependencies installed (node_modules found)"
fi

# Check if Playwright is installed
if ! command -v npx &> /dev/null || ! npx playwright --version &> /dev/null; then
    echo ""
    echo "⚠️  WARNING: Playwright may not be installed"
    echo "   Run this command to install:"
    echo "   npx playwright install"
    echo ""
    ERRORS=$((ERRORS + 1))
else
    PLAYWRIGHT_VERSION=$(npx playwright --version 2>/dev/null | head -1 || echo "installed")
    echo "✅ Playwright is installed: $PLAYWRIGHT_VERSION"
fi

echo ""
echo "========================================"

if [ $ERRORS -gt 0 ]; then
    echo "❌ Some dependencies are missing!"
    echo ""
    echo "Quick fix - Run this command:"
    echo "  npm run test:setup"
    echo ""
    echo "This will install everything you need."
    echo ""
    exit 1
else
    echo "✅ All dependencies are ready!"
    echo ""
    exit 0
fi
