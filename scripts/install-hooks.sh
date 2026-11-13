#!/usr/bin/env sh
# Branche le contrôle des secrets sur chaque commit de ce clone.
set -e
cd "$(git rev-parse --show-toplevel)"
cp scripts/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
echo "crochet pre-commit installé (gitleaks)"
