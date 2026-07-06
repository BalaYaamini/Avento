const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow;
let serverProcess;
const PORT = process.env.PORT || 5001;

function startServer() {
  const serverPath = path.join(__dirname, 'server', 'server.js');
  console.log(`Starting backend server at: ${serverPath}`);
  
  serverProcess = spawn('node', [serverPath], {
    env: { ...process.env, PORT: PORT },
    stdio: 'inherit'
  });
  
  serverProcess.on('error', (err) => {
    console.error('Failed to start backend server:', err);
  });
}

function checkServerReady(callback) {
  const req = http.get(`http://127.0.0.1:${PORT}/`, (res) => {
    if (res.statusCode === 200) {
      callback();
    } else {
      setTimeout(() => checkServerReady(callback), 100);
    }
  });
  
  req.on('error', () => {
    setTimeout(() => checkServerReady(callback), 100);
  });
}

function ensureServerRunning(callback) {
  const req = http.get(`http://127.0.0.1:${PORT}/`, (res) => {
    console.log(`Backend server is already running on port ${PORT}`);
    callback();
  });
  
  req.on('error', (err) => {
    if (process.argv.includes('--no-backend')) {
      console.log(`Waiting for backend on port ${PORT}... (${err.message})`);
      setTimeout(() => ensureServerRunning(callback), 1000);
    } else {
      console.log(`No backend server found on port ${PORT}. Starting server...`);
      startServer();
      checkServerReady(callback);
    }
  });
}

function checkClientReady(callback) {
  const req = http.get('http://localhost:3000/', (res) => {
    callback();
  });
  
  req.on('error', () => {
    setTimeout(() => checkClientReady(callback), 200);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    title: 'AVENTO - University Event Management Platform',
    autoHideMenuBar: true
  });

  const isDev = !app.isPackaged && !process.argv.includes('--production') && !process.argv.includes('--prod');

  ensureServerRunning(() => {
    if (isDev) {
      console.log('Running in Development mode. Waiting for Vite dev server on port 3000...');
      checkClientReady(() => {
        console.log('Vite dev server is ready! Loading app...');
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools();
      });
    } else {
      console.log('Running in Production mode. Loading client from backend server...');
      mainWindow.loadURL(`http://localhost:${PORT}`);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('will-quit', () => {
  if (serverProcess) {
    console.log('Terminating backend server process...');
    serverProcess.kill();
  }
});
