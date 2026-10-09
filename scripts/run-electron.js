'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { root, runtimeDirectory } = require('./electron-runtime');
try {
  const runtime = runtimeDirectory();
  const env = { ...process.env };
  // Electron expects its helper alongside the executable. Keep sandboxing enabled
  // by linking the matching, installed root-owned helper into the runtime cache.
  const installedHelper = '/opt/microsoft-teams-pwa/chrome-sandbox';
  const localHelper = path.join(runtime, 'chrome-sandbox');
  const validHelper = helper => {
    if (!fs.existsSync(helper)) return false;
    const stat = fs.statSync(helper);
    return stat.uid === 0 && (stat.mode & 0o4777) === 0o4755;
  };
  const installedVersion = '/opt/microsoft-teams-pwa/version';
  const matchingVersion = fs.existsSync(installedVersion) &&
    fs.readFileSync(installedVersion, 'utf8').trim().replace(/^v/, '') === require('../package.json').devDependencies.electron;
  if (process.platform === 'linux' && !validHelper(localHelper) && matchingVersion && validHelper(installedHelper)) {
    fs.rmSync(localHelper, { force: true });
    fs.symlinkSync(installedHelper, localHelper);
  }
  const child = spawn(path.join(runtime, 'electron'), process.argv.slice(2), { cwd: root, env, stdio: 'inherit' });
  child.on('error', error => { console.error(error.message); process.exitCode = 1; });
  child.on('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
} catch (error) { console.error(error.message); process.exitCode = 1; }
