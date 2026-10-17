#!/bin/zsh
# Stop everything scripts/start.sh started: Expo, the API, and the database.
# Your data is kept (it lives in a Docker volume).
source ~/.zprofile
ROOT="${0:A:h:h}"

pkill -f "expo start" && echo "▸ Stopped Expo"
pkill -f "ProgressionApiApplication|gradlew bootRun" && echo "▸ Stopped the API"
if colima status >/dev/null 2>&1; then
  (cd "$ROOT/backend" && docker compose down >/dev/null 2>&1) && echo "▸ Stopped the database"
fi
echo "✓ Everything is stopped"
