#!/usr/bin/env bash
# Runs every check. Usage: npm test   (needs python3 with openpyxl, python-docx, pypdf for the export checks)
set -euo pipefail
cd "$(dirname "$0")/.."
step() { printf '\n== %s\n' "$1"; }

step "typecheck";            npx tsc --noEmit -p .
step "persona generator";    node scripts/test-personagen.mjs
step "country data";         node scripts/test-countries.mjs
step "SSRF-safe fetch";      node scripts/test-safefetch.mjs
step "studies";              node scripts/test-studies.mjs
step "question importers";   node --experimental-strip-types scripts/test-importers.mjs 2>&1 | grep -v -i "warning"
step "results";              node scripts/test-results.mjs
step "custom personas";     node scripts/test-custompersonas.mjs
step "report";               node scripts/test-report.mjs 2>&1 | grep -v -i "warning"
step "survey task format";   python3 -I scripts/validate-survey-task.py custom-tasks/*/

if python3 -I -c "import openpyxl, docx, pypdf" 2>/dev/null; then
  step "exports (xlsx/docx/pdf/csv)"
  OUT="$(mktemp -d)"
  node scripts/test-export.mjs "$OUT" 2>&1 | grep -v -i "warning"
  python3 -I scripts/validate-exports.py "$OUT" --no-office
  rm -rf "$OUT"
else
  echo "(skipping export validation: pip install openpyxl python-docx pypdf)"
fi
rm -rf data
echo; echo "ALL TESTS PASSED"
