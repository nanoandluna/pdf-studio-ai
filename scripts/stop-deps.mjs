import { execSync } from 'node:child_process';
try {
  execSync('taskkill /F /IM electron.exe /T 2>nul', { stdio: 'ignore' });
} catch {}
try {
  const out = execSync('wmic process where "name=\'node.exe\'" get processid,commandline /format:list 2>nul', { encoding: 'utf8' });
  const lines = out.split('\n');
  const ids = [];
  for (let i = 0; i < lines.length; i++) {
    if (/install-deps|npm@12|npm -- install|npm exec/.test(lines[i])) {
      const m = /ProcessId=(\d+)/.exec(lines[i + 1] || '');
      if (m) ids.push(m[1]);
    }
  }
  for (const id of ids) {
    try { execSync(`taskkill /F /PID ${id} /T 2>nul`, { stdio: 'ignore' }); } catch {}
  }
  console.log('killed:', ids.length);
} catch (e) { console.log('wmic err', e.message); }
