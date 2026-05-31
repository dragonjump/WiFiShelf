// Application State
let currentPath = '';
let filesList = [];
let filteredFilesList = [];
let currentView = 'grid'; // 'grid' or 'list'
let itemToDelete = null;

// DOM Elements
const explorerView = document.getElementById('explorer-view');
const breadcrumbs = document.getElementById('breadcrumbs');
const searchInput = document.getElementById('search-input');
const sortSelect = document.getElementById('sort-select');
const btnGridView = document.getElementById('btn-grid-view');
const btnListView = document.getElementById('btn-list-view');
const btnBack = document.getElementById('btn-back');
const folderStats = document.getElementById('folder-stats');
const hostNameSpan = document.getElementById('host-name');
const sizeSelect = document.getElementById('size-select');

// Application State Extensions
let currentSize = 'medium'; // 'small', 'medium', 'large'

// Preview Modal Elements
const previewModal = document.getElementById('preview-modal');
const modalTitle = document.getElementById('modal-title');
const modalFileIcon = document.getElementById('modal-file-icon');
const modalBodyContent = document.getElementById('modal-body-content');
const modalFileSize = document.getElementById('modal-file-size');
const modalDownload = document.getElementById('modal-download');
const modalClose = document.getElementById('modal-close');

// Delete Modal Elements
const deleteModal = document.getElementById('delete-modal');
const deleteItemName = document.getElementById('delete-item-name');
const deleteConfirm = document.getElementById('delete-confirm');
const deleteCancel = document.getElementById('delete-cancel');

// Set connection host display based on current window location
hostNameSpan.textContent = `Server: ${window.location.host}`;

// --- Theme Toggle Logic ---
const btnThemeToggle = document.getElementById('btn-theme-toggle');
const currentTheme = localStorage.getItem('theme') || 'dark';

if (currentTheme === 'light') {
  document.body.classList.add('light-theme');
  updateThemeIcon(true);
} else {
  updateThemeIcon(false);
}

btnThemeToggle.addEventListener('click', () => {
  const isLight = document.body.classList.toggle('light-theme');
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
  updateThemeIcon(isLight);
});

function updateThemeIcon(isLight) {
  if (isLight) {
    btnThemeToggle.innerHTML = `
      <svg class="theme-icon-moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>
    `;
  } else {
    btnThemeToggle.innerHTML = `
      <svg class="theme-icon-sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
      </svg>
    `;
  }
}


// --- Served Folder Dynamic Config Logic ---
const btnChangeRoot = document.getElementById('btn-change-root');
const currentRootDisplay = document.getElementById('current-root-display');
let currentRootPath = '';

// --- Sidebar Navigation Tree Logic ---
const treeRootContainer = document.getElementById('tree-root-container');

function getBaseName(fullPath) {
  const parts = fullPath.replace(/\\/g, '/').split('/');
  return parts.pop() || parts.pop() || fullPath; // Handles trailing slashes or drive roots
}

function createTreeNodeElement(name, path, hasChildren = true) {
  const node = document.createElement('div');
  node.className = 'tree-node';
  node.dataset.path = path;

  const row = document.createElement('div');
  row.className = 'tree-node-row';
  if (path === currentPath) row.classList.add('active');

  const toggle = document.createElement('span');
  toggle.className = `tree-toggle ${hasChildren ? '' : 'empty'}`;
  toggle.innerHTML = '▶';

  const icon = document.createElement('span');
  icon.className = 'tree-folder-icon';
  icon.textContent = '📁';

  const label = document.createElement('span');
  label.className = 'tree-label';
  label.textContent = name;
  label.title = name;

  row.appendChild(toggle);
  row.appendChild(icon);
  row.appendChild(label);
  node.appendChild(row);

  const childrenContainer = document.createElement('div');
  childrenContainer.className = 'tree-children';
  childrenContainer.style.display = 'none';
  node.appendChild(childrenContainer);

  // Toggle expand / collapse
  toggle.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (toggle.classList.contains('empty')) return;

    const isExpanded = toggle.classList.contains('expanded');
    if (isExpanded) {
      toggle.classList.remove('expanded');
      childrenContainer.style.display = 'none';
    } else {
      toggle.classList.add('expanded');
      childrenContainer.style.display = 'block';
      
      // Lazy load subfolders if container is empty
      if (childrenContainer.childElementCount === 0) {
        childrenContainer.innerHTML = '<div style="font-size:11px; padding:4px 12px; color:var(--text-muted);">Loading...</div>';
        const subfolders = await fetchSubfolders(path);
        childrenContainer.innerHTML = '';
        if (subfolders.length === 0) {
          toggle.classList.add('empty');
        } else {
          subfolders.forEach(sub => {
            const childNode = createTreeNodeElement(sub.name, sub.path, true);
            childrenContainer.appendChild(childNode);
          });
        }
      }
    }
  });

  // Navigate on clicking node row
  row.addEventListener('click', () => {
    window.location.hash = path;
  });

  return node;
}

