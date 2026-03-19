#!/bin/bash
set -e

current=$(node -p "require('./package.json').version")
echo "Current version: $current"
echo ""
echo "Pick a bump type:"
echo "  1) patch  ($(echo $current | awk -F. '{print $1"."$2"."$3+1}'))"
echo "  2) minor  ($(echo $current | awk -F. '{print $1"."$2+1".0"}'))"
echo "  3) major  ($(echo $current | awk -F. '{print $1+1".0.0"}'))"
echo ""
read -p "Enter 1, 2, or 3: " choice

case $choice in
  1) bump="patch" ;;
  2) bump="minor" ;;
  3) bump="major" ;;
  *) echo "Invalid choice"; exit 1 ;;
esac

npm version $bump -m "Release v%s"
new=$(node -p "require('./package.json').version")

echo ""
echo "Tagged v$new. Pushing to origin..."
git push origin main --tags

echo ""
echo "Done. GitHub Actions will build and publish the release."
echo "https://github.com/seanryy/dex-app/releases"
