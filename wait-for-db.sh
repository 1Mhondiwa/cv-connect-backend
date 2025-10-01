#!/bin/bash
# wait-for-db.sh

set -e

HOST="${DB_HOST:-db}"
PORT="${DB_PORT:-5432}"

echo "Waiting for database at $HOST:$PORT..."

# Loop until pg_isready succeeds
until pg_isready -h "$HOST" -p "$PORT"; do
  echo "Database is unavailable, waiting 2 seconds..."
  sleep 2
done

echo "Database is ready! Starting app..."

# Execute the command passed as arguments
exec "$@"
