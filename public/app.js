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
async function fetchDirectory(pathStr = '') {
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
    
    renderBreadcrumbs();
    processAndRenderFiles();
  } catch (error) {
    console.error('Error fetching directory:', error);
    explorerView.innerHTML = `
      <div class="empty-container">
        <div class="empty-icon">❌</div>
        <p>Error loading files: ${error.message}</p>
        <button class="btn btn-glass" style="margin-top:16px;" onclick="fetchDirectory('')">Return to Root</button>
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
    if (currentPath !== '') fetchDirectory('');
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
      if (currentPath !== targetPath) fetchDirectory(targetPath);
    });
    
    breadcrumbs.appendChild(crumb);
  });
}

// Render folder/file cards to explorer view
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
  
  // Set class for grid or list view
  explorerView.className = currentView === 'grid' ? 'grid-view' : 'list-view';
  
  filteredFilesList.forEach(item => {
    const { emoji, category } = getFileIconAndCategory(item.name, item.isDirectory);
    
    const card = document.createElement('div');
    card.className = `file-card ${item.isDirectory ? 'directory-card' : ''}`;
    
    // HTML contents of card
    card.innerHTML = `
      <span class="card-icon">${emoji}</span>
      <span class="card-name" title="${item.name}">${item.name}</span>
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
      
      if (item.isDirectory) {
        fetchDirectory(item.path);
      } else {
        openPreview(item, category);
      }
    });
    
    explorerView.appendChild(card);
  });
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
  fetchDirectory(parentPath);
});

searchInput.addEventListener('input', () => {
  processAndRenderFiles();
});

sortSelect.addEventListener('change', () => {
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

// Initialize on page load
fetchDirectory('');
