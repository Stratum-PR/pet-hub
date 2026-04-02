/**
 * Free port 8080 before starting Vite (cross-platform).
 */
import { execSync } from 'node:child_process';
import process from 'node:process';

const port = 8080;

function killUnix() {
  try {
    const out = execSync(`lsof -ti:${port}`, { encoding: 'utf8' }).trim();
    if (!out) return;
    const pids = [...new Set(out.split(/\n/).filter(Boolean))];
    for (const pid of pids) {
      try {
        process.kill(Number.parseInt(pid, 10), 'SIGKILL');
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* no listeners on port */
  }
}

function killWindows() {
  execSync('powershell -ExecutionPolicy Bypass -File ./scripts/kill-port-8080.ps1', {
    stdio: 'inherit',
    cwd: process.cwd(),
  });
}

if (process.platform === 'win32') {
  killWindows();
} else {
  killUnix();
}
