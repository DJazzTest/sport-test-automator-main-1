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
echo "  Run a Single Test"
echo "========================================"
echo ""
echo "Which test would you like to run?"
echo ""
echo "  1. Cricket (PSG)"
echo "  2. Football (PSG)"
echo "  3. Tennis (PSG)"
echo "  4. NFL (PSG)"
echo "  5. PlanetF1"
echo "  6. PlanetRugby"
echo "  7. StarSports Cricket"
echo "  8. StarSports Football"
echo "  9. StarSports Tennis"
echo " 10. StarSports NFL"
echo " 11. Vodacom Comprehensive"
echo " 12. Vodacom Quick"
echo ""
read -p "Enter number (1-12): " choice

case $choice in
    1)
        npm run test:cricket
        ;;
    2)
        npm run test:football
        ;;
    3)
        npm run test:tennis
        ;;
    4)
        npm run test:nfl
        ;;
    5)
        npm run test:planetf1
        ;;
    6)
        npm run test:planetrugby
        ;;
    7)
        npm run test:starsports:cricket
        ;;
    8)
        npm run test:starsports:football
        ;;
    9)
        npm run test:starsports:tennis
        ;;
    10)
        npm run test:starsports:nfl
        ;;
    11)
        npm run test:vodacom:comprehensive
        ;;
    12)
        npm run test:vodacom:quick
        ;;
    *)
        echo "Invalid choice!"
        exit 1
        ;;
esac

echo ""
echo "========================================"
echo "  Test Complete!"
echo "========================================"
echo ""
