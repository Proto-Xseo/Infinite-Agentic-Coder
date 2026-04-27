#!/bin/bash

# ============================================
#   GitHub Setup Script by Proto-Xseo
#   Run this on every new Repl before anything
# ============================================

TOKEN="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"
GITHUB_USER="Proto-Xseo"
GITHUB_EMAIL="ayushraj4271@gmail.com"
REPO="Infinite-Agentic-Coder"

# --- Git Identity ---
git config --global user.name "$GITHUB_USER"
git config --global user.email "$GITHUB_EMAIL"
git config --global pull.rebase false

echo "✅ Git identity set"

# --- Pull repo INTO current folder (avoids conflicts with Replit default files) ---
git init
git remote add origin https://$TOKEN@github.com/$GITHUB_USER/$REPO.git
git fetch origin
git reset --hard origin/main

echo "✅ Repo pulled into current folder"
echo "✅ Remote set with token"
echo ""
echo "🎉 All done! Here's what to do next:"
echo ""
echo "   1. Let the agent do its thing"
echo "   2. When done, run these 3 commands:"
echo ""
echo "      git add ."
echo "      git commit -m 'describe what changed'"
echo "      git push origin main"
echo ""
echo "   ⚠️  Do this every time the agent finishes working!"
echo "   ⚠️  Never edit files on GitHub website and Replit at the same time!"