#!/usr/bin/env bash
# =============================================================================
# Hisab — Multilingual Voice & AI Analyst Test Runner
# =============================================================================

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

echo "Running Hisab Multilingual AI test suite..."
node tests/ai_voice_tests.js
