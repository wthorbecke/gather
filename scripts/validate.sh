#!/bin/bash

# Validation script - run before committing changes
# Usage: ./scripts/validate.sh

set -e

echo "🔍 Running validation checks..."
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track failures
FAILED=0

# 1. Type checking
echo "📝 Running TypeScript type check..."
if npx tsc --noEmit 2>/dev/null; then
    echo -e "${GREEN}✓ TypeScript check passed${NC}"
else
    echo -e "${RED}✗ TypeScript check failed${NC}"
    FAILED=1
fi
echo ""

# 2. Linting
echo "🔎 Running linter..."
if npm run lint 2>/dev/null; then
    echo -e "${GREEN}✓ Lint check passed${NC}"
else
    echo -e "${YELLOW}⚠ Lint check had warnings/errors${NC}"
fi
echo ""

# 3. Build check
echo "🏗️  Running build..."
if npm run build 2>/dev/null; then
    echo -e "${GREEN}✓ Build successful${NC}"
else
    echo -e "${RED}✗ Build failed${NC}"
    FAILED=1
fi
echo ""

# 4. E2E Tests
echo "🧪 Running E2E tests..."
if npm test 2>/dev/null; then
    echo -e "${GREEN}✓ All tests passed${NC}"
else
    echo -e "${RED}✗ Tests failed${NC}"
    FAILED=1
fi
echo ""

# 5. Check if tests exist for changed src files
echo "📋 Checking test coverage for changed files..."
CHANGED_SRC=$(git diff --cached --name-only | grep "^src/" | wc -l | tr -d ' ')
CHANGED_TESTS=$(git diff --cached --name-only | grep "^e2e/" | wc -l | tr -d ' ')

if [ "$CHANGED_SRC" -gt 0 ] && [ "$CHANGED_TESTS" -eq 0 ]; then
    echo -e "${YELLOW}⚠ You modified $CHANGED_SRC source file(s) but no test files.${NC}"
    echo "   Consider adding tests for your changes in e2e/"
else
    echo -e "${GREEN}✓ Test coverage check passed${NC}"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! Ready to commit.${NC}"
    exit 0
else
    echo -e "${RED}❌ Some checks failed. Please fix before committing.${NC}"
    exit 1
fi
