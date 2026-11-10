#!/bin/bash
cd "$(dirname "$0")/.."
mkdir -p logs
for c in "$@"; do
  for attempt in 1 2; do
    rm -rf frames/$c; node capture/run.js $c > logs/$c.log 2>&1
    n=$(ls frames/$c 2>/dev/null | grep -c jpg); echo "done $c frames=$n attempt=$attempt"
    [ -f frames/$c/sfx.json ] && break
  done
done
echo ALL_DONE
