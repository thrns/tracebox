#!/bin/bash
set -e

CLOUD_RUN_PORT=${PORT:-8080}

# If WORKER_URL is already set (separate Cloud Run service), start Next.js only.
# Otherwise start the co-located worker for local dev / docker-compose.
if [ -z "$WORKER_URL" ]; then
  echo "[start.sh] No WORKER_URL — starting co-located worker on port 3001"
  env -u PORT WORKER_PORT=3001 npx tsx worker/index.ts &
  WORKER_PID=$!

  echo "[start.sh] Waiting for worker to be ready..."
  for i in $(seq 1 60); do
    if curl -sf http://127.0.0.1:3001/health >/dev/null 2>&1; then
      echo "[start.sh] Worker is ready"
      break
    fi
    if ! kill -0 $WORKER_PID 2>/dev/null; then
      echo "[start.sh] Worker process died, exiting"
      exit 1
    fi
    sleep 1
  done
  if ! curl -sf http://127.0.0.1:3001/health >/dev/null 2>&1; then
    echo "[start.sh] Worker failed to become ready in time"
    kill $WORKER_PID 2>/dev/null || true
    exit 1
  fi

  export WORKER_URL="http://127.0.0.1:3001"
else
  echo "[start.sh] Using external worker: $WORKER_URL"
  WORKER_PID=""
fi

echo "[start.sh] Starting Next.js on port $CLOUD_RUN_PORT (WORKER_URL=$WORKER_URL)"
PORT=$CLOUD_RUN_PORT HOSTNAME=0.0.0.0 npm start &
APP_PID=$!

wait $APP_PID
EXIT_CODE=$?
echo "[start.sh] Next.js exited with code $EXIT_CODE — shutting down"
[ -n "$WORKER_PID" ] && kill $WORKER_PID 2>/dev/null || true
exit $EXIT_CODE
