'use strict';
function attachLifecycle(app, win) {
  let quitting = false;
  const restore = () => {
    if (win.isDestroyed()) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  };
  app.on('before-quit', () => { quitting = true; });
  win.on('close', event => {
    if (quitting) return;
    event.preventDefault();
    win.hide();
  });
  app.on('activate', restore);
  app.on('window-all-closed', () => {});
  return { restore, quit: () => { quitting = true; app.quit(); } };
}
function teamsURL(value) {
  if (!value) return null;
  try {
    const url = new URL(value.replace(/^msteams:/i, 'https:'));
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        !['teams.microsoft.com', 'teams.cloud.microsoft', 'teams.live.com'].includes(url.hostname)) return null;
    return url.href;
  } catch { return null; }
}
function isTeamsOrigin(value) {
  const url = teamsURL(value);
  return Boolean(url);
}
module.exports = { attachLifecycle, teamsURL, isTeamsOrigin };
