import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

for (const file of readdirSync(new URL('.', import.meta.url)).filter(file => /\.(mjs|cjs)$/.test(file))) {
  const result = spawnSync(process.execPath, ['--check', fileURLToPath(new URL(file, import.meta.url))], { stdio: 'inherit', windowsHide: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log('All launcher and smoke scripts parse successfully.');
