#!/bin/bash
set -e

echo "Installing dependencies..."
npm install --legacy-peer-deps

echo "Setting permissions..."
find node_modules/.bin -type f -exec chmod +x {} \; 2>/dev/null || true

echo "Building application..."
npm run build

echo "Build completed successfully!"
