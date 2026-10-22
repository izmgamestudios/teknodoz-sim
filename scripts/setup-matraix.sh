#!/usr/bin/env bash
# Installs MatrAIx (persona simulation framework) into vendor/MatrAIx.
# Requires: git, uv, Python 3.12, Docker (Web/App tasks). Model API key needed for real runs.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -d vendor/MatrAIx ] || git clone --depth 1 https://github.com/MatrAIx-ai/MatrAIx-Persona-8B vendor/MatrAIx
cd vendor/MatrAIx
uv venv --python 3.12
uv pip install -e .
uv run matraix smoke application/tasks/example-survey_product-feedback
