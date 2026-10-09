'use strict';
const { app, BrowserWindow, Tray, Menu, session, desktopCapturer, shell, ipcMain } = require('electron');
const path = require('node:path');
const { attachLifecycle, teamsURL, isTeamsOrigin } = require('./lifecycle');

const args = process.argv.slice(1);
const background = args.includes('--background');
const requestedURL = args.find(arg => /^(https:|msteams:)/i.test(arg));
const startURL = teamsURL(requestedURL) || 'https://teams.microsoft.com/';
const chromeUA = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`;
const authHosts = new Set(['login.microsoftonline.com', 'login.live.com', 'login.microsoft.com', 'account.microsoft.com', 'account.live.com']);
const trustedWebOrigin = value => {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !url.port && (isTeamsOrigin(value) || authHosts.has(url.hostname)); }
  catch { return false; }
};
app.setName('Microsoft Teams');
app.userAgentFallback = chromeUA;
app.setDesktopName('teams-pwa.desktop');
app.setPath('userData', path.join(app.getPath('appData'), 'teams-desktop'));
app.commandLine.appendSwitch('class', 'teams-pwa');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
let win, tray, lifecycle, authPopup;
const pendingLinks = [];
let pendingRestore = false;
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', (_event, argv) => {
    const link = argv.map(teamsURL).find(Boolean);
    if (!win) { if (link) pendingLinks.push(link); pendingRestore = true; return; }
    if (link && link !== win.webContents.getURL()) win.loadURL(link);
    lifecycle.restore();
  });
  app.on('open-url', (event, value) => {
    event.preventDefault();
    const link = teamsURL(value);
    if (!link) return;
    if (!win) pendingLinks.push(link);
    else { win.loadURL(link); lifecycle.restore(); }
  });
  app.whenReady().then(start).catch(error => { console.error(error); app.exit(1); });
}

async function start() {
  const ses = session.defaultSession;
  ses.setUserAgent(chromeUA);
  Menu.setApplicationMenu(null);
  const allowedPermissions = new Set(['media', 'notifications', 'display-capture', 'fullscreen', 'speaker-selection']);
  const permissionAllowed = (permission, origin) =>
    (allowedPermissions.has(permission) && isTeamsOrigin(origin)) ||
    (['storage-access', 'top-level-storage-access'].includes(permission) && trustedWebOrigin(origin));
  ses.setPermissionCheckHandler((_contents, permission, origin, details) => permissionAllowed(permission, origin || details?.requestingUrl));
  ses.setPermissionRequestHandler((_contents, permission, callback, details) => callback(permissionAllowed(permission, details.requestingUrl)));
  ses.setDisplayMediaRequestHandler(async (request, callback) => {
    if (!isTeamsOrigin(request.securityOrigin)) { callback({}); return; }
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] });
      // PipeWire on GNOME returns the single source chosen in the system dialog.
      const selected = sources.length === 1 ? sources[0] : await chooseSource(sources);
      callback(selected ? { video: selected } : {});
    } catch (error) {
      console.error('Screen capture cancelled or unavailable:', error.message);
      callback({});
    }
  });
  win = new BrowserWindow({
    title: 'Microsoft Teams', width: 1280, height: 900, minWidth: 720, minHeight: 480,
    show: !background, icon: path.join(__dirname, '../assets/icon.png'),
    autoHideMenuBar: true,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false }
  });
  lifecycle = attachLifecycle(app, win);
  if (pendingRestore) lifecycle.restore();
  win.webContents.setUserAgent(chromeUA);
  win.webContents.setWindowOpenHandler(({ url }) => {
    let parsed;
    try { parsed = new URL(url); } catch { return { action: 'deny' }; }
    if (url === 'about:blank' || trustedWebOrigin(url)) {
      if (authPopup && !authPopup.isDestroyed()) { authPopup.focus(); return { action: 'deny' }; }
      return { action: 'allow', overrideBrowserWindowOptions: {
        parent: win, autoHideMenuBar: true, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
      } };
    }
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:' || parsed.protocol === 'mailto:') shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('did-create-window', child => {
    authPopup = child;
    child.setMenu(null);
    child.webContents.setUserAgent(chromeUA);
    child.on('closed', () => { if (authPopup === child) authPopup = null; });
    // Redirects from an authentication popup must not create a chain of windows.
    child.webContents.setWindowOpenHandler(({ url }) => {
      if (trustedWebOrigin(url)) child.loadURL(url);
      return { action: 'deny' };
    });
  });
  win.on('hide', () => { if (authPopup && !authPopup.isDestroyed()) authPopup.hide(); });
  win.on('show', () => { if (authPopup && !authPopup.isDestroyed()) authPopup.show(); });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('https://')) event.preventDefault();
  });
  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('Teams renderer stopped:', details.reason);
    lifecycle.restore();
    if (details.reason !== 'clean-exit') win.reload();
  });
  tray = new Tray(path.join(__dirname, '../assets/icon.png'));
  tray.setToolTip('Microsoft Teams — running in background');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Teams', click: lifecycle.restore },
    { type: 'separator' },
    { label: 'Quit Teams', click: lifecycle.quit }
  ]));
  tray.on('click', lifecycle.restore);
  tray.on('double-click', lifecycle.restore);
  process.on('SIGTERM', lifecycle.quit);
  process.on('SIGINT', lifecycle.quit);
  await win.loadURL(pendingLinks.pop() || startURL);
}

async function chooseSource(sources) {
  if (!sources.length) return null;
  const picker = new BrowserWindow({
    parent: win, modal: true, title: 'Choose what to share', width: 760, height: 560,
    autoHideMenuBar: true,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, 'picker-preload.js') }
  });
  const data = sources.map(source => ({ id: source.id, name: source.name, thumbnail: source.thumbnail.toDataURL() }));
  return new Promise(resolve => {
    let finished = false;
    const finish = id => {
      if (finished) return;
      finished = true;
      ipcMain.removeListener('teams-capture-choice', selected);
      resolve(sources.find(source => source.id === id) || null);
      if (!picker.isDestroyed()) picker.destroy();
    };
    const selected = (event, id) => {
      if (event.sender === picker.webContents) finish(id);
    };
    ipcMain.on('teams-capture-choice', selected);
    picker.on('closed', () => finish(null));
    picker.webContents.once('did-finish-load', () => picker.webContents.send('teams-capture-sources', data));
    picker.loadFile(path.join(__dirname, 'picker.html')).catch(() => finish(null));
  });
}
