import { readFileSync, readdirSync, mkdirSync, copyFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const lock = JSON.parse(readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const output = path.join(root, 'dist', 'licenses');
mkdirSync(output, { recursive: true });
for (const [location, pkg] of Object.entries(lock.packages)) {
  if (!location || (pkg.dev && location !== 'node_modules/electron')) continue;
  const folder = path.join(root, location);
  if (!existsSync(folder) && pkg.optional) continue;
  const destination = path.join(output, location.replaceAll('node_modules/', '').replaceAll('/', '__'));
  mkdirSync(destination, { recursive: true });
  for (const name of readdirSync(folder)) {
    if (/^(license|licence|notice|copying)(\.|$)/i.test(name) && statSync(path.join(folder, name)).isFile()) copyFileSync(path.join(folder, name), path.join(destination, name));
  }
}
for (const name of ['LICENSE', 'THIRD-PARTY-NOTICES.md']) copyFileSync(path.join(root, name), path.join(output, name));
console.log('Runtime license texts copied to dist/licenses.');
