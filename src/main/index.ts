import { app, BrowserWindow, shell, globalShortcut, Menu, Tray, nativeImage, screen } from 'electron'
import { join } from 'path'
import { registerIpcHandlers } from './ipc-handlers'

let mainWindow: BrowserWindow | null = null
let quickCaptureWindow: BrowserWindow | null = null
let tray: Tray | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    title: 'Dex',
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#0a0a0a',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault()
      mainWindow?.hide()
      return
    }
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const appUrl = process.env.ELECTRON_RENDERER_URL || 'file://'
    if (!url.startsWith(appUrl)) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow()
  } else {
    mainWindow.show()
    mainWindow.focus()
  }
}

function createTray(): void {
  const icon = nativeImage.createEmpty()
  tray = new Tray(icon)
  tray.setToolTip('Dex — agents running in background')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Dex',
      click: showMainWindow
    },
    { type: 'separator' },
    {
      label: 'Quit Dex',
      click: () => {
        app.isQuitting = true
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)
  tray.on('click', showMainWindow)
}

function createQuickCaptureWindow(): void {
  if (quickCaptureWindow && !quickCaptureWindow.isDestroyed()) return

  const display = screen.getPrimaryDisplay()
  const { width: screenW } = display.workAreaSize
  const winW = 560
  const winH = 180

  quickCaptureWindow = new BrowserWindow({
    title: 'Quick Capture',
    width: winW,
    height: winH,
    x: Math.round((screenW - winW) / 2),
    y: Math.round(display.workAreaSize.height * 0.22),
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  quickCaptureWindow.on('blur', () => {
    if (quickCaptureWindow && !quickCaptureWindow.isDestroyed()) {
      quickCaptureWindow.hide()
    }
  })

  quickCaptureWindow.on('closed', () => {
    quickCaptureWindow = null
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    quickCaptureWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}/quick-capture.html`)
  } else {
    quickCaptureWindow.loadFile(join(__dirname, '../renderer/quick-capture.html'))
  }
}

function toggleQuickCapture(): void {
  if (!quickCaptureWindow || quickCaptureWindow.isDestroyed()) {
    createQuickCaptureWindow()
    quickCaptureWindow?.once('ready-to-show', () => {
      quickCaptureWindow?.show()
      quickCaptureWindow?.focus()
    })
    return
  }

  if (quickCaptureWindow.isVisible()) {
    quickCaptureWindow.hide()
  } else {
    const display = screen.getPrimaryDisplay()
    const { width: screenW } = display.workAreaSize
    const [winW] = quickCaptureWindow.getSize()
    quickCaptureWindow.setPosition(
      Math.round((screenW - winW) / 2),
      Math.round(display.workAreaSize.height * 0.22)
    )
    quickCaptureWindow.show()
    quickCaptureWindow.focus()
  }
}

function registerGlobalShortcuts(): void {
  globalShortcut.register('CommandOrControl+Shift+D', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      createWindow()
      return
    }
    if (mainWindow.isVisible()) {
      mainWindow.hide()
    } else {
      mainWindow.show()
      mainWindow.focus()
    }
  })

  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    toggleQuickCapture()
  })
}

function setupAppMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { role: 'close' }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// Track whether the app is truly quitting vs just closing the window
declare module 'electron' {
  interface App {
    isQuitting?: boolean
  }
}

app.on('before-quit', () => {
  app.isQuitting = true
})

app.whenReady().then(() => {
  setupAppMenu()
  registerIpcHandlers()
  createWindow()
  createTray()
  registerGlobalShortcuts()

  app.on('activate', showMainWindow)
})

app.on('window-all-closed', () => {
  // Don't quit — tray keeps agents running in the background
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
