#!/bin/bash

echo "========================================"
echo "  Test Automation Setup - Mac/Linux"
echo "========================================"
echo ""
echo "This will install everything you need."
echo "Please wait, this may take a few minutes..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed!"
    echo ""
    echo "Please install Node.js first:"
    echo "1. Go to https://nodejs.org/"
    echo "2. Download the LTS version"
    echo "3. Install it"
    echo "4. Close and reopen Terminal"
    echo "5. Run this script again"
    echo ""
    exit 1
fi

echo "Step 1: Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "ERROR: Installation failed!"
    exit 1
fi

echo ""
echo "Step 2: Installing Playwright browsers..."
npx playwright install
if [ $? -ne 0 ]; then
    echo "ERROR: Playwright installation failed!"
    exit 1
fi

echo ""
echo "========================================"
echo "  Setup Complete!"
echo "========================================"
echo ""
echo "You can now run tests with:"
echo "  npm run test:all"
echo ""
