// Imported first by vite.config.ts, before @vitejs/plugin-react-swc loads @swc/core.
// @swc/core >= 1.16 unpacks its native addon into a cache folder on first load. The default folder
// (%LOCALAPPDATA%\swc on Windows) can be unwritable, and then vite, vitest and builds fail with
// "Failed to load native binding". Default to a folder inside node_modules instead; an explicit
// SWC_NATIVE_BINDING_CACHE still wins.
import path from "node:path";
import { fileURLToPath } from "node:url";

if (!process.env.SWC_NATIVE_BINDING_CACHE) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  process.env.SWC_NATIVE_BINDING_CACHE = path.join(root, "node_modules", ".cache", "swc-native");
}
