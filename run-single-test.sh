#!/bin/bash

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
echo "  6. StarSports Cricket"
echo "  7. StarSports Football"
echo "  8. StarSports Tennis"
echo "  9. StarSports NFL"
echo " 10. Vodacom Comprehensive"
echo " 11. Vodacom Quick"
echo ""
read -p "Enter number (1-11): " choice

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
        npm run test:starsports:cricket
        ;;
    7)
        npm run test:starsports:football
        ;;
    8)
        npm run test:starsports:tennis
        ;;
    9)
        npm run test:starsports:nfl
        ;;
    10)
        npm run test:vodacom:comprehensive
        ;;
    11)
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
