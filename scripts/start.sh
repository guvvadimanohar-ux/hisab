#!/usr/bin/env bash
# =============================================================================
# Hisab — Application Launcher Script
# Starts Ollama (if installed and not running) and launches Node.js Server.
# =============================================================================

set -e

echo "=========================================================="
echo "STARTING HISAB WITH MULTILINGUAL AI ANALYST"
echo "=========================================================="

# Check Ollama daemon
if command -v ollama >/dev/null 2>&1; then
  if ! curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
    echo "--> Launching Ollama daemon..."
    ollama serve >/dev/null 2>&1 &
    sleep 2
  else
    echo "--> Ollama daemon is active at http://localhost:11434"
  fi
fi

PORT=${PORT:-8099}
echo "--> Starting Hisab Financial Analytics Server on http://localhost:$PORT ..."
exec node backend/server.js
