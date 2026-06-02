const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const QRCode = require('qrcode');
const QRCodeTerminal = require('qrcode-terminal');

const mime = require('mime-types');

// Load optional config.json for default root directory
let config = {};
try {
  config = require('./config.json');
} catch (e) {
  // No config file – ignore
}
const app = express();

const PORT = process.env.PORT || 3006;

// Determine target root directory:
// 1. First command line argument
// 2. Environment variable SERVE_DIR
// 3. config.defaultRoot (if provided)
// 4. User Home Directory (Cross-platform default)
let rootDir = process.argv[2] || process.env.SERVE_DIR || config.defaultRoot || os.homedir();
rootDir = path.resolve(rootDir);

console.log(`\n==================================================`);
console.log(`📁 Serving directory: ${rootDir}`);
console.log(`==================================================\n`);

// Safety check helper to prevent directory traversal
// Helper for packaged asset paths (used for view endpoint)
function getAssetPath(relativePath) {
  if (process.pkg) {
    return path.join(path.dirname(process.execPath), relativePath);
  }
  return path.join(__dirname, relativePath);
}

function getStaticPath() {
  if (process.pkg) {
    // Assets will be copied next to the executable
    return path.join(path.dirname(process.execPath), 'public');
  }
  return path.join(__dirname, 'public');
}

function copyAssets() {
  // Determine source directory for assets.
  // In development (__dirname) points to the project folder.
  // When running from a packaged binary (process.pkg), __dirname is inside the virtual snapshot and cannot be read.
  // In that case we fall back to the working directory (process.cwd()) where the original source files exist.
  const srcDir = process.pkg ? path.join(process.cwd(), 'public') : path.join(__dirname, 'public');
  const destDir = path.join(path.dirname(process.execPath), 'public');
  const copyRecursive = (src, dest) => {
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        if (!fs.existsSync(destPath)) {
          fs.mkdirSync(destPath);
        }
        copyRecursive(srcPath, destPath);
      } else {
        try {
          const data = fs.readFileSync(srcPath);
          fs.writeFileSync(destPath, data);
        } catch (e) {
          // ignore errors for virtual files that cannot be read directly
        }
      }
    }
  };
  try {
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    copyRecursive(srcDir, destDir);
    console.log('Assets copied to', destDir);
  } catch (err) {
    console.warn('Asset copy failed (may be running in dev mode):', err.message);
  }
}

function safeResolve(reqPath) {
  if (!reqPath) return rootDir;

  // Resolve the path relative to the root directory
  const resolved = path.resolve(rootDir, reqPath);

  // Ensure the resolved path stays within rootDir
  if (!resolved.startsWith(rootDir)) {
    throw new Error('Access denied: Path is outside the target root directory');
  }

  return resolved;
}

// HTTP Basic Authentication Configuration
const AUTH_USER = process.env.AUTH_USER || 'sean';
const AUTH_PASS = process.env.AUTH_PASS || 'sean';

function basicAuth(req, res, next) {
  // Bypass auth for API view, video directory, root, and static assets
  const publicAsset = /\.(html?|css|js|png|svg|jpg|jpeg|gif|ico|json)$/i;
  if (
    req.path.startsWith('/api/view') ||
    req.path.startsWith('/videos') ||
    req.path === '/' ||
    publicAsset.test(req.path)
  ) {
    return next();
  }
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Secure Remote File Viewer"');
    return res.status(401).send('Authentication Required');
  }

  const credentialsStr = Buffer.from(authHeader.split(' ')[1], 'base64').toString();
  const [user, pass] = credentialsStr.split(':');

  if (user === AUTH_USER && pass === AUTH_PASS) {
    return next();
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="Secure Remote File Viewer"');
  return res.status(401).send('Access Denied: Incorrect Credentials');
}

// Serve public frontend files (HTML, CSS, JS) before auth
app.use(express.static(getStaticPath(), { extensions: ['html', 'htm'], index: 'index.html' }));

// Apply Basic Auth protecting all other paths and endpoints
app.use(basicAuth);

// Serve video files with range support
app.use('/videos', express.static(rootDir, {
  extensions: ['mp4', 'webm', 'ogg', 'avi', 'mov', 'flv'],
  setHeaders: (res, path) => {
    // Enable range requests for efficient parallel chunk loading
    res.setHeader('Accept-Ranges', 'bytes');
    // Short cache for video content
    res.setHeader('Cache-Control', 'public, max-age=86400');
  }
}));

// API: Get current config (like current root directory path)
app.get('/api/config', (req, res) => {
  res.json({ rootDir });
});

