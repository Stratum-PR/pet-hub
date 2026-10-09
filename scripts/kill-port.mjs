#!/usr/bin/env node
// Free a TCP port by killing the processes listening on it (Windows, macOS, Linux).
//
//   node scripts/kill-port.mjs <port>     e.g. 8080 (Vite dev, `npm run kill-vite`), 4173 (Vite preview, `npm run kill-preview`)
//
// Only processes LISTENING on the port are killed (not, say, a browser connected to it). Retries up to 5 times,
// waiting 500 ms between attempts, like the old scripts/kill-port-*.ps1. Always exits 0 so `npm run dev` still
// starts; it warns if the port is still taken.
//   Windows: netstat -ano + taskkill /F.   macOS/Linux: lsof (falls back to fuser on Linux) + SIGKILL.
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const WIN = process.platform === 'win32';

/** PIDs listening on `port` in `netstat -ano` output (Windows). Matches the local address column exactly. */
export function parseNetstatListeners(output, port) {
  const pids = new Set();
  for (const line of output.split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/);
    // Proto  Local Address  Foreign Address  State  PID
    if (parts.length < 5 || !/^TCP/i.test(parts[0])) continue;
    const local = parts[1];
    const state = parts[3];
    const pid = parts[4];
    if (local.endsWith(`:${port}`) && /^LISTEN/i.test(state) && /^\d+$/.test(pid) && pid !== '0') pids.add(pid);
  }
  return [...pids];
}

/** PIDs from `lsof -t` / `fuser` output (whitespace-separated numbers). */
export function parsePidList(output) {
  return [...new Set(output.split(/\s+/).filter((s) => /^\d+$/.test(s)))];
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return { ok: !r.error, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function listeners(port) {
  if (WIN) return parseNetstatListeners(run('netstat', ['-ano', '-p', 'TCP']).stdout, port);
  const lsof = run('lsof', ['-nP', '-t', `-iTCP:${port}`, '-sTCP:LISTEN']);
  if (lsof.ok) return parsePidList(lsof.stdout);
  // No lsof (some minimal Linux installs): fuser prints the PIDs on stdout.
  const fuser = run('fuser', [`${port}/tcp`]);
  if (fuser.ok) return parsePidList(fuser.stdout);
  console.warn('Could not list processes on the port: install lsof (or fuser).');
  return [];
}

function processName(pid) {
  if (WIN) {
    const out = run('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH']).stdout.trim();
    const m = out.match(/^"([^"]+)"/);
    return m ? m[1] : '?';
  }
  return run('ps', ['-p', pid, '-o', 'comm=']).stdout.trim() || '?';
}

function kill(pid) {
  if (WIN) {
    const r = spawnSync('taskkill', ['/PID', pid, '/F'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (r.status !== 0) throw new Error((r.stderr || r.stdout || '').trim() || `taskkill exit ${r.status}`);
    return;
  }
  process.kill(Number(pid), 'SIGKILL');
}

function killOnce(port) {
  const pids = listeners(port);
  if (pids.length === 0) return false;
  console.log(`Found processes using port ${port}:`);
  let killed = false;
  for (const pid of pids) {
    try {
      console.log(`Killing process: ${processName(pid)} (PID: ${pid})`);
      kill(pid);
      killed = true;
    } catch (e) {
      console.warn(`Could not kill process ${pid}: ${e instanceof Error ? e.message : e}`);
    }
  }
  return killed;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function freePort(port) {
  console.log(`Checking for processes using port ${port}...`);
  for (let attempt = 0; attempt < 5; attempt++) {
    if (!killOnce(port)) break;
    await sleep(500);
    if (listeners(port).length === 0) break;
  }
  if (listeners(port).length > 0) {
    console.warn(`Warning: Port ${port} may still be in use. Retrying...`);
    await sleep(1000);
    killOnce(port);
  } else {
    console.log(`Port ${port} is now free.`);
  }
}

/** True when this file is the script node was started with (not imported). */
function isMain() {
  if (!process.argv[1]) return false;
  const norm = (p) => {
    const real = realpathSync(p);
    return WIN ? real.toLowerCase() : real;
  };
  try {
    return norm(fileURLToPath(import.meta.url)) === norm(process.argv[1]);
  } catch {
    return false;
  }
}

if (isMain()) {
  const arg = process.argv[2];
  if (!arg || arg === '--help' || arg === '-h') {
    console.log('Usage: node scripts/kill-port.mjs <port>');
    process.exit(arg ? 0 : 1);
  }
  const port = Number(arg);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error(`Invalid port: ${arg}`);
    process.exit(1);
  }
  await freePort(port);
}
