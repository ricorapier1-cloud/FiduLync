#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "🧹 1/4: Clearing local Next.js cache..."
rm -rf .next/cache

echo "📦 2/4: Staging files for Git..."
git add .

# Prompt for a commit message
echo -n "📝 3/4: Enter your commit message (e.g., 'feat: update store UI'): "
read commit_message

# Fallback message if left blank
if [ -z "$commit_message" ]; then
  commit_message="Update: Algolync Quant Suite maintenance"
fi

# Get the current Git branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

echo "🚀 4/4: Committing and pushing to GitHub ($CURRENT_BRANCH)..."
git commit -m "$commit_message"
git push origin $CURRENT_BRANCH

echo "✅ Success! GitHub has been updated. Vercel is building your deployment."

# =====================================================================
# OPTIONAL: Vercel CLI Strict Cache Bypass
# If you have the Vercel CLI installed globally (npm i -g vercel)
# and want to force Vercel to ignore its build cache entirely, 
# uncomment the two lines below:
# =====================================================================
# echo "⚡ Forcing Vercel production build without cache..."
# vercel --prod --force
