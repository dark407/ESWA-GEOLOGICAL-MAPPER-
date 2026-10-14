const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    title: 'Akash Tunnel Joint Tracer — PC Engineering Suite',
    backgroundColor: '#0B0E14',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.maximize();

  let editionSuffix = '';
  try {
    const fs = require('fs');
    const editionPath = path.join(__dirname, 'edition.json');
    if (fs.existsSync(editionPath)) {
      const parsed = JSON.parse(fs.readFileSync(editionPath, 'utf8'));
      if (parsed && parsed.edition === 'user') {
        editionSuffix = '?edition=user';
      }
    }
  } catch {
    // Ignore
  }

  const startUrl =
    process.env.ELECTRON_START_URL ||
    `file://${path.join(__dirname, '../dist/index.html')}${editionSuffix}`;

  win.loadURL(startUrl);

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
