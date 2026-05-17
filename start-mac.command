#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -x ".venv/bin/python" ]; then
  echo "First setup on this machine..."
  ./setup-mac-linux.sh
fi

./run-mac-linux.sh
