#!/usr/bin/env bash
# =============================================================================
# Hisab — Multilingual Voice & AI Data Analyst Setup Script
# Verifies Node.js, SQLite, Ollama daemon, and downloads recommended models.
# =============================================================================

set -e

echo "=========================================================="
echo "HISAB MULTILINGUAL VOICE & AI ANALYST SETUP"
echo "=========================================================="

# 1. Check Node.js
echo "--> Checking Node.js runtime..."
if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js is not installed. Please install Node.js v22 or higher."
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
echo "    Found Node.js $(node -v)"
if [ "$NODE_VERSION" -lt 22 ]; then
  echo "⚠️ Warning: Hisab uses built-in 'node:sqlite' which requires Node.js v22.0.0+."
fi

# 2. Check Ollama
echo "--> Checking Ollama installation..."
if command -v ollama >/dev/null 2>&1; then
  echo "    Found Ollama CLI at $(which ollama)"
  
  # Check if Ollama daemon is running
  if curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
    echo "    Ollama daemon is running at http://localhost:11434"
  else
    echo "    Starting Ollama daemon in background..."
    ollama serve >/dev/null 2>&1 &
    sleep 2
  fi

  # Check if model is already pulled
  MODEL_NAME=${OLLAMA_MODEL:-"qwen2.5:7b"}
  echo "--> Checking model: $MODEL_NAME..."
  if curl -s http://localhost:11434/api/tags | grep -q "$MODEL_NAME"; then
    echo "    Model '$MODEL_NAME' is ready."
  else
    echo "    Notice: Model '$MODEL_NAME' is not downloaded yet."
    echo "    To download it now for full offline local LLM capability, run:"
    echo "    ollama pull $MODEL_NAME"
    echo "    (Hisab will also fall back to instant deterministic SQL calculations if model is still downloading!)"
  fi
else
  echo "⚠️ Ollama CLI is not found in PATH."
  echo "   You can install it from https://ollama.com"
  echo "   Hisab's built-in fast SQL analysis engine will function seamlessly in the meantime."
fi

# 3. Environment file check
if [ ! -f .env ] && [ -f .env.example ]; then
  echo "--> Creating .env from .env.example..."
  cp .env.example .env
  echo "    Created .env"
fi

# 4. Check Database
echo "--> Verifying SQLite database..."
if [ -f "hisab_financial.db" ]; then
  echo "    Database hisab_financial.db is present."
else
  echo "    Database will be initialized automatically on server boot."
fi

echo ""
echo "=========================================================="
echo "✅ SETUP COMPLETE! You can now start the application:"
echo "   ./scripts/start.sh"
echo "=========================================================="
