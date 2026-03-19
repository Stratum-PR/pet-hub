import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { translations } from './translations';

function walk(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip common noisy folders
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
      files.push(...walk(fullPath));
    } else if (entry.isFile()) {
      if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

function extractTKeys(fileContents: string): string[] {
  // Only validate literal keys passed as the first argument.
  // We intentionally ignore non-literal usage like: t(someVar)
  const regex = /\bt\(\s*['"]([^'"]+)['"]\s*(?:,|\))/g;
  const keys: string[] = [];
  let match: RegExpExecArray | null = null;
  // eslint-disable-next-line no-cond-assign
  while ((match = regex.exec(fileContents)) !== null) {
    keys.push(match[1]);
  }
  return keys;
}

describe('translations', () => {
  it('all literal t(...) translation keys exist in translations.ts', () => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const srcDir = path.resolve(__dirname, '..'); // src/

    const files = walk(srcDir);
    const usedKeys = new Set<string>();

    for (const file of files) {
      // Skip the translations source itself (obviously contains keys)
      if (file.endsWith('translations.ts')) continue;
      const contents = fs.readFileSync(file, 'utf8');
      for (const key of extractTKeys(contents)) {
        usedKeys.add(key);
      }
    }

    const missing = [...usedKeys].filter((key) => !(key in translations));

    if (missing.length) {
      // Keep the failure output readable.
      const preview = missing.slice(0, 40).join('\n');
      throw new Error(`Missing translation keys (${missing.length}):\n${preview}`);
    }

    expect(missing).toHaveLength(0);
  });
});

