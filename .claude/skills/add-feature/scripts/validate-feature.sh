#!/bin/bash
# validate-feature.sh
# Run this script to validate a new feature is correctly wired up.
# Usage: bash scripts/validate-feature.sh <feature-name>
# Output: Summary of checks passed/failed

FEATURE=${1:-""}
ERRORS=0

echo "=== FinanceManager Feature Validation ==="

# 1. TypeScript check
echo ""
echo "1. TypeScript compilation..."
npx tsc --noEmit 2>&1 | tail -20
if [ ${PIPESTATUS[0]} -ne 0 ]; then
  echo "   FAIL: TypeScript errors found"
  ERRORS=$((ERRORS + 1))
else
  echo "   PASS: No TypeScript errors"
fi

# 2. ESLint
echo ""
echo "2. ESLint..."
npm run lint 2>&1 | tail -10
if [ ${PIPESTATUS[0]} -ne 0 ]; then
  echo "   FAIL: ESLint errors found"
  ERRORS=$((ERRORS + 1))
else
  echo "   PASS: No lint errors"
fi

# 3. Tests
echo ""
echo "3. Running tests..."
npm run test -- --run 2>&1 | tail -20
if [ ${PIPESTATUS[0]} -ne 0 ]; then
  echo "   FAIL: Tests failing"
  ERRORS=$((ERRORS + 1))
else
  echo "   PASS: All tests passing"
fi

# 4. Check @/ imports (no relative ../../)
echo ""
echo "4. Checking path aliases..."
BAD_IMPORTS=$(grep -r "from '\.\./.*/src/" src/ 2>/dev/null | wc -l)
if [ "$BAD_IMPORTS" -gt 0 ]; then
  echo "   WARN: Found $BAD_IMPORTS potential bad imports (should use @/)"
else
  echo "   PASS: Path aliases look correct"
fi

echo ""
echo "=== Total errors: $ERRORS ==="
if [ $ERRORS -eq 0 ]; then
  echo "Feature validation PASSED"
  exit 0
else
  echo "Feature validation FAILED — fix errors above"
  exit 1
fi
