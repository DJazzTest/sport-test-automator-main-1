#!/bin/bash

# Check dependencies first
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/check-dependencies.sh" ]; then
    if ! bash "$SCRIPT_DIR/check-dependencies.sh"; then
        echo ""
        echo "Please install missing dependencies and try again."
        exit 1
    fi
    echo ""
fi

echo "========================================"
echo "  Running All Tests"
echo "========================================"
echo ""
echo "This will run all automated tests."
echo "Please wait, this may take 5-10 minutes..."
echo ""

npm run test:all

echo ""
echo "========================================"
echo "  Tests Complete!"
echo "========================================"
echo ""
