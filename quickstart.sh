#!/usr/bin/env bash
# Start FieldLedger from any directory (Git Bash, Linux, or macOS).
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

if ! command -v node >/dev/null 2>&1; then
  printf 'Node.js is missing. Install Node.js 24 or later, then run this script again.\n' >&2
  exit 1
fi

node_major="$(node -p "Number(process.versions.node.split('.')[0])")"
if (( node_major < 24 )); then
  printf 'FieldLedger requires Node.js 24 or later. Found: %s\n' "$(node --version)" >&2
  exit 1
fi

printf '\nStarting FieldLedger…\n'
printf 'The backend serves the frontend and initializes the SQLite database automatically.\n'
printf 'No dependency installation is needed. Press Ctrl+C to stop.\n\n'

# Preserve environment settings and forward shutdown signals to the server.
exec node backend/server.mjs
