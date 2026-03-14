#!/bin/bash
set -e

# ============================================================
# counselor-rooms — full setup script
# הרץ פעם אחת אחרי clone כדי להכין את כל הסביבה
# ============================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${BLUE}[setup]${NC} $1"; }
ok()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
fail() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# ── 1. בדיקת Node ────────────────────────────────────────────
log "בודק גרסת Node..."
NODE_VER=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1)
[ -z "$NODE_VER" ] && fail "Node.js לא מותקן. התקן Node 18+"
[ "$NODE_VER" -lt 18 ] && fail "נדרש Node 18+. גרסה נוכחית: $(node -v)"
ok "Node $(node -v)"

# ── 2. בדיקת .env ────────────────────────────────────────────
log "בודק קובץ .env..."
if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    cp .env.example .env
    warn ".env נוצר מ-.env.example — ערוך אותו עם פרטי Supabase לפני שממשיכים!"
    warn "  DATABASE_URL — Transaction pooler (port 6543)"
    warn "  DIRECT_URL   — Direct connection (port 5432)"
    warn "  ADMIN_PASSWORD — סיסמת פאנל המנהל"
    echo ""
    read -p "לחץ Enter אחרי שערכת את .env..." _
  else
    fail "לא נמצא .env ולא .env.example"
  fi
else
  ok ".env קיים"
fi

# בדיקה שה-env vars מוגדרים
source .env 2>/dev/null || true
[ -z "$DATABASE_URL" ] && fail "DATABASE_URL לא מוגדר ב-.env"
[ -z "$DIRECT_URL" ]   && fail "DIRECT_URL לא מוגדר ב-.env"
[ -z "$ADMIN_PASSWORD" ] && warn "ADMIN_PASSWORD לא מוגדר — פאנל המנהל לא יעבוד"
ok "משתני סביבה תקינים"

# ── 3. התקנת תלויות root (Prisma) ───────────────────────────
log "מתקין תלויות root (Prisma)..."
npm install --silent
ok "root dependencies"

# ── 4. Prisma generate ───────────────────────────────────────
log "מריץ prisma generate..."
npx prisma generate --schema=prisma/schema.prisma
ok "Prisma client נוצר"

# ── 5. מיגרציה ──────────────────────────────────────────────
log "מריץ מיגרציית DB..."
npx prisma migrate deploy --schema=prisma/schema.prisma
ok "מיגרציה הושלמה"

# ── 6. Seed ──────────────────────────────────────────────────
log "מריץ seed (חדרים + מטפלים לדוגמה)..."
node prisma/seed.js
ok "Seed הושלם"

# ── 7. התקנת תלויות client ──────────────────────────────────
log "מתקין תלויות client..."
cd client && npm install --silent && cd ..
ok "client dependencies"

# ── 8. בדיקת Netlify CLI ─────────────────────────────────────
echo ""
if command -v netlify &> /dev/null; then
  ok "Netlify CLI מותקן: $(netlify --version)"
  echo ""
  echo -e "${GREEN}══════════════════════════════════════${NC}"
  echo -e "${GREEN}  הכל מוכן! הרץ:  netlify dev${NC}"
  echo -e "${GREEN}══════════════════════════════════════${NC}"
else
  warn "Netlify CLI לא מותקן. להתקנה:"
  echo "  npm install -g netlify-cli"
  echo ""
  echo -e "${GREEN}══════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  אחרי ההתקנה הרץ:  netlify dev${NC}"
  echo -e "${GREEN}══════════════════════════════════════════════════════${NC}"
fi
echo ""
