#!/bin/bash
#
# HotelOS Database Backfill Script
# =================================
# This script installs dependencies, runs Prisma migrations,
# and executes the data backfill script.
#
# Usage:
#   ./run-backfill.sh [--dry-run] [--verbose]
#
# Options:
#   --dry-run   Preview changes without applying them
#   --verbose   Show detailed output
#
# Environment Variables:
#   DATABASE_URL - PostgreSQL connection string (required)
#

set -e  # Exit on error
set -o pipefail  # Exit on pipe failure

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(dirname "$SCRIPT_DIR")"

# Parse arguments
DRY_RUN=""
VERBOSE=""
for arg in "$@"; do
  case $arg in
    --dry-run)
      DRY_RUN="--dry-run"
      ;;
    --verbose)
      VERBOSE="--verbose"
      ;;
  esac
done

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  HotelOS Database Backfill Runner"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Check for required environment variables
if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}Error: DATABASE_URL environment variable is not set${NC}"
  echo "Please set DATABASE_URL to your PostgreSQL connection string"
  exit 1
fi

echo -e "${BLUE}→ Working directory: ${API_DIR}${NC}"
cd "$API_DIR"

# Step 1: Install dependencies
echo ""
echo -e "${YELLOW}Step 1: Installing dependencies...${NC}"
if [ -f "package.json" ]; then
  npm install --legacy-peer-deps
  echo -e "${GREEN}✓ Dependencies installed${NC}"
else
  echo -e "${RED}✗ package.json not found in ${API_DIR}${NC}"
  exit 1
fi

# Step 2: Generate Prisma client
echo ""
echo -e "${YELLOW}Step 2: Generating Prisma client...${NC}"
npx prisma generate
echo -e "${GREEN}✓ Prisma client generated${NC}"

# Step 3: Run database migrations
echo ""
echo -e "${YELLOW}Step 3: Running database migrations...${NC}"
npx prisma migrate deploy
echo -e "${GREEN}✓ Migrations applied${NC}"

# Step 4: Run backfill script
echo ""
echo -e "${YELLOW}Step 4: Running data backfill...${NC}"
if [ -n "$DRY_RUN" ]; then
  echo -e "${BLUE}Running in dry-run mode${NC}"
fi

npx tsx scripts/backfill-data.ts $DRY_RUN $VERBOSE

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Backfill completed successfully!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
