#!/bin/bash
set -e

echo "Installing dependencies..."
npm install --legacy-peer-deps

echo "Setting permissions..."
chmod +x node_modules/.bin/* || true

echo "Building application..."
npm run build

echo "Build completed successfully!"
