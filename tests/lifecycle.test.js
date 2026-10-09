const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { attachLifecycle, teamsURL, isTeamsOrigin } = require('../src/lifecycle');
test('close hides a live window; activate restores it; explicit quit closes it', () => {
  const app = new EventEmitter();
  const win = new EventEmitter();
  let visible = true, destroyed = false, focused = false, prevented = false;
  Object.assign(win, { isDestroyed: () => destroyed, isMinimized: () => false,
    hide: () => { visible = false; }, show: () => { visible = true; }, focus: () => { focused = true; } });
  app.quit = () => { app.emit('before-quit'); win.emit('close', { preventDefault: () => { throw Error('Quit blocked'); } }); destroyed = true; };
  const controls = attachLifecycle(app, win);
  win.emit('close', { preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true); assert.equal(visible, false); assert.equal(destroyed, false);
  app.emit('activate'); assert.equal(visible, true); assert.equal(focused, true);
  controls.quit(); assert.equal(destroyed, true);
});
test('Teams links are normalized and other origins rejected', () => {
  assert.equal(teamsURL('msteams://teams.microsoft.com/l/meetup-join/test'), 'https://teams.microsoft.com/l/meetup-join/test');
  assert.ok(isTeamsOrigin('https://teams.cloud.microsoft/'));
  for (const url of ['https://teams.microsoft.com.evil.test/', 'http://teams.microsoft.com/', 'https://user@teams.live.com/', 'https://teams.live.com:1234/', 'javascript:alert(1)']) assert.equal(teamsURL(url), null);
});
