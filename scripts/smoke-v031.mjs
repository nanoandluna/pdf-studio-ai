// V0.3.1 冒烟入口：spawn electron 加载 _smoke_v031_main.cjs
import { spawn } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const electronExe = path.join(root, 'node_modules/electron/dist', process.platform === 'win32' ? 'electron.exe' : 'electron');
const mainScript = path.join(root, 'scripts/_smoke_v031_main.cjs');

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
  console.log('V031_SMOKE_EXIT', c);
  process.exit(c ?? 0);
});