// API: Dynamically change root directory at runtime
app.post('/api/config/root', express.json(), (req, res) => {
  const { newPath } = req.body;
  if (!newPath) return res.status(400).json({ error: 'Path is required' });

  try {
    const resolvedPath = path.resolve(newPath);
    if (!fs.existsSync(resolvedPath)) {
      return res.status(400).json({ error: 'Directory does not exist' });
    }
    const stats = fs.statSync(resolvedPath);
    if (!stats.isDirectory()) {
      return res.status(400).json({ error: 'Path must be a directory' });
    }

    rootDir = resolvedPath;
    console.log(`🔄 Root directory dynamically changed to: ${rootDir}`);
    res.json({ success: true, rootDir });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: List files in directory
app.get('/api/files', async (req, res) => {
  try {
    const relativeQueryPath = req.query.path || '';
    const absoluteTargetDir = safeResolve(relativeQueryPath);

    // Check if target exists and is a directory
    const stats = await fs.promises.stat(absoluteTargetDir);
    if (!stats.isDirectory()) {
      return res.status(400).json({ error: 'Target is not a directory' });
    }

    const items = await fs.promises.readdir(absoluteTargetDir, { withFileTypes: true });

    const fileList = [];
    for (const item of items) {
      const itemRelativePath = path.join(relativeQueryPath, item.name);
      const itemAbsolutePath = path.join(absoluteTargetDir, item.name);

      try {
        const itemStats = await fs.promises.stat(itemAbsolutePath);

        fileList.push({
          name: item.name,
          path: itemRelativePath.replace(/\\/g, '/'), // uniform path separator
          isDirectory: item.isDirectory(),
          size: itemStats.size,
          modifiedAt: itemStats.mtime,
          type: item.isDirectory() ? 'directory' : path.extname(item.name).toLowerCase().slice(1)
        });
      } catch (err) {
        // Skip files that fail to stat (e.g. permission issues or broken symlinks)
        continue;
      }
    }

    res.json({
      currentPath: relativeQueryPath.replace(/\\/g, '/'),
      files: fileList
    });
  } catch (error) {
    console.error('Error reading directory:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/view', (req, res) => {
  try {
    const relativeQueryPath = req.query.path;
    if (!relativeQueryPath) {
      return res.status(400).json({ error: 'Path is required' });
    }
    // Resolve path within rootDir
    const absoluteFilePath = safeResolve(relativeQueryPath);
    // In the packaged binary we still have access to the real filesystem, so use the absolute path directly.
    const assetPath = absoluteFilePath;
    const stats = fs.statSync(assetPath);
    if (stats.isDirectory()) {
      return res.status(400).json({ error: 'Cannot view a directory' });
    }
    const startTime = Date.now();
    const onFinished = require('on-finished');
    onFinished(res, () => {
      const duration = Date.now() - startTime;
      console.log(`[TIMING] Served ${relativeQueryPath} in ${duration}ms`);
    });
    const contentType = mime.lookup(assetPath) || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(assetPath);
  } catch (error) {
    console.error('Error viewing file:', error);
    res.status(500).json({ error: error.message });
  }
});



// API: Generate QR code for server URL (default to localhost)
app.get('/api/qr', (req, res) => {
  const host = req.headers.host || `localhost:${PORT}`;
  const url = `http://${host}`;
  QRCode.toDataURL(url, (err, src) => {
    if (err) {
      console.error('QR generation error:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json({ qrDataUrl: src, url });
  });
});

app.delete('/api/delete', async (req, res) => {
  try {
    const relativeQueryPath = req.query.path;
    if (!relativeQueryPath) {
      return res.status(400).json({ error: 'Path is required' });
    }

    const absolutePath = safeResolve(relativeQueryPath);

    // Do not allow deleting the root directory itself
    if (absolutePath === rootDir) {
      return res.status(400).json({ error: 'Cannot delete the root directory' });
    }

    const stats = await fs.promises.stat(absolutePath);

    if (stats.isDirectory()) {
      await fs.promises.rm(absolutePath, { recursive: true, force: true });
    } else {
      await fs.promises.unlink(absolutePath);
    }

    res.json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    console.error('Error deleting:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start the server
app.listen(PORT, '0.0.0.0', async () => {
  // Ensure assets are available on real filesystem for pkg
  copyAssets();
  console.log(`🚀 Remote File Viewer is online!`);
  let startupUrl = `http://localhost:${PORT}`;


  console.log(`🔗 Local:            http://localhost:${PORT}`);
  // Try to print the local IP address for easy access from other devices
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
      if (net.family === 'IPv4' && !net.internal) {
        startupUrl = `http://${net.address}:${PORT}`
        console.log(`🔗 On network link:  http://${net.address}:${PORT}`);
        try {
          const src = await QRCode.toDataURL(startupUrl);
          // console.log('📱 QR Code (data URL):', src);
        } catch (err) {
          console.error('QR generation error at startup:', err);
        }
        // Print QR code to terminal
        QRCodeTerminal.generate(startupUrl, { small: true }, qr => {
          console.log('\n--- QR code (terminal) ---');
          console.log(qr);
          console.log('--- end QR code ---\n');
        });
      }
    }
  }

  console.log(`\nPress Ctrl+C to stop the server.`);
});
