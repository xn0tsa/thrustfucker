const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('forge', {
  dfu: {
    detect:  ()           => ipcRenderer.invoke('dfu:detect'),
    flash:   (opts)       => ipcRenderer.invoke('dfu:flash',    opts),
    restore: ()           => ipcRenderer.invoke('dfu:restore'),
  },
  firmware: {
    build: (args)         => ipcRenderer.invoke('firmware:build', args),
  },
  settings: {
    get:  ()    => ipcRenderer.invoke('settings:get'),
    save: (d)   => ipcRenderer.invoke('settings:save', d),
  },
  dialog: {
    openFile: (opts) => ipcRenderer.invoke('dialog:openFile', opts),
  },
  stick: {
    detectNormal: ()     => ipcRenderer.invoke('stick:detectNormal'),
    findVolume:  (opts)  => ipcRenderer.invoke('stick:findVolume', opts),
    listFiles:   (opts)  => ipcRenderer.invoke('stick:listFiles',  opts),
    saveFile:    (opts)  => ipcRenderer.invoke('stick:saveFile',   opts),
    deleteFile:  (opts)  => ipcRenderer.invoke('stick:deleteFile', opts),
  },
  library: {
    load: ()    => ipcRenderer.invoke('library:load'),
    save: (d)   => ipcRenderer.invoke('library:save', d),
  },
  flash: {
    onProgress:  (cb) => {
      ipcRenderer.removeAllListeners('flash:progress')
      ipcRenderer.on('flash:progress', (_e, pct) => cb(pct))
    },
    offProgress: () => ipcRenderer.removeAllListeners('flash:progress'),
  },
  serial: {
    list:       ()     => ipcRenderer.invoke('serial:list'),
    connect:    (opts) => ipcRenderer.invoke('serial:connect', opts),
    send:       (data) => ipcRenderer.invoke('serial:send',    { data }),
    disconnect: ()     => ipcRenderer.invoke('serial:disconnect'),
    onData:  (cb) => {
      ipcRenderer.removeAllListeners('serial:data')
      ipcRenderer.on('serial:data', (_e, d) => cb(d))
    },
    offData: () => ipcRenderer.removeAllListeners('serial:data'),
  },
  app: {
    openPath: (p) => ipcRenderer.invoke('app:openPath', p),
    minimize: ()  => ipcRenderer.invoke('app:minimize'),
    maximize: ()  => ipcRenderer.invoke('app:maximize'),
    close:    ()  => ipcRenderer.invoke('app:close'),
  }
})
