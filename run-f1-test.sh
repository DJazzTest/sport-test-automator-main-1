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
echo "  Running PlanetF1 Test"
echo "========================================"
echo ""
echo "This will run the PlanetF1 test only."
echo "Please wait..."
echo ""

npm run test:planetf1

echo ""
echo "========================================"
echo "  Test Complete!"
echo "========================================"
echo ""
