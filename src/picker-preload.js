'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('capturePicker', {
  onSources: callback => ipcRenderer.once('teams-capture-sources', (_event, sources) => callback(sources)),
  select: id => ipcRenderer.send('teams-capture-choice', id)
});
