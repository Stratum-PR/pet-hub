/**
 * Free port 8080 before starting Vite (cross-platform). Kept for `npm run dev:safari` and older callers;
 * the logic lives in scripts/kill-port.mjs (`node scripts/kill-port.mjs 8080`).
 */
import { freePort } from './kill-port.mjs';

await freePort(8080);
