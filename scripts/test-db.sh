#!/usr/bin/env bash
# Apply the migration to a throwaway Postgres and run the SQL tests.
# Needs Docker. Leaves nothing behind.
set -euo pipefail

CONTAINER=pafd-pg-test
cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup

docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=pafd postgres:16-alpine >/dev/null
for _ in $(seq 1 60); do
  docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done

# Supabase provides these roles; a bare Postgres does not.
docker exec -i "$CONTAINER" psql -U postgres -q -v ON_ERROR_STOP=1 <<'SQL'
create role anon nologin;
create role authenticated nologin;
SQL

docker exec -i "$CONTAINER" psql -U postgres -q -v ON_ERROR_STOP=1 < supabase/migrations/0001_init.sql
docker exec -i "$CONTAINER" psql -U postgres -q -v ON_ERROR_STOP=1 < supabase/tests/resolution.test.sql
echo "database tests passed"
