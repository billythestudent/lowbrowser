const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');

// Optimize Chromium memory usage & GPU acceleration for smooth video playback
app.commandLine.appendSwitch('js-flags', '--expose-gc --max-semi-space-size=1 --max-old-space-size=128'); // Enable GC & cap JS memory to 128MB
app.commandLine.appendSwitch('renderer-process-limit', '1'); // Force Chromium to share a single renderer process (Saves massive RAM!)
app.commandLine.appendSwitch('enable-gpu-rasterization'); // Use GPU for web content rasterization
app.commandLine.appendSwitch('enable-zero-copy'); // Direct video/image uploads to GPU memory
app.commandLine.appendSwitch('disable-gpu-program-cache'); // Disable shader caches to reclaim GPU RAM
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('enable-features', 'DnsOverHttps<DnsOverHttps'); // Enable Chromium DNS over HTTPS (DoH)
app.commandLine.appendSwitch('dns-over-https-templates', 'https://chrome.cloudflare-dns.com/dns-query');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false, // Frameless window for custom modern titlebar
    icon: path.join(__dirname, 'logo.png'), // Origami bird logo icon
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#07080a', // Deep dark background before page loads
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true, // Crucial for embedding web pages
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false
    }
  });

  mainWindow.loadFile('index.html');

  // Memory pruning helper
  const pruneAllMemory = () => {
    const { webContents } = require('electron');
    webContents.getAllWebContents().forEach(wc => {
      try {
        wc.pruneMemory();
      } catch (e) {
        // webcontents might be destroyed
      }
    });
  };

  // Prune memory when user switches apps (e.g. playing Valorant) or minimizes browser
  mainWindow.on('blur', pruneAllMemory);
  mainWindow.on('minimize', pruneAllMemory);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Built-in Ad-Blocker (Filtreleme motoru)
const adFilter = [
  '*://*.doubleclick.net/*',
  '*://*.googleadservices.com/*',
  '*://*.googlesyndication.com/*',
  '*://*.adservice.google.com/*',
  '*://*.googletagservices.com/*',
  '*://*.analytics.google.com/*',
  '*://*.google-analytics.com/*',
  '*://*.scorecardresearch.com/*',
  '*://*.zedo.com/*',
  '*://*.adbrite.com/*',
  '*://*.adbureau.net/*',
  '*://*.carbonads.net/*',
  '*://*.buyads.co/*',
  '*://*.adform.net/*',
  '*://*.adroll.com/*',
  '*://*.adnxs.com/*',
  '*://*.adsrvr.org/*',
  '*://*.pubmatic.com/*',
  '*://*.rubiconproject.com/*',
  '*://*.criteo.com/*',
  '*://*.casalemedia.com/*',
  '*://*.exponential.com/*',
  '*://*.quantserve.com/*',
  '*://*.outbrain.com/*',
  '*://*.taboola.com/*',
  // YouTube ad URLs
  '*://*.youtube.com/pagead/*',
  '*://*.youtube.com/ptracking/*',
  '*://*.youtube.com/api/stats/ads*',
  '*://*.youtube.com/error_204*'
];

let isAdBlockEnabled = true;

const registerAdBlock = (sess) => {
  sess.webRequest.onBeforeRequest({ urls: adFilter }, (details, callback) => {
    if (isAdBlockEnabled) {
      if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
        mainWindow.webContents.send('ad-blocked', details.url);
      }
      callback({ cancel: true });
    } else {
      callback({ cancel: false });
    }
  });
};

const registerDownloadManager = (sess) => {
  sess.on('will-download', (event, item, webContents) => {
    const id = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5);
    const filename = item.getFilename();
    const totalBytes = item.getTotalBytes();

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('download-started', { id, filename, totalBytes });
    }

    item.on('updated', (event, state) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (state === 'interrupted') {
          mainWindow.webContents.send('download-updated', { id, state: 'interrupted' });
        } else if (state === 'progressing') {
          mainWindow.webContents.send('download-updated', {
            id,
            state: 'progressing',
            receivedBytes: item.getReceivedBytes()
          });
        }
      }
    });

    item.once('done', (event, state) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('download-done', { id, state });
      }
    });
  });
};

app.on('session-created', (sess) => {
  registerAdBlock(sess);
  registerDownloadManager(sess);
});

// Increase max listeners for all WebContents to prevent EventEmitter warning
app.on('web-contents-created', (event, contents) => {
  contents.setMaxListeners(30);
});

app.whenReady().then(() => {
  registerAdBlock(session.defaultSession);
  registerDownloadManager(session.defaultSession);

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

ipcMain.on('toggle-adblock', (event, enabled) => {
  isAdBlockEnabled = enabled;
  console.log(`[Adblocker] Status changed to: ${isAdBlockEnabled}`);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

// Check if window is maximized (to toggle UI icons)
ipcMain.handle('window-is-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

// RAM and CPU stats tracking (Uses private memory to match Task Manager)
ipcMain.handle('get-browser-stats', () => {
  const metrics = app.getAppMetrics();
  let totalMemoryKB = 0;
  let totalCPU = 0;

  metrics.forEach(metric => {
    if (metric.memory) {
      // Sum private memory (corresponds to Task Manager's Private Working Set)
      const privateMem = typeof metric.memory.private === 'number' ? metric.memory.private : metric.memory.workingSetSize;
      if (privateMem) {
        totalMemoryKB += privateMem;
      }
    }
    if (metric.cpu && typeof metric.cpu.percentCPUUsage === 'number') {
      totalCPU += metric.cpu.percentCPUUsage;
    }
  });

  return {
    memoryMB: Math.round(totalMemoryKB / 1024),
    cpuPercent: Math.min(100, Math.round(totalCPU))
  };
});

// Clipboard IPC handlers for Clipboard Manager
const { clipboard, nativeImage, dialog } = require('electron');
const fs = require('fs');

ipcMain.handle('clipboard-read', () => {
  return clipboard.readText();
});
ipcMain.on('clipboard-write', (event, text) => {
  clipboard.writeText(text);
});
ipcMain.on('clipboard-write-image', (event, dataUrl) => {
  if (!dataUrl) return;
  try {
    const img = nativeImage.createFromDataURL(dataUrl);
    clipboard.writeImage(img);
  } catch (err) {
    console.error('[LowBrowser Screenshot] Clipboard image error:', err);
  }
});
ipcMain.handle('save-screenshot-dialog', async (event, dataUrl) => {
  if (!dataUrl) return { success: false, error: 'Veri yok' };
  try {
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Ekran Görüntüsünü Kaydet',
      defaultPath: `lowbrowser-screenshot-${Date.now()}.png`,
      filters: [{ name: 'PNG Görseli', extensions: ['png'] }]
    });

    if (!canceled && filePath) {
      await fs.promises.writeFile(filePath, base64Data, 'base64');
      return { success: true, filePath };
    }
    return { success: false, canceled: true };
  } catch (err) {
    console.error('[LowBrowser Screenshot] Save error:', err);
    return { success: false, error: err.message };
  }
});

// Google Suggest queries handler (Bypasses CORS restrictions)
ipcMain.handle('google-suggest', async (event, query) => {
  try {
    const res = await fetch(`https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const data = await res.json();
    return data; // Returns [query, [suggestions...]]
  } catch (e) {
    console.error('[Electron Suggest] Error fetching suggestions:', e);
    return [];
  }
});
