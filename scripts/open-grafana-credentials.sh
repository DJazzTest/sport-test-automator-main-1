#!/bin/bash
# Opens the exact pages where you copy Grafana Cloud Prometheus credentials.

open "https://grafana.com/auth/sign-in?to=%2Forgs%2Fdavidjarrett001"
echo ""
echo "After login:"
echo "1. Open your stack (davidjarrett001)"
echo "2. Click Prometheus → Details"
echo "3. Copy: Remote write URL, User (numeric ID), and create an API token (glsa_...)"
echo "4. Run: npm run setup:grafana-cloud"
echo ""
