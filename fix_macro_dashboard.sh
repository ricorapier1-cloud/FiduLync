#!/usr/bin/env bash
set -euo pipefail

echo "=================================================================="
echo "  MACROLYNC SURGICAL FIX: DASHBOARD CLOCK & MOBILE SPACING"
echo "=================================================================="

TARGET="app/components/MacroDashboard.tsx"

if [ ! -f "$TARGET" ]; then
  echo "Error: $TARGET not found!"
  exit 1
fi

# 1. Ensure live UTC clock is implemented inside MacroDashboard.tsx
# Check if useEffect for clock exists, if not, patch it in
if ! grep -q "liveClock" "$TARGET"; then
  echo "Injecting live ticking UTC clock state into MacroDashboard..."
  
  # Add liveClock state right after component declaration
  sed -i 's/export function MacroDashboard/export function MacroDashboard() {\n  const [liveClock, setLiveClock] = React.useState<string>("");\n  React.useEffect(() => {\n    const update = () => setLiveClock(new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC");\n    update();\n    const timer = setInterval(update, 1000);\n    return () => clearInterval(timer);\n  }, []);/g' "$TARGET"
fi

# 2. Replace static timestamp strings in the JSX with {liveClock}
sed -i -E 's/[0-9]{4}-[0-9]{2}-[0-9]{2}[[:space:]]+[0-9]{2}:[0-9]{2}:[0-9]{2}[[:space:]]+UTC/{liveClock || "Syncing..."}/g' "$TARGET"

# 3. Fix WhatsApp / Floating Action button overlap by ensuring bottom padding on main wrapper
if ! grep -q "pb-32" "$TARGET"; then
  sed -i 's/min-h-screen/min-h-screen pb-32/g' "$TARGET"
fi

echo "Running TypeScript compilation & build verification..."
npx tsc --noEmit
npm run build

echo "Committing and pushing final institutional fix..."
git add "$TARGET"
git commit -m "Fix: Add live ticking clock state and mobile padding clearance in MacroDashboard" || echo "No changes."
git pull --rebase --autostash origin main || true
git push origin main

echo "=================================================================="
echo "  SURGICAL DEPLOYMENT COMPLETE! Check your live terminal now."
echo "=================================================================="
