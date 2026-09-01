#!/bin/bash
# Installs what a Claude Code on the web session needs to validate its own
# edits: tsc, eslint, prettier, vite and the playwright library all come from
# npm. Without this, a fresh remote container can run the zero-dependency data
# checks (tools/*.mjs) but nothing that touches the React app.
#
# Idempotent, and the container state is cached after it completes — so
# `npm install` (which reuses node_modules) beats `npm ci` (which deletes it).
set -euo pipefail

# Local sessions run against a working tree the developer manages themselves.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Remote environments ship browsers preinstalled and set
# PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD; guard anyway so a hook run can never stall
# on a ~150MB browser download.
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

npm install --no-audit --no-fund
