'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const action = process.argv[2];
if (!['enable', 'disable'].includes(action) || process.argv.length !== 3) {
  console.error('Usage: node scripts/autostart.js enable|disable');
  process.exit(2);
}
const directory = path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'autostart');
const entry = path.join(directory, 'teams-pwa.desktop');
if (action === 'enable') {
  if (!fs.existsSync('/usr/bin/microsoft-teams-pwa')) {
    console.error('Install the .deb package before enabling autostart.');
    process.exit(1);
  }
  fs.mkdirSync(directory, { recursive: true });
  fs.copyFileSync(path.join(__dirname, '../packaging/teams-pwa-autostart.desktop'), entry);
  fs.chmodSync(entry, 0o644);
  console.log('Teams will start in the background after login.');
} else {
  fs.rmSync(entry, { force: true });
  console.log('Teams login startup disabled.');
}