// Fetch subfolders of specified directory
async function fetchSubfolders(pathStr) {
  try {
    const res = await fetch(`/api/files?path=${encodeURIComponent(pathStr)}`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    return data.files.filter(f => f.isDirectory);
  } catch (err) {
    console.error('Error fetching tree subfolders:', err);
    return [];
  }
}

// Set up / rebuild the navigation tree
async function refreshNavigationTree() {
  if (!treeRootContainer) return;
  treeRootContainer.innerHTML = '';
  
  // Build and insert top root node
  const rootNode = createTreeNodeElement('Root Folder', '', true);
  treeRootContainer.appendChild(rootNode);
  
  // Auto-expand the top-level root
  const rootToggle = rootNode.querySelector('.tree-toggle');
  if (rootToggle) rootToggle.click();
}

// Sync current highlighted directory node in tree view
function updateTreeActiveHighlight() {
  document.querySelectorAll('.tree-node-row').forEach(row => {
    const node = row.closest('.tree-node');
    if (node && node.dataset.path === currentPath) {
      row.classList.add('active');
    } else {
      row.classList.remove('active');
    }
  });
}

async function loadRootConfig() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    currentRootPath = data.rootDir;
    currentRootDisplay.textContent = getBaseName(currentRootPath);
    btnChangeRoot.title = `Serving: ${currentRootPath}`;
    
    // Initialize/Refresh tree view
    refreshNavigationTree();
  } catch (err) {
    console.error('Failed to load root path configuration:', err);
  }
}

