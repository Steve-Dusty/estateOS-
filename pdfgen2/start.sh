#!/bin/bash
# Start the Next.js frontend (API routes are built-in — no separate backend needed)

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "Starting RealEstate AI Agent..."
cd "$ROOT/frontend"
npm run dev
