#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f ".env.prod" ]]; then
  echo ".env.prod not found in $ROOT_DIR" >&2
  exit 1
fi

docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
