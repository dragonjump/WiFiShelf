const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3005;

// Determine target root directory:
// 1. First command line argument
// 2. Environment variable SERVE_DIR
// 3. Fallback to User Home Directory (Cross-platform default)
let rootDir = process.argv[2] || process.env.SERVE_DIR || os.homedir();
rootDir = path.resolve(rootDir);

console.log(`\n==================================================`);
console.log(`📁 Serving directory: ${rootDir}`);
console.log(`==================================================\n`);

// Safety check helper to prevent directory traversal
function safeResolve(reqPath) {
  if (!reqPath) return rootDir;
  
  // Resolve the path relative to the root directory
  const resolved = path.resolve(rootDir, reqPath);
  
  // Check if the resolved path is inside the root directory
  if (!resolved.startsWith(rootDir)) {
    throw new Error('Access denied: Path is outside the target root directory');
  }
  
  return resolved;
}

// HTTP Basic Authentication Configuration
const AUTH_USER = process.env.AUTH_USER || 'sean';
const AUTH_PASS = process.env.AUTH_PASS || 'sean';

function basicAuth(req, res, next) {
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

// Apply Basic Auth protecting all paths & endpoints
app.use(basicAuth);

// Serve public frontend files
app.use(express.static(path.join(__dirname, 'public'), { dotfiles: 'allow' }));

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

// API: View/Stream File (express automatically handles range requests via res.sendFile)
app.get('/api/view', (req, res) => {
  try {
    const relativeQueryPath = req.query.path;
    if (!relativeQueryPath) {
      return res.status(400).json({ error: 'Path is required' });
    }
    
    const absoluteFilePath = safeResolve(relativeQueryPath);
    
    // Check if file exists and is not a directory
    const stats = fs.statSync(absoluteFilePath);
    if (stats.isDirectory()) {
      return res.status(400).json({ error: 'Cannot view a directory' });
    }
    
    // Express sendFile handles ranges automatically for streaming
    res.sendFile(absoluteFilePath, {
      headers: {
        'Accept-Ranges': 'bytes'
      }
    });
  } catch (error) {
    console.error('Error viewing file:', error);
    res.status(500).json({ error: error.message });
  }
});

// API: Delete File or Folder
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
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Remote File Viewer is online!`);
  console.log(`🔗 Local:            http://localhost:${PORT}`);
  
  // Try to print the local IP address for easy access from other devices
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`🔗 On network link:  http://${net.address}:${PORT}`);
      }
    }
  }
  console.log(`\nPress Ctrl+C to stop the server.`);
});
