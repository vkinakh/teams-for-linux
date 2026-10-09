'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
function runtimeDirectory() {
  let binary;
  try { binary = require('electron'); }
  catch (error) {
    // Electron 44 also supports downloading its runtime on demand.
    const installer = path.join(root, 'node_modules/electron/install.js');
    if (!fs.existsSync(installer)) throw error;
    const result = spawnSync(process.execPath, [installer], { cwd: root, stdio: 'inherit' });
    if (result.status !== 0) throw new Error('Electron download failed. Check network access and run npm ci again.');
    binary = require('electron');
  }
  if (typeof binary !== 'string' || !fs.existsSync(binary)) throw new Error('Electron runtime missing. Run npm ci.');
  const directory = path.dirname(binary);
  const expected = require('../package.json').devDependencies.electron;
  const version = fs.readFileSync(path.join(directory, 'version'), 'utf8').trim().replace(/^v/, '');
  if (version !== expected) throw new Error(`Expected Electron ${expected}, found ${version}. Run npm ci.`);
  return directory;
}
module.exports = { root, runtimeDirectory };
