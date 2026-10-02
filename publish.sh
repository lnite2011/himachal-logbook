#!/usr/bin/env bash
# Publish this folder to the public site repo (GitHub Pages). Run from anywhere in the planning repo.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git remote get-url site >/dev/null 2>&1 || git remote add site https://github.com/lnite2011/himachal-logbook.git
git subtree push --prefix=trips/himachal-2026-10/website/app site main
