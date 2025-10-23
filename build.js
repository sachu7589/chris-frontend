#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Setting up build environment...');

try {
  // Set permissions on node_modules/.bin
  console.log('📁 Setting permissions on binaries...');
  const binPath = path.join(__dirname, 'node_modules', '.bin');
  
  if (fs.existsSync(binPath)) {
    const files = fs.readdirSync(binPath);
    files.forEach(file => {
      const filePath = path.join(binPath, file);
      try {
        fs.chmodSync(filePath, '755');
      } catch (err) {
        // Ignore permission errors
      }
    });
  }

  console.log('🏗️  Building application...');
  
  // Run the build command
  execSync('npx vite build', { 
    stdio: 'inherit',
    cwd: __dirname
  });

  console.log('✅ Build completed successfully!');
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
