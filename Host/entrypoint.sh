#!/bin/sh
set -e

echo "[Host Entrypoint] Starting DockWatch Host..."

# /app/data 데이터 저장용 디렉터리 자동 확인 및 생성
if [ ! -d "/app/data" ]; then
  echo "[Host Entrypoint] Initializing /app/data directory..."
  mkdir -p /app/data 2>/dev/null || true
fi

exec "$@"
