/**
 * Start Vite and open Safari (macOS). Other platforms: start Vite and print the URL.
 */
import { spawn } from 'node:child_process';
import { execSync } from 'node:child_process';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const url = 'http://localhost:8080';

execSync('node scripts/kill-port-8080.mjs', { cwd: root, stdio: 'inherit' });

const vite = spawn('npx', ['vite'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env },
});

function serverReady() {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

(async () => {
  for (let i = 0; i < 120; i++) {
    if (await serverReady()) {
      if (process.platform === 'darwin') {
        try {
          execSync(`open -a Safari ${url}`, { stdio: 'inherit' });
        } catch {
          console.warn('Could not open Safari; open this URL manually:', url);
        }
      } else {
        console.log(`\n  App ready: ${url}\n  Open that address in Safari (or your browser).\n`);
      }
      break;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
})();

vite.on('exit', (code) => process.exit(code ?? 0));

function shutdown() {
  vite.kill('SIGINT');
  process.exit(130);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
