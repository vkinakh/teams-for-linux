'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { root, runtimeDirectory } = require('./electron-runtime');
const pkg = require('../package.json');
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})`);
}
function build() {
  if (process.platform !== 'linux' || process.arch !== 'x64') throw new Error('This package build targets Linux amd64 only.');
  if (!/^\d+\.\d+\.\d+$/.test(pkg.version)) throw new Error('Package version must be major.minor.patch.');
  const runtime = runtimeDirectory();
  const stage = path.join(root, '.cache/deb-stage');
  fs.rmSync(stage, { recursive: true, force: true });
  const opt = path.join(stage, 'opt/microsoft-teams-pwa');
  fs.mkdirSync(path.dirname(opt), { recursive: true });
  const helper = path.join(runtime, 'chrome-sandbox');
  fs.cpSync(runtime, opt, { recursive: true, dereference: true, filter: source => source !== helper });
  // The development helper may be a symlink to the installed root-owned file.
  // Package its bytes, never a link to files on the build machine.
  fs.copyFileSync(fs.realpathSync(helper), path.join(opt, 'chrome-sandbox'));
  fs.renameSync(path.join(opt, 'electron'), path.join(opt, 'teams-pwa'));
  fs.chmodSync(path.join(opt, 'teams-pwa'), 0o755);
  fs.chmodSync(path.join(opt, 'chrome-sandbox'), 0o4755);
  const app = path.join(opt, 'resources/app');
  fs.mkdirSync(app, { recursive: true });
  for (const folder of ['src', 'assets']) fs.cpSync(path.join(root, folder), path.join(app, folder), { recursive: true });
  fs.writeFileSync(path.join(app, 'package.json'), JSON.stringify({
    name: pkg.name, productName: pkg.productName, version: pkg.version, main: pkg.main, license: pkg.license
  }, null, 2) + '\n');
  const copy = (source, destination, mode) => {
    const dest = path.join(stage, destination);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(root, source), dest);
    if (mode) fs.chmodSync(dest, mode);
  };
  copy('packaging/microsoft-teams-pwa', 'usr/bin/microsoft-teams-pwa', 0o755);
  copy('packaging/teams-pwa.desktop', 'usr/share/applications/teams-pwa.desktop', 0o644);
  copy('assets/icon.png', 'usr/share/icons/hicolor/256x256/apps/microsoft-teams-pwa.png', 0o644);
  for (const name of ['README.md', 'LICENSE', 'NOTICE']) copy(name, 'usr/share/doc/microsoft-teams-pwa-local/' + name, 0o644);
  fs.mkdirSync(path.join(stage, 'DEBIAN'), { recursive: true });
  const control = fs.readFileSync(path.join(root, 'packaging/control.in'), 'utf8')
    .replaceAll('@VERSION@', pkg.version).replaceAll('@ELECTRON@', pkg.devDependencies.electron);
  fs.writeFileSync(path.join(stage, 'DEBIAN/control'), control);
  run('desktop-file-validate', [path.join(stage, 'usr/share/applications/teams-pwa.desktop')]);
  for (const license of ['LICENSE', 'LICENSES.chromium.html']) {
    if (!fs.existsSync(path.join(opt, license))) throw new Error(`Missing runtime notice ${license}`);
  }
  const dist = path.join(root, 'dist');
  fs.mkdirSync(dist, { recursive: true });
  const output = path.join(dist, `microsoft-teams-pwa-local_${pkg.version}_amd64.deb`);
  const temporary = output + '.tmp';
  run('dpkg-deb', ['-Zzstd', '-z6', '--build', '--root-owner-group', stage, temporary]);
  fs.renameSync(temporary, output);
  console.log(`Built ${path.relative(root, output)}`);
}
try { build(); } catch (error) { console.error(error.message); process.exitCode = 1; }
