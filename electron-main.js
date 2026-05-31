const { app, BrowserWindow } = require('electron');
const path = require('path');
const { exec } = require('child_process');

let mainWindow;
let serverProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, 'public', 'image.png'),
  });

  const port = process.env.PORT || 3006;
  const serverUrl = `http://localhost:${port}`;
  mainWindow.loadURL(serverUrl);

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (serverProcess) {
      serverProcess.kill();
    }
  });
}

app.whenReady().then(() => {
  // Start the existing Node server as a background process
  serverProcess = exec('node server.js', { cwd: path.join(__dirname) });
  serverProcess.stdout.on('data', (data) => console.log('[Server]', data.trim()));
  serverProcess.stderr.on('data', (data) => console.error('[Server]', data.trim()));

  // Wait a moment for server to start, then open window
  setTimeout(createWindow, 1500);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (serverProcess) serverProcess.kill();
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
