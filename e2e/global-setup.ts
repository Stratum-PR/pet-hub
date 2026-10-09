import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { seed } from './seed';
import { SEED_FILE } from './fixtures';

export default async function globalSetup() {
  const { TEST_API_URL, TEST_ANON_KEY, TEST_SERVICE_KEY } = process.env;
  if (!TEST_API_URL || !TEST_ANON_KEY || !TEST_SERVICE_KEY) {
    throw new Error('Missing TEST_API_URL / TEST_ANON_KEY / TEST_SERVICE_KEY. Use: npm run test:e2e');
  }
  const data = await seed(TEST_API_URL, TEST_ANON_KEY, TEST_SERVICE_KEY);
  mkdirSync(dirname(SEED_FILE), { recursive: true });
  writeFileSync(SEED_FILE, JSON.stringify(data, null, 2));
}
