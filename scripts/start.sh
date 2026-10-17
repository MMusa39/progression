#!/bin/zsh
# Start Progression for local development:
#   1. Docker (Colima), if it isn't running
#   2. the API + PostgreSQL in the background (log: /tmp/progression-api.log)
#   3. Expo in this terminal: scan the QR code with your iPhone camera
# Ctrl+C stops Expo only; run scripts/stop.sh (or `end`) to stop everything.
set -e
source ~/.zprofile
ROOT="${0:A:h:h}"
LOG=/tmp/progression-api.log
HEALTH=http://localhost:8080/actuator/health

if ! colima status >/dev/null 2>&1; then
  echo "▸ Starting Docker (Colima)…"
  colima start
fi

if curl -fs "$HEALTH" >/dev/null 2>&1; then
  echo "▸ API already running"
else
  echo "▸ Starting the API and database (log: $LOG)"
  (cd "$ROOT/backend" && nohup ./gradlew bootRun >"$LOG" 2>&1 &)
  printf "  waiting for the API"
  for i in {1..120}; do
    if curl -fs "$HEALTH" 2>/dev/null | grep -q UP; then break; fi
    if (( i > 5 )) && ! pgrep -f "gradlew bootRun|ProgressionApiApplication" >/dev/null; then
      echo "\n✗ The API stopped while starting. Last lines of $LOG:"
      tail -n 25 "$LOG"
      exit 1
    fi
    printf "."
    sleep 2
  done
  curl -fs "$HEALTH" >/dev/null 2>&1 && echo " ready" || echo "\n  (still starting; the app will connect when it's up. See $LOG)"
fi

echo "▸ Starting Expo. Scan the QR code with your iPhone camera."
cd "$ROOT/mobile"
exec npx expo start --clear
