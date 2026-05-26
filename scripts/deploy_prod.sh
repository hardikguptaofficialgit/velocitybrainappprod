#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f ".env.prod" ]]; then
  echo ".env.prod not found in $ROOT_DIR" >&2
  exit 1
fi

# Compose v2 plugin: docker compose --env-file
# Compose v1 binary: docker-compose --env-file (1.28+)
# Legacy: copy .env.prod -> .env for ${VAR} interpolation in compose file
if docker compose version >/dev/null 2>&1; then
  docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
elif docker-compose version >/dev/null 2>&1; then
  if docker-compose --help 2>&1 | grep -q -- '--env-file'; then
    docker-compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
  else
    echo "Using .env symlink for compose variable substitution (legacy docker-compose)..."
    cp .env.prod .env
    docker-compose -f docker-compose.prod.yml up -d --build
  fi
else
  echo "Neither 'docker compose' nor 'docker-compose' found." >&2
  exit 1
fi
