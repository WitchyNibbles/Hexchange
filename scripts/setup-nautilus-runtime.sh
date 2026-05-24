#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENGINE_DIR="$ROOT_DIR/engine/nautilus"
UV_BIN="${UV_BIN:-$HOME/.local/bin/uv}"

if [[ ! -x "$UV_BIN" ]]; then
  echo "Installing uv package manager..."
  curl -LsSf https://astral.sh/uv/install.sh | sh
fi

if [[ ! -x "$UV_BIN" ]]; then
  echo "uv was not installed successfully." >&2
  exit 1
fi

echo "Creating Nautilus runtime virtual environment..."
if [[ -x "$ENGINE_DIR/.venv/bin/python" ]]; then
  echo "Reusing existing virtual environment at $ENGINE_DIR/.venv"
else
  "$UV_BIN" venv "$ENGINE_DIR/.venv"
fi

echo "Installing Hexchange runtime package and NautilusTrader extras..."
"$UV_BIN" pip install \
  --python "$ENGINE_DIR/.venv/bin/python" \
  -U \
  "setuptools>=68" \
  "nautilus_trader[ib,docker]" \
  "$ENGINE_DIR"

echo
echo "Nautilus runtime ready."
echo "Suggested .env values:"
echo "HEXCHANGE_ENGINE_MODE=nautilus"
echo "HEXCHANGE_NAUTILUS_PYTHON=$ENGINE_DIR/.venv/bin/python"
echo "HEXCHANGE_NAUTILUS_PROJECT_DIR=$ENGINE_DIR"
echo "HEXCHANGE_NAUTILUS_RUNS_DIR=$ENGINE_DIR/runs"
