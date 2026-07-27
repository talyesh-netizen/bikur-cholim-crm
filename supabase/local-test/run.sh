#!/usr/bin/env bash
# Rebuilds the local test database from scratch and applies:
#   1. the auth stub (see 00_auth_stub.sql)
#   2. every real migration in supabase/migrations, in order
#   3. fictional demo data (01_demo_data.sql)
#   4. the RLS behavior checks (02_rls_checks.sql), which print PASS/FAIL
#
# See README.md in this folder for what this is and isn't.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DB_NAME="bikur_cholim_dev"
PSQL="psql -v ON_ERROR_STOP=1 -U postgres -d $DB_NAME"

echo "==> Recreating database $DB_NAME"
psql -U postgres -c "DROP DATABASE IF EXISTS $DB_NAME;"
psql -U postgres -c "CREATE DATABASE $DB_NAME;"

echo "==> Applying auth stub"
$PSQL -f "$REPO_ROOT/supabase/local-test/00_auth_stub.sql"

echo "==> Applying migrations"
for f in "$REPO_ROOT"/supabase/migrations/*.sql; do
  echo "    - $(basename "$f")"
  $PSQL -f "$f"
done

echo "==> Loading fictional demo data"
$PSQL -f "$REPO_ROOT/supabase/local-test/01_demo_data.sql"

echo "==> Running RLS/behavior checks"
$PSQL -f "$REPO_ROOT/supabase/local-test/02_rls_checks.sql"

echo "==> Done."
