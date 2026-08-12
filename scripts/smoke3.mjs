// Spawn electron 加载 smoke3 main（绕过 bash here-doc 引号问题）
import { spawn } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const electronExe = path.join(root, 'node_modules/electron/dist', process.platform === 'win32' ? 'electron.exe' : 'electron');
const mainScript = path.join(root, 'scripts/_smoke3_main.cjs');

const env = { ...process.env };
delete env['ELECTRON_RUN_AS_NODE'];
delete env['NODE_OPTIONS'];
// 测试注入：fixture 预加载到主进程白名单（recent:add 收紧后冒烟仍可读文件）
env.SMOKE_FIXTURES = path.join(root, 'tests/fixtures/sample-multi-page.pdf');

const child = spawn(electronExe, [mainScript, '--no-sandbox', '--disable-gpu'], {
  cwd: root,
  env,
  stdio: 'inherit',
});
child.on('exit', (c) => {
  console.log('SMOKE3_EXIT', c);
  process.exit(c ?? 0);
});