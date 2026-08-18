#!/bin/bash
# Launches our OWN Python http.server and OUR OWN headless Chrome devtools instance
# (exact PIDs recorded). We only ever kill the processes we start.
set -e
PORT=8123
DBPORT=9333
DIR=/tmp/tpt-harness
rm -rf "$DIR"; mkdir -p "$DIR"
cd /Users/hmarquardt/trashpandaterror
python3 -m http.server $PORT --bind 127.0.0.1 >"$DIR/http.log" 2>&1 &
echo $! >"$DIR/http.pid"
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --no-first-run --no-default-browser-check --disable-background-networking \
  --use-angle=swiftshader --enable-unsafe-swiftshader --hide-scrollbars \
  --remote-debugging-port=$DBPORT --user-data-dir="$DIR/chrome" \
  --window-size=1280,720 about:blank \
  >"$DIR/chrome.log" 2>&1 &
echo $! >"$DIR/chrome.pid"
for i in $(seq 1 20); do
  if curl -s "http://127.0.0.1:$DBPORT/json/version" >/dev/null 2>&1; then break; fi
  sleep 0.5
done
echo "ready http pid=$(cat "$DIR/http.pid") chrome pid=$(cat "$DIR/chrome.pid")"