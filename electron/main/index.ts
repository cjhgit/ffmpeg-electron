import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import { update } from './update'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.mjs   > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.APP_ROOT = path.join(__dirname, '../..')

export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

// Disable GPU Acceleration for Windows 7
if (os.release().startsWith('6.1')) app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let win: BrowserWindow | null = null
const preload = path.join(__dirname, '../preload/index.mjs')
const indexHtml = path.join(RENDERER_DIST, 'index.html')

async function createWindow() {
  win = new BrowserWindow({
    title: 'Main window',
    icon: path.join(process.env.VITE_PUBLIC, 'favicon.ico'),
    webPreferences: {
      preload,
      // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
      // nodeIntegration: true,

      // Consider using contextBridge.exposeInMainWorld
      // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
      // contextIsolation: false,
    },
  })

  if (VITE_DEV_SERVER_URL) { // #298
    win.loadURL(VITE_DEV_SERVER_URL)
    // Open devTool if the app is not packaged
    win.webContents.openDevTools()
  } else {
    win.loadFile(indexHtml)
  }

  // Test actively push message to the Electron-Renderer
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })

  // Auto update
  update(win)
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})

// New window example arg: new windows url
ipcMain.handle('open-win', (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${VITE_DEV_SERVER_URL}#${arg}`)
  } else {
    childWindow.loadFile(indexHtml, { hash: arg })
  }
})

// File selection handler
ipcMain.handle('select-file', async () => {
  const { dialog } = await import('electron')
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'MP4 Videos', extensions: ['mp4'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })
  
  if (result.canceled || result.filePaths.length === 0) {
    return null
  }
  
  return result.filePaths[0]
})

// Check if file exists handler
ipcMain.handle('check-file-exists', async (_, filePath: string) => {
  const { existsSync } = await import('node:fs')
  return existsSync(filePath)
})

// Helper function to parse command string with quoted arguments
function parseCommand(command: string): string[] {
  const args: string[] = []
  let current = ''
  let inQuotes = false
  let quoteChar = ''
  
  for (let i = 0; i < command.length; i++) {
    const char = command[i]
    
    if ((char === '"' || char === "'") && !inQuotes) {
      inQuotes = true
      quoteChar = char
    } else if (char === quoteChar && inQuotes) {
      inQuotes = false
      quoteChar = ''
    } else if (char === ' ' && !inQuotes) {
      if (current) {
        args.push(current)
        current = ''
      }
    } else {
      current += char
    }
  }
  
  if (current) {
    args.push(current)
  }
  
  return args
}

// Helper function to get FFmpeg binary path
function getFfmpegPath(): string {
  // In development, use system ffmpeg
  if (VITE_DEV_SERVER_URL) {
    return 'ffmpeg'
  }
  
  // In production (packaged app), use bundled ffmpeg
  const platform = process.platform
  let ffmpegName = 'ffmpeg'
  
  if (platform === 'win32') {
    ffmpegName = 'ffmpeg.exe'
  }
  
  // Location of bundled ffmpeg in packaged app
  // For macOS: app.asar/resources/bin/ffmpeg
  // For Windows: resources/bin/ffmpeg.exe
  const resourcesPath = process.resourcesPath || path.join(process.env.APP_ROOT!, 'resources')
  const ffmpegPath = path.join(resourcesPath, 'bin', ffmpegName)
  
  console.log('FFmpeg path:', ffmpegPath)
  console.log('Resources path:', resourcesPath)
  
  return ffmpegPath
}

// FFmpeg execution handler
ipcMain.handle('execute-ffmpeg', async (event, command: string) => {
  const { spawn } = await import('node:child_process')
  const fs = await import('node:fs')
  
  return new Promise((resolve, reject) => {
    // Parse command properly to handle quoted paths
    const parsedArgs = parseCommand(command)
    const args = parsedArgs.slice(1) // Remove 'ffmpeg' from the command
    
    const ffmpegPath = getFfmpegPath()
    
    console.log('FFmpeg path:', ffmpegPath) // Debug log
    console.log('FFmpeg args:', args) // Debug log
    
    // Check if ffmpeg exists (in packaged app)
    if (!VITE_DEV_SERVER_URL && !fs.existsSync(ffmpegPath)) {
      reject({ 
        success: false, 
        error: `FFmpeg not found at: ${ffmpegPath}. Please ensure FFmpeg is bundled with the app.` 
      })
      return
    }
    
    const ffmpeg = spawn(ffmpegPath, args)
    
    let stdout = ''
    let stderr = ''
    
    ffmpeg.stdout.on('data', (data) => {
      const output = data.toString()
      stdout += output
      event.sender.send('ffmpeg-output', { type: 'stdout', data: output })
    })
    
    ffmpeg.stderr.on('data', (data) => {
      const output = data.toString()
      stderr += output
      event.sender.send('ffmpeg-output', { type: 'stderr', data: output })
    })
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, stdout, stderr })
      } else {
        reject({ success: false, code, stdout, stderr })
      }
    })
    
    ffmpeg.on('error', (error) => {
      reject({ success: false, error: error.message, path: ffmpegPath })
    })
  })
})
