import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import electronPath from 'electron';

const server = await createServer({ server: { host: '127.0.0.1', port: 5173, strictPort: true } });
let child;
let shuttingDown = false;
async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  child?.kill();
  await server.close();
  process.exitCode = code;
}
try {
  await import('./build-main.mjs');
  await server.listen();
  server.printUrls();
  const env = { ...process.env, VITE_DEV_SERVER_URL: 'http://127.0.0.1:5173' };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.NODE_OPTIONS;
  child = spawn(electronPath, ['.'], { env, stdio: 'inherit', windowsHide: true });
  child.once('error', error => { console.error(error); void shutdown(1); });
  child.once('exit', code => void shutdown(code ?? 1));
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
} catch (error) {
  console.error(error);
  await shutdown(1);
}
