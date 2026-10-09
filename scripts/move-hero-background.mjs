#!/usr/bin/env node
// Move hero_background.png from the project root to public/ if present (e.g. after git pull).
// Windows, macOS, Linux. Replaces scripts/move-hero-background.ps1.
import { existsSync, mkdirSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(ROOT, 'hero_background.png');
const dest = join(ROOT, 'public', 'hero_background.png');

if (existsSync(src)) {
  mkdirSync(dirname(dest), { recursive: true });
  renameSync(src, dest); // replaces an existing public/hero_background.png, like Move-Item -Force
  console.log('Moved hero_background.png to public/');
} else {
  console.log('hero_background.png not in root (already in public/ or not pulled yet).');
}
