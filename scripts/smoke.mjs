import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import electronPath from 'electron';

const root = fileURLToPath(new URL('../', import.meta.url));
const env = { ...process.env, VITE_SMOKE_TEST: '1', PDF_STUDIO_SMOKE: '1', PDF_STUDIO_SMOKE_DIR: mkdtempSync(path.join(tmpdir(), 'pdf-studio-smoke-')) };
delete env.ELECTRON_RUN_AS_NODE;
delete env.NODE_OPTIONS;
for (const script of ['node_modules/vite/bin/vite.js', 'scripts/build-main.mjs']) {
  const args = [path.join(root, script), ...(script.includes('vite') ? ['build'] : [])];
  const result = spawnSync(process.execPath, args, { cwd: root, env, stdio: 'inherit', windowsHide: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
env.SMOKE_FIXTURES = path.join(root, 'tests/fixtures/sample-multi-page.pdf');
const child = spawn(electronPath, [path.join(root, 'scripts/smoke-main.cjs')], { cwd: root, env, stdio: 'inherit', windowsHide: true });
child.once('error', error => { console.error(error); process.exitCode = 1; });
child.once('exit', code => {
  // Restore the production bundle: test-only store access must never be shipped.
  const productionEnv = { ...env };
  delete productionEnv.VITE_SMOKE_TEST;
  const build = spawnSync(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'build'], { cwd: root, env: productionEnv, stdio: 'inherit', windowsHide: true });
  process.exitCode = code === 0 && build.status === 0 ? 0 : 1;
});
