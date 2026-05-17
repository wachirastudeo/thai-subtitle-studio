#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -x ".venv/bin/python" ]; then
  echo ".venv not found. Run: ./setup-mac-linux.sh"
  exit 1
fi

export PYTHON="$PWD/.venv/bin/python"
npm run dev