btnChangeRoot.addEventListener('click', async () => {
  const newPath = prompt("Enter the absolute folder path you want to manage:", currentRootPath);
  if (newPath && newPath.trim() !== currentRootPath) {
    try {
      const res = await fetch('/api/config/root', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPath: newPath.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change root directory');
      
      currentRootPath = data.rootDir;
      currentRootDisplay.textContent = getBaseName(currentRootPath);
      btnChangeRoot.title = `Serving: ${currentRootPath}`;
      window.location.hash = ''; // Reset navigation hash back to root
      
      // Rebuild tree from new root
      refreshNavigationTree();
      fetchDirectory(''); // Fetch new directory files
    } catch (err) {
      alert("Error changing served directory: " + err.message);
    }
  }
});

// Load config immediately on page load
loadRootConfig();


// File Extension Configurations & Emojis
const FILE_TYPES = {
  // Videos
  video: { emoji: '🎥', exts: ['mp4', 'webm', 'ogg', 'mkv', 'avi', 'mov', 'flv'] },
  // Audio
  audio: { emoji: '🎵', exts: ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'] },
  // Images
  image: { emoji: '🖼️', exts: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'] },
  // Documents
  document: { emoji: '📄', exts: ['pdf'] },
  // Code / Scripts
  code: { emoji: '💻', exts: ['html', 'css', 'js', 'json', 'py', 'sh', 'bat', 'cmd', 'ps1', 'go', 'rs', 'cpp', 'c', 'h', 'ts', 'yaml', 'yml', 'md', 'txt', 'log'] },
  // Archives
  archive: { emoji: '📦', exts: ['zip', 'rar', '7z', 'tar', 'gz'] }
};

function getFileIconAndCategory(filename, isDirectory) {
  if (isDirectory) return { emoji: '📁', category: 'directory' };
  
  const ext = filename.split('.').pop().toLowerCase();
  for (const [category, config] of Object.entries(FILE_TYPES)) {
    if (config.exts.includes(ext)) {
      return { emoji: config.emoji, category };
    }
  }
  return { emoji: '📄', category: 'unknown' };
}

// Utility: Format File Size
function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Fetch files in directory
async function fetchDirectory(pathStr = '', updateHash = true) {
  showLoader();
  try {
    const res = await fetch(`/api/files?path=${encodeURIComponent(pathStr)}`);
    if (!res.ok) {
      throw new Error(`Failed to load directory: ${res.statusText}`);
    }
    const data = await res.json();
    currentPath = data.currentPath;
    filesList = data.files;
    
    // Manage Go Back state
    btnBack.disabled = (currentPath === '');
    
    // Sync hash
    if (updateHash) {
      window.location.hash = currentPath;
    }
    
    renderBreadcrumbs();
    processAndRenderFiles();
    updateTreeActiveHighlight();
  } catch (error) {
    console.error('Error fetching directory:', error);
    explorerView.innerHTML = `
      <div class="empty-container">
        <div class="empty-icon">❌</div>
        <p>Error loading files: ${error.message}</p>
        <button class="btn btn-glass" style="margin-top:16px;" onclick="window.location.hash = ''">Return to Root</button>
      </div>
    `;
  }
}

// Show UI Loader
function showLoader() {
  explorerView.innerHTML = `
    <div class="loading-spinner-container">
      <div class="spinner"></div>
      <p>Retrieving directory info...</p>
    </div>
  `;
}

// Process sorting & filtering, then render cards
function processAndRenderFiles() {
  const searchTerm = searchInput.value.toLowerCase().trim();
  
  // Filter
  filteredFilesList = filesList.filter(file => {
    return file.name.toLowerCase().includes(searchTerm);
  });
  
  // Sort
  const sortVal = sortSelect.value;
  filteredFilesList.sort((a, b) => {
    // Directories always float to the top
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    
    switch (sortVal) {
      case 'name-asc':
        return a.name.localeCompare(b.name);
      case 'name-desc':
        return b.name.localeCompare(a.name);
      case 'size-asc':
        return a.size - b.size;
      case 'size-desc':
        return b.size - a.size;
      case 'date-desc':
        return new Date(b.modifiedAt) - new Date(a.modifiedAt);
      case 'date-asc':
        return new Date(a.modifiedAt) - new Date(b.modifiedAt);
      case 'type-asc':
        return a.type.localeCompare(b.type);
      default:
        return 0;
    }
  });
  
  // Render
  renderFiles();
  
  // Update footer statistics
  const dirCount = filesList.filter(f => f.isDirectory).length;
  const fileCount = filesList.length - dirCount;
  folderStats.textContent = `${dirCount} folder${dirCount !== 1 ? 's' : ''}, ${fileCount} file${fileCount !== 1 ? 's' : ''}`;
}

// Render dynamic breadcrumbs
function renderBreadcrumbs() {
  breadcrumbs.innerHTML = '';
  
  // Root link
  const rootCrumb = document.createElement('span');
  rootCrumb.className = `crumb ${currentPath === '' ? 'active' : ''}`;
  rootCrumb.textContent = 'Root';
  rootCrumb.addEventListener('click', () => {
    if (currentPath !== '') window.location.hash = '';
  });
  breadcrumbs.appendChild(rootCrumb);
  
  if (currentPath === '') return;
  
  const parts = currentPath.split('/');
  let accumulatedPath = '';
  
  parts.forEach((part, index) => {
    if (!part) return;
    
    // Add separator
    const sep = document.createElement('span');
    sep.className = 'crumb-separator';
    sep.textContent = '/';
    breadcrumbs.appendChild(sep);
    
    accumulatedPath += (accumulatedPath ? '/' : '') + part;
    
    const crumb = document.createElement('span');
    crumb.className = `crumb ${index === parts.length - 1 ? 'active' : ''}`;
    crumb.textContent = part;
    
    const targetPath = accumulatedPath; // lock path string scope
    crumb.addEventListener('click', () => {
      if (currentPath !== targetPath) window.location.hash = targetPath;
    });
    
    breadcrumbs.appendChild(crumb);
  });
}

// --- Multi‑Select Delete Support ---
// Global selection state
let selectedItems = [];
const batchDeleteBtn = document.getElementById('btn-batch-delete');

function updateBatchDeleteBtn() {
  if (selectedItems.length > 0) {
    batchDeleteBtn.style.display = 'inline-flex';
    batchDeleteBtn.textContent = `Delete (${selectedItems.length})`;
  } else {
    batchDeleteBtn.style.display = 'none';
  }
}

function toggleSelection(item, card) {
  const index = selectedItems.findIndex(i => i.path === item.path);
  if (index === -1) {
    selectedItems.push(item);
    card.classList.add('selected');
  } else {
    selectedItems.splice(index, 1);
    card.classList.remove('selected');
  }
  updateBatchDeleteBtn();
}

// Long press detection (≈500 ms)
function attachLongPress(card, item) {
  let pressTimer = null;
  const start = (e) => {
    // Prevent default navigation on long press
    e.stopPropagation();
    pressTimer = setTimeout(() => {
      toggleSelection(item, card);
    }, 500);
  };
  const cancel = () => {
    clearTimeout(pressTimer);
  };
  card.addEventListener('mousedown', start);
  card.addEventListener('touchstart', start);
  card.addEventListener('mouseup', cancel);
  card.addEventListener('mouseleave', cancel);
  card.addEventListener('touchend', cancel);
  card.addEventListener('touchcancel', cancel);
}

// Batch delete handler
batchDeleteBtn.addEventListener('click', async () => {
  if (selectedItems.length === 0) return;
  const confirmMsg = selectedItems.length === 1
    ? `Delete "${selectedItems[0].name}" permanently? This cannot be undone.`
    : `Delete ${selectedItems.length} items permanently? This cannot be undone.`;
  if (!window.confirm(confirmMsg)) return;

  try {
    for (const itm of selectedItems) {
      await fetch(`/api/delete?path=${encodeURIComponent(itm.path)}`, { method: 'DELETE' });
    }
    // Refresh view
    await fetchDirectory(currentPath);
  } catch (err) {
    alert('Error during batch delete: ' + err.message);
  } finally {
    selectedItems = [];
    updateBatchDeleteBtn();
  }
});

function renderFiles() {
  explorerView.innerHTML = '';
  
  if (filteredFilesList.length === 0) {
    explorerView.innerHTML = `
      <div class="empty-container">
        <div class="empty-icon">📁</div>
        <p>No items found inside this folder.</p>
      </div>
    `;
    return;
  }
  
  // Set class for grid or list view and size configurations
  if (currentView === 'grid') {
    explorerView.className = `grid-view view-size-${currentSize}`;
    document.body.classList.remove('list-mode');
  } else {
    explorerView.className = 'list-view';
    document.body.classList.add('list-mode');
  }
  
  filteredFilesList.forEach(item => {
    const { emoji, category } = getFileIconAndCategory(item.name, item.isDirectory);
    
    // Determine icon layout (use live image/video thumbnail)
    let iconHtml = `<span class="card-icon">${emoji}</span>`;
    if (category === 'image') {
      const imageUrl = `/api/view?path=${encodeURIComponent(item.path)}`;
      iconHtml = `<img class="card-thumb" src="${imageUrl}" alt="${item.name}">`;
    } else if (category === 'video') {
      const videoUrl = `/api/view?path=${encodeURIComponent(item.path)}#t=0.1`;
      iconHtml = `<video class="card-thumb" src="${videoUrl}" muted playsinline loop preload="metadata"></video>`;
    }

    const card = document.createElement('div');
    card.className = `file-card ${item.isDirectory ? 'directory-card' : ''}`;
    
    // Attach long‑press selection to each card
    attachLongPress(card, item);

    // HTML contents of card
    card.innerHTML = `
      ${iconHtml}
      <div class="card-name-container">
        <span class="card-name" title="${item.name}">${item.name}</span>
        ${category === 'video' ? `
          <button class="btn-eye-preview" title="Preview video">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
        ` : ''}
      </div>
      <span class="card-meta">
        ${item.isDirectory ? 'Folder' : formatSize(item.size)}
      </span>
      <div class="card-actions">
        ${!item.isDirectory ? `
          <button class="btn-card-action btn-card-download" title="Download file">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
        ` : ''}
        <button class="btn-card-action btn-card-delete" title="Delete permanently">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
        </button>
      </div>
    `;
    
    // Main card click event
    card.addEventListener('click', (e) => {
      // Check if delete or download action was clicked
      if (e.target.closest('.btn-card-delete')) {
        e.stopPropagation();
        triggerDelete(item);
        return;
      }
      if (e.target.closest('.btn-card-download')) {
        e.stopPropagation();
        downloadFile(item);
        return;
      }
      if (e.target.closest('.btn-eye-preview')) {
        e.stopPropagation();
        toggleVideoPreview(card, e.target.closest('.btn-eye-preview'));
        return;
      }
      
      if (item.isDirectory) {
        window.location.hash = item.path;
      } else {
        openPreview(item, category);
      }
    });
    
    explorerView.appendChild(card);
  });
}

// Toggle loop-play for video thumbnail
function toggleVideoPreview(card, eyeBtn) {
  const video = card.querySelector('video.card-thumb');
  if (!video) return;

  if (video.paused) {
    // Pause other playing previews first for performance
    document.querySelectorAll('video.card-thumb').forEach(v => {
      if (v !== video && !v.paused) {
        v.pause();
        const otherCard = v.closest('.file-card');
        if (otherCard) {
          const otherEye = otherCard.querySelector('.btn-eye-preview');
          if (otherEye) otherEye.classList.remove('active');
        }
      }
    });

    video.play().catch(err => console.error('Error playing video preview:', err));
    eyeBtn.classList.add('active');
  } else {
    video.pause();
    eyeBtn.classList.remove('active');
  }
}

// Download file handler
function downloadFile(file) {
  const downloadUrl = `/api/view?path=${encodeURIComponent(file.path)}`;
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// File preview overlay rendering
async function openPreview(file, category) {
  const fileUrl = `/api/view?path=${encodeURIComponent(file.path)}`;
  
  modalTitle.textContent = file.name;
  modalFileSize.textContent = `Size: ${formatSize(file.size)}`;
  modalDownload.href = fileUrl;
  modalDownload.download = file.name;
  
  const { emoji } = getFileIconAndCategory(file.name, false);
  modalFileIcon.textContent = emoji;
  
  modalBodyContent.innerHTML = '';
  
  if (category === 'video') {
    modalBodyContent.innerHTML = `
      <video src="${fileUrl}" controls autoplay class="preview-video">
        Your browser does not support HTML5 video player.
      </video>
    `;
  } else if (category === 'audio') {
    modalBodyContent.innerHTML = `
      <div class="preview-audio-container" style="text-align: center;">
        <span style="font-size: 72px; display: block; margin-bottom: 20px; animation: pulse 2s infinite;">🎵</span>
        <audio src="${fileUrl}" controls autoplay class="preview-audio"></audio>
      </div>
    `;
  } else if (category === 'image') {
    modalBodyContent.innerHTML = `<img src="${fileUrl}" alt="${file.name}" class="preview-image">`;
  } else if (category === 'document') {
    modalBodyContent.innerHTML = `<iframe src="${fileUrl}" class="preview-pdf"></iframe>`;
  } else if (category === 'code') {
    modalBodyContent.innerHTML = `<div class="spinner"></div><p>Fetching text details...</p>`;
    try {
      const res = await fetch(fileUrl);
      const text = await res.text();
      // Simple escape HTML
      const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      
      modalBodyContent.innerHTML = `<pre class="preview-text"><code>${escaped}</code></pre>`;
    } catch (err) {
      modalBodyContent.innerHTML = `<p class="text-danger">Failed to load text contents: ${err.message}</p>`;
    }
  } else {
    modalBodyContent.innerHTML = `
      <div class="preview-unknown">
        <div class="preview-unknown-icon">📦</div>
        <p>No preview is available for this file type.</p>
        <p style="color: var(--text-secondary); margin-top: 10px; font-size: 13px;">You can still download this file onto your computer.</p>
      </div>
    `;
  }
  
  previewModal.classList.add('open');
}

// Close preview overlay and pause players
function closePreview() {
  // Remove content to stop audio/video streaming
  modalBodyContent.innerHTML = '';
  previewModal.classList.remove('open');
}

// Trigger safety deletion modal
function triggerDelete(item) {
  itemToDelete = item;
  deleteItemName.textContent = item.name;
  deleteModal.classList.add('open');
}

// Perform final deletion request
async function confirmDeletion() {
  if (!itemToDelete) return;
  
  deleteModal.classList.remove('open');
  showLoader();
  
  try {
    const res = await fetch(`/api/delete?path=${encodeURIComponent(itemToDelete.path)}`, {
      method: 'DELETE'
    });
    
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to delete');
    
    // Refresh folder view
    await fetchDirectory(currentPath);
  } catch (error) {
    alert(`Could not delete item: ${error.message}`);
    // Recover/render standard files
    processAndRenderFiles();
  } finally {
    itemToDelete = null;
  }
}

// Event Listeners setup
btnGridView.addEventListener('click', () => {
  if (currentView !== 'grid') {
    currentView = 'grid';
    btnGridView.classList.add('active');
    btnListView.classList.remove('active');
    processAndRenderFiles();
  }
});

btnListView.addEventListener('click', () => {
  if (currentView !== 'list') {
    currentView = 'list';
    btnListView.classList.add('active');
    btnGridView.classList.remove('active');
    processAndRenderFiles();
  }
});

btnBack.addEventListener('click', () => {
  if (currentPath === '') return;
  const parts = currentPath.split('/');
  parts.pop();
  const parentPath = parts.join('/');
  window.location.hash = parentPath;
});

searchInput.addEventListener('input', () => {
  processAndRenderFiles();
});

sortSelect.addEventListener('change', () => {
  processAndRenderFiles();
});

sizeSelect.addEventListener('change', () => {
  currentSize = sizeSelect.value;
  processAndRenderFiles();
});

// Close Preview Event Handlers
modalClose.addEventListener('click', closePreview);
previewModal.addEventListener('click', (e) => {
  if (e.target === previewModal) closePreview();
});

// Delete Modal Event Handlers
deleteCancel.addEventListener('click', () => {
  deleteModal.classList.remove('open');
  itemToDelete = null;
});
deleteConfirm.addEventListener('click', confirmDeletion);
deleteModal.addEventListener('click', (e) => {
  if (e.target === deleteModal) {
    deleteModal.classList.remove('open');
    itemToDelete = null;
  }
});

// ESC key to close open modals
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closePreview();
    deleteModal.classList.remove('open');
    itemToDelete = null;
  }
});

// Listen for URL hash changes (handles back/forward browser history)
// Tree Search filtering
const treeSearchInput = document.getElementById('tree-search-input');
if (treeSearchInput) {
  // Debounce input to avoid excessive processing
  let treeSearchTimer = null;
  treeSearchInput.addEventListener('input', () => {
    clearTimeout(treeSearchTimer);
    treeSearchTimer = setTimeout(() => {
      filterTree(treeSearchInput.value.trim().toLowerCase());
    }, 200);
  });
}

function filterTree(query) {
  // Always show root node
  const rootNodes = Array.from(treeRootContainer.children);
  rootNodes.forEach(root => filterTreeNode(root, query, true));
}

function filterTreeNode(node, query, isRoot = false) {
  const labelEl = node.querySelector('.tree-label');
  const label = labelEl ? labelEl.textContent.toLowerCase() : '';
  const childrenContainer = node.querySelector('.tree-children');
  let childMatches = false;
  if (childrenContainer && childrenContainer.children.length > 0) {
    const childNodes = Array.from(childrenContainer.children);
    childNodes.forEach(child => {
      const childMatch = filterTreeNode(child, query, false);
      if (childMatch) childMatches = true;
    });
  }
  const selfMatch = isRoot || label.includes(query);
  const shouldShow = selfMatch || childMatches;
  node.style.display = shouldShow ? '' : 'none';
  // Auto‑expand if there are matching descendants
  const toggle = node.querySelector('.tree-toggle');
  if (toggle && childrenContainer) {
    if (childMatches) {
      toggle.classList.add('expanded');
      childrenContainer.style.display = 'block';
    } else if (!selfMatch) {
      toggle.classList.remove('expanded');
      childrenContainer.style.display = 'none';
    }
  }
  return shouldShow;
}

window.addEventListener('hashchange', () => {
  const hashPath = decodeURIComponent(window.location.hash.substring(1)) || '';
  if (currentPath !== hashPath) {
    fetchDirectory(hashPath, false);
  }
});

// Initialize on page load
const initialHash = decodeURIComponent(window.location.hash.substring(1)) || '';
fetchDirectory(initialHash, false);
