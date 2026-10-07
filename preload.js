const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  savePdf: (data) => ipcRenderer.invoke('save-pdf', data),
  saveJson: (data) => ipcRenderer.invoke('save-json', data),
  loadJson: (data) => ipcRenderer.invoke('load-json', data),
  getTcmbRates: () => ipcRenderer.invoke('get-tcmb-rates'),
  getAkbankRates: () => ipcRenderer.invoke('get-akbank-rates')
});
