// Run with the installed Electron binary, using only a temporary local page.
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { attachLifecycle } = require('../src/lifecycle');
const parent = !process.env.TEAMS_SMOKE_PROFILE;
const profile = process.env.TEAMS_SMOKE_PROFILE || fs.mkdtempSync(path.join(os.tmpdir(), 'teams-smoke-'));
app.setPath('userData', profile);
if (!app.requestSingleInstanceLock()) { app.quit(); }
else {
  const timeout = setTimeout(() => { console.error('Smoke test timed out'); app.exit(1); }, 20000);
  timeout.unref();
  app.on('quit', () => { clearTimeout(timeout); if (parent) fs.rmSync(profile, { recursive: true, force: true }); });
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  app.whenReady().then(async () => {
    const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
    const controls = attachLifecycle(app, win);
    await win.loadURL('data:text/html,<title>Teams lifecycle test</title><script>window.ticks=0;setInterval(()=>window.ticks++,50)</script>');
    controls.restore();
    const contents = win.webContents.id;
    win.close();
    assert.equal(win.isDestroyed(), false);
    assert.equal(win.isVisible(), false);
    const ticks = await win.webContents.executeJavaScript('window.ticks');
    await delay(1200);
    assert.ok(await win.webContents.executeJavaScript('window.ticks') > ticks + 10, 'hidden renderer remains active');
    controls.restore();
    assert.equal(win.isVisible(), true);
    assert.equal(win.webContents.id, contents);
    let second = false;
    app.once('second-instance', (_event, argv) => { second = true; assert.ok(argv.includes('msteams://teams.microsoft.com/l/test')); controls.restore(); });
    const child = spawn(process.execPath, [__filename, 'msteams://teams.microsoft.com/l/test'], { env: { ...process.env, TEAMS_SMOKE_PROFILE: profile }, stdio: 'ignore' });
    await new Promise((resolve, reject) => { child.on('exit', code => code === 0 ? resolve() : reject(Error('second instance failed'))); child.on('error', reject); });
    await delay(300);
    assert.equal(second, true);
    app.once('quit', () => console.log('PASS: close hides; hidden timers run; renderer survives; restore works; one instance; meeting link delivered; quit exits.'));
    controls.quit();
  }).catch(error => { console.error(error); app.exit(1); });
}
