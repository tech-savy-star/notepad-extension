class PureNotepad {
  constructor() {
    // Prevent multiple instances
    if (window.pureNotepadInstance) {
      return window.pureNotepadInstance;
    }
    window.pureNotepadInstance = this;
    
    this.isVisible = false;
    this.isDragging = false;
    this.isResizing = false;
    this.currentNote = null;
    this.notes = [];
    this.settings = {};
    this.dragOffset = { x: 0, y: 0 };
    this.searchMode = false;
    this.isMaximized = false;
    this.originalSize = {};
    this.saveTimeout = null;
    this.popupVisible = false;
    
    this.init();
  }

  async init() {
    await this.loadData();
    this.createNotepad();
    this.setupEventListeners();
    this.applyTheme();
    this.updateNotesList();
  }

  async loadData() {
    try {
      const data = await chrome.storage.local.get(['notes', 'currentNoteId', 'settings']);
      this.notes = data.notes || [];
      this.currentNoteId = data.currentNoteId || (this.notes[0]?.id);
      this.settings = data.settings || {};
      this.currentNote = this.notes.find(note => note.id === this.currentNoteId) || this.notes[0];
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }

  async saveData() {
    try {
      await chrome.storage.local.set({
        notes: this.notes,
        currentNoteId: this.currentNoteId,
        settings: this.settings
      });
    } catch (error) {
      console.error('Error saving data:', error);
    }
  }

  createNotepad() {
    // Main container
    this.container = document.createElement('div');
    this.container.id = 'pure-notepad';
    this.container.className = 'pure-notepad-container';
    this.container.style.cssText = `
      position: fixed;
      top: ${this.settings.position?.y || 100}px;
      left: ${this.settings.position?.x || 100}px;
      width: ${this.settings.size?.width || 450}px;
      height: ${this.settings.size?.height || 600}px;
      z-index: 999999;
      display: none;
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
      box-shadow: 0 25px 50px rgba(0,0,0,0.4);
      border-radius: 12px;
      overflow: hidden;
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255,255,255,0.2);
      transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    `;

    // Title bar with macOS traffic lights
    const titleBar = document.createElement('div');
    titleBar.className = 'pure-notepad-titlebar';
    titleBar.innerHTML = `
      <div class="traffic-lights">
        <div class="traffic-light close" data-action="close" title="Close"></div>
        <div class="traffic-light minimize" data-action="minimize" title="Minimize"></div>
        <div class="traffic-light maximize" data-action="maximize" title="Maximize"></div>
      </div>
      <div class="title">Pure Notepad</div>
      <div class="controls">
        <button class="control-btn" data-action="search" title="Search Notes (⌘+F)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
        </button>
        <button class="control-btn" data-action="new-note" title="New Note (⌘+N)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
        <button class="control-btn" data-action="settings" title="Settings">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M12 1v6m0 10v6m11-7h-6m-10 0H1m8.5-8.5l4.24 4.24m-4.24-4.24L16.5 7.5m-8.5 8.5L12.5 11.5"></path>
          </svg>
        </button>
      </div>
    `;

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'pure-notepad-toolbar';
    toolbar.innerHTML = `
      <select class="note-selector" title="Select Note">
        <option value="">Select a note...</option>
      </select>
      <div class="toolbar-actions">
        <button class="toolbar-btn" data-action="bold" title="Bold (⌘+B)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6V4z"></path>
            <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6V12z"></path>
          </svg>
        </button>
        <button class="toolbar-btn" data-action="italic" title="Italic (⌘+I)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="19" y1="4" x2="10" y2="4"></line>
            <line x1="14" y1="20" x2="5" y2="20"></line>
            <line x1="15" y1="4" x2="9" y2="20"></line>
          </svg>
        </button>
        <button class="toolbar-btn" data-action="export" title="Export Note">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7,10 12,15 17,10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </button>
        <button class="toolbar-btn delete-btn" data-action="delete" title="Delete Note">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3,6 5,6 21,6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
          </svg>
        </button>
      </div>
    `;

    // Main content area
    const content = document.createElement('div');
    content.className = 'pure-notepad-content';
    content.innerHTML = `
      <div class="search-container" style="display: none;">
        <div class="search-input-wrapper">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <input type="text" class="search-input" placeholder="Search notes...">
        </div>
        <button class="search-close" title="Close Search">×</button>
      </div>
      <div class="note-title-container">
        <input type="text" class="note-title" placeholder="Note title..." value="${this.currentNote?.title || ''}">
      </div>
      <textarea class="note-editor" placeholder="Start writing your thoughts...">${this.currentNote?.content || ''}</textarea>
      <div class="status-bar">
        <div class="status-left">
          <span class="word-count">0 words</span>
          <span class="char-count">0 characters</span>
        </div>
        <div class="status-right">
          <span class="save-status">Saved</span>
          <span class="last-modified">Never</span>
        </div>
      </div>
    `;

    // Resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    resizeHandle.title = 'Resize';

    // Assemble notepad
    this.container.appendChild(titleBar);
    this.container.appendChild(toolbar);
    this.container.appendChild(content);
    this.container.appendChild(resizeHandle);

    document.body.appendChild(this.container);

    // Store references
    this.titleBar = titleBar;
    this.toolbar = toolbar;
    this.content = content;
    this.editor = content.querySelector('.note-editor');
    this.noteTitle = content.querySelector('.note-title');
    this.searchContainer = content.querySelector('.search-container');
    this.searchInput = content.querySelector('.search-input');
    this.noteSelector = toolbar.querySelector('.note-selector');
    this.wordCount = content.querySelector('.word-count');
    this.charCount = content.querySelector('.char-count');
    this.saveStatus = content.querySelector('.save-status');
    this.lastModified = content.querySelector('.last-modified');
    this.resizeHandle = resizeHandle;

    this.updateWordCount();
    this.updateLastModified();
  }

  setupEventListeners() {
    // Title bar actions
    this.titleBar.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      switch(action) {
        case 'close':
          this.hide();
          break;
        case 'minimize':
          this.minimize();
          break;
        case 'maximize':
          this.toggleMaximize();
          break;
        case 'search':
          this.toggleSearch();
          break;
        case 'new-note':
          this.createNewNote();
          break;
        case 'settings':
          this.showSettings();
          break;
      }
    });

    // Toolbar actions
    this.toolbar.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      switch(action) {
        case 'bold':
          this.formatText('**', '**');
          break;
        case 'italic':
          this.formatText('*', '*');
          break;
        case 'export':
          this.exportNote();
          break;
        case 'delete':
          this.deleteCurrentNote();
          break;
      }
    });

    // Note selector
    this.noteSelector.addEventListener('change', (e) => {
      if (e.target.value) {
        this.switchNote(e.target.value);
      }
    });

    // Note title
    this.noteTitle.addEventListener('input', () => {
      if (this.currentNote) {
        this.currentNote.title = this.noteTitle.value || 'Untitled Note';
        this.updateNotesList();
        this.autoSave();
      }
    });

    // Editor events
    this.editor.addEventListener('input', () => {
      this.updateWordCount();
      this.autoSave();
    });

    this.editor.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey) {
        switch(e.key) {
          case 'b':
            e.preventDefault();
            this.formatText('**', '**');
            break;
          case 'i':
            e.preventDefault();
            this.formatText('*', '*');
            break;
          case 's':
            e.preventDefault();
            this.saveNote();
            break;
          case 'f':
            e.preventDefault();
            this.toggleSearch();
            break;
          case 'n':
            e.preventDefault();
            this.createNewNote();
            break;
        }
      }
    });

    // Search
    this.searchInput.addEventListener('input', (e) => {
      this.searchNotes(e.target.value);
    });

    this.searchContainer.querySelector('.search-close').addEventListener('click', () => {
      this.toggleSearch();
    });

    // Dragging
    this.titleBar.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('traffic-light') || 
          e.target.classList.contains('control-btn') ||
          e.target.closest('.control-btn')) return;
      this.startDrag(e);
    });

    // Resizing
    this.resizeHandle.addEventListener('mousedown', (e) => {
      this.startResize(e);
    });

    // Global mouse events
    document.addEventListener('mousemove', (e) => {
      if (this.isDragging) this.drag(e);
      if (this.isResizing) this.resize(e);
    });

    document.addEventListener('mouseup', () => {
      this.isDragging = false;
      this.isResizing = false;
    });

    // Prevent text selection while dragging
    document.addEventListener('selectstart', (e) => {
      if (this.isDragging || this.isResizing) {
        e.preventDefault();
      }
    });

    // Message listener for keyboard shortcut
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      sendResponse({received: true}); // Always send response to prevent errors
      
      if (request.action === 'toggleNotepad') {
        this.toggle();
      } else if (request.action === 'showPopup') {
        this.showExtensionPopup();
      } else if (request.action === 'storageChanged') {
        this.handleStorageChange(request.changes);
      }
      
      return true; // Keep message channel open
    });

    // Auto-save interval
    setInterval(() => {
      if (this.currentNote && (
        this.editor.value !== this.currentNote.content ||
        this.noteTitle.value !== this.currentNote.title
      )) {
        this.saveNote();
      }
    }, 5000);
  }

  show() {
    this.container.style.display = 'block';
    this.container.style.opacity = '0';
    this.container.style.transform = 'scale(0.95)';
    
    requestAnimationFrame(() => {
      this.container.style.opacity = '1';
      this.container.style.transform = 'scale(1)';
    });
    
    this.isVisible = true;
    setTimeout(() => this.editor.focus(), 100);
  }

  hide() {
    this.container.style.opacity = '0';
    this.container.style.transform = 'scale(0.95)';
    
    setTimeout(() => {
      this.container.style.display = 'none';
      this.isVisible = false;
    }, 300);
  }

  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  minimize() {
    this.container.style.transform = 'scale(0.1)';
    this.container.style.opacity = '0';
    setTimeout(() => {
      this.hide();
    }, 300);
  }

  toggleMaximize() {
    if (this.isMaximized) {
      // Restore
      this.container.style.width = this.originalSize.width + 'px';
      this.container.style.height = this.originalSize.height + 'px';
      this.container.style.top = this.originalSize.top + 'px';
      this.container.style.left = this.originalSize.left + 'px';
      this.container.style.borderRadius = '12px';
      this.isMaximized = false;
    } else {
      // Store original size
      this.originalSize = {
        width: this.container.offsetWidth,
        height: this.container.offsetHeight,
        top: parseInt(this.container.style.top),
        left: parseInt(this.container.style.left)
      };
      
      // Maximize
      this.container.style.width = '100vw';
      this.container.style.height = '100vh';
      this.container.style.top = '0px';
      this.container.style.left = '0px';
      this.container.style.borderRadius = '0px';
      this.isMaximized = true;
    }
  }

  startDrag(e) {
    this.isDragging = true;
    const rect = this.container.getBoundingClientRect();
    this.dragOffset.x = e.clientX - rect.left;
    this.dragOffset.y = e.clientY - rect.top;
    this.container.style.cursor = 'grabbing';
  }

  drag(e) {
    if (!this.isDragging) return;
    const x = e.clientX - this.dragOffset.x;
    const y = e.clientY - this.dragOffset.y;
    
    // Constrain to viewport
    const maxX = window.innerWidth - this.container.offsetWidth;
    const maxY = window.innerHeight - this.container.offsetHeight;
    const newX = Math.max(0, Math.min(maxX, x));
    const newY = Math.max(0, Math.min(maxY, y));
    
    this.container.style.left = newX + 'px';
    this.container.style.top = newY + 'px';
    
    // Save position
    this.settings.position = { x: newX, y: newY };
    this.saveData();
  }

  startResize(e) {
    this.isResizing = true;
    e.preventDefault();
    this.container.style.cursor = 'se-resize';
  }

  resize(e) {
    if (!this.isResizing) return;
    const rect = this.container.getBoundingClientRect();
    const width = Math.max(350, e.clientX - rect.left);
    const height = Math.max(250, e.clientY - rect.top);
    
    this.container.style.width = width + 'px';
    this.container.style.height = height + 'px';
    
    // Save size
    this.settings.size = { width, height };
    this.saveData();
  }

  formatText(before, after) {
    const start = this.editor.selectionStart;
    const end = this.editor.selectionEnd;
    const selectedText = this.editor.value.substring(start, end);
    const newText = before + selectedText + after;
    
    this.editor.value = this.editor.value.substring(0, start) + newText + this.editor.value.substring(end);
    this.editor.setSelectionRange(start + before.length, start + before.length + selectedText.length);
    this.editor.focus();
    this.updateWordCount();
    this.autoSave();
  }

  updateWordCount() {
    const text = this.editor.value.trim();
    const words = text ? text.split(/\s+/).filter(word => word.length > 0).length : 0;
    const chars = this.editor.value.length;
    
    this.wordCount.textContent = `${words} words`;
    this.charCount.textContent = `${chars} characters`;
  }

  updateLastModified() {
    if (this.currentNote?.updatedAt) {
      const date = new Date(this.currentNote.updatedAt);
      this.lastModified.textContent = date.toLocaleString();
    } else {
      this.lastModified.textContent = 'Never';
    }
  }

  autoSave() {
    if (!this.settings.autoSave) return;
    
    this.saveStatus.textContent = 'Saving...';
    this.saveStatus.style.color = '#ff9f43';
    
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.saveNote();
    }, 1000);
  }

  saveNote() {
    if (!this.currentNote) return;
    
    const hasChanges = this.editor.value !== this.currentNote.content || 
                      this.noteTitle.value !== this.currentNote.title;
    
    if (hasChanges) {
      this.currentNote.content = this.editor.value;
      this.currentNote.title = this.noteTitle.value || 'Untitled Note';
      this.currentNote.updatedAt = Date.now();
      
      // Update notes array
      const index = this.notes.findIndex(note => note.id === this.currentNote.id);
      if (index !== -1) {
        this.notes[index] = { ...this.currentNote };
      }
      
      this.updateNotesList();
      this.saveData();
      this.updateLastModified();
    }
    
    this.saveStatus.textContent = 'Saved';
    this.saveStatus.style.color = '#4ecdc4';
  }

  createNewNote() {
    const id = 'note_' + Date.now();
    const newNote = {
      id,
      title: 'New Note',
      content: '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    this.notes.push(newNote);
    this.currentNoteId = id;
    this.currentNote = newNote;
    
    this.updateNotesList();
    this.noteSelector.value = id;
    this.noteTitle.value = newNote.title;
    this.editor.value = '';
    this.editor.focus();
    this.updateWordCount();
    this.updateLastModified();
    this.saveData();
  }

  switchNote(noteId) {
    // Save current note
    this.saveNote();
    
    // Switch to new note
    this.currentNoteId = noteId;
    this.currentNote = this.notes.find(note => note.id === noteId);
    
    if (this.currentNote) {
      this.noteTitle.value = this.currentNote.title;
      this.editor.value = this.currentNote.content;
      this.updateWordCount();
      this.updateLastModified();
    }
    
    this.saveData();
  }

  updateNotesList() {
    const currentValue = this.noteSelector.value;
    this.noteSelector.innerHTML = '';
    
    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select a note...';
    this.noteSelector.appendChild(defaultOption);
    
    // Add notes
    this.notes.forEach(note => {
      const option = document.createElement('option');
      option.value = note.id;
      option.textContent = note.title;
      if (note.id === this.currentNoteId) {
        option.selected = true;
      }
      this.noteSelector.appendChild(option);
    });
  }

  deleteCurrentNote() {
    if (this.notes.length <= 1) {
      alert('Cannot delete the last note');
      return;
    }
    
    if (confirm(`Are you sure you want to delete "${this.currentNote.title}"?`)) {
      this.notes = this.notes.filter(note => note.id !== this.currentNoteId);
      
      // Switch to first note
      this.currentNoteId = this.notes[0].id;
      this.currentNote = this.notes[0];
      
      this.updateNotesList();
      this.noteSelector.value = this.currentNoteId;
      this.noteTitle.value = this.currentNote.title;
      this.editor.value = this.currentNote.content;
      this.updateWordCount();
      this.updateLastModified();
      
      this.saveData();
    }
  }

  toggleSearch() {
    this.searchMode = !this.searchMode;
    this.searchContainer.style.display = this.searchMode ? 'flex' : 'none';
    
    if (this.searchMode) {
      this.searchInput.focus();
    } else {
      this.searchInput.value = '';
    }
  }

  searchNotes(query) {
    if (!query.trim()) return;
    
    const results = this.notes.filter(note => 
      note.title.toLowerCase().includes(query.toLowerCase()) ||
      note.content.toLowerCase().includes(query.toLowerCase())
    );
    
    // Update note selector to show only matching notes
    this.noteSelector.innerHTML = '';
    
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = `${results.length} results found`;
    this.noteSelector.appendChild(defaultOption);
    
    results.forEach(note => {
      const option = document.createElement('option');
      option.value = note.id;
      option.textContent = note.title;
      this.noteSelector.appendChild(option);
    });
  }

  exportNote() {
    if (!this.currentNote) return;
    
    const format = prompt('Export format:\n1. txt (plain text)\n2. md (markdown)\n\nEnter 1 or 2:', '1');
    
    let content = this.currentNote.content;
    let filename = this.currentNote.title;
    let mimeType = 'text/plain';
    
    if (format === '2') {
      content = `# ${this.currentNote.title}\n\n${content}`;
      filename += '.md';
      mimeType = 'text/markdown';
    } else {
      filename += '.txt';
    }
    
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  showSettings() {
    const modal = document.createElement('div');
    modal.className = 'settings-modal';
    modal.innerHTML = `
      <div class="settings-content">
        <h3>Settings</h3>
        <div class="setting-group">
          <label>Opacity</label>
          <input type="range" id="opacity" min="0.5" max="1" step="0.05" value="${this.settings.opacity || 0.95}">
          <span id="opacity-value">${Math.round((this.settings.opacity || 0.95) * 100)}%</span>
        </div>
        <div class="setting-group">
          <label>Font Size</label>
          <input type="range" id="font-size" min="10" max="24" step="1" value="${this.settings.fontSize || 14}">
          <span id="font-size-value">${this.settings.fontSize || 14}px</span>
        </div>
        <div class="setting-group">
          <label>Theme</label>
          <select id="theme">
            <option value="auto" ${this.settings.theme === 'auto' ? 'selected' : ''}>Auto</option>
            <option value="light" ${this.settings.theme === 'light' ? 'selected' : ''}>Light</option>
            <option value="dark" ${this.settings.theme === 'dark' ? 'selected' : ''}>Dark</option>
          </select>
        </div>
        <div class="setting-group">
          <label>
            <input type="checkbox" id="auto-save" ${this.settings.autoSave !== false ? 'checked' : ''}>
            Auto-save
          </label>
        </div>
        <div class="setting-actions">
          <button id="save-settings">Save</button>
          <button id="cancel-settings">Cancel</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Update opacity value display
    const opacitySlider = modal.querySelector('#opacity');
    const opacityValue = modal.querySelector('#opacity-value');
    opacitySlider.addEventListener('input', (e) => {
      opacityValue.textContent = Math.round(e.target.value * 100) + '%';
      this.container.style.opacity = e.target.value;
    });
    
    // Update font size value display
    const fontSizeSlider = modal.querySelector('#font-size');
    const fontSizeValue = modal.querySelector('#font-size-value');
    fontSizeSlider.addEventListener('input', (e) => {
      fontSizeValue.textContent = e.target.value + 'px';
      this.editor.style.fontSize = e.target.value + 'px';
    });
    
    // Save settings
    modal.querySelector('#save-settings').addEventListener('click', () => {
      this.settings.opacity = parseFloat(opacitySlider.value);
      this.settings.fontSize = parseInt(fontSizeSlider.value);
      this.settings.theme = modal.querySelector('#theme').value;
      this.settings.autoSave = modal.querySelector('#auto-save').checked;
      
      this.applyTheme();
      this.saveData();
      document.body.removeChild(modal);
    });
    
    // Cancel settings
    modal.querySelector('#cancel-settings').addEventListener('click', () => {
      this.container.style.opacity = this.settings.opacity || 0.95;
      this.editor.style.fontSize = (this.settings.fontSize || 14) + 'px';
      document.body.removeChild(modal);
    });
  }

  applyTheme() {
    const isDark = this.settings.theme === 'dark' || 
                  (this.settings.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    if (isDark) {
      this.container.style.backgroundColor = 'rgba(30, 30, 30, 0.95)';
      this.container.style.color = '#ffffff';
      this.container.style.borderColor = 'rgba(255, 255, 255, 0.1)';
    } else {
      this.container.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
      this.container.style.color = '#000000';
      this.container.style.borderColor = 'rgba(0, 0, 0, 0.1)';
    }
    
    this.container.style.opacity = this.settings.opacity || 0.95;
    this.editor.style.fontSize = (this.settings.fontSize || 14) + 'px';
  }

  handleStorageChange(changes) {
    // Handle storage changes from other tabs
    if (changes.notes) {
      this.notes = changes.notes.newValue;
      this.updateNotesList();
    }
    
    if (changes.currentNoteId) {
      this.currentNoteId = changes.currentNoteId.newValue;
      this.currentNote = this.notes.find(note => note.id === this.currentNoteId);
      if (this.currentNote) {
        this.noteTitle.value = this.currentNote.title;
        this.editor.value = this.currentNote.content;
        this.updateWordCount();
        this.updateLastModified();
      }
    }
    
    if (changes.settings) {
      this.settings = changes.settings.newValue;
      this.applyTheme();
    }
  }

  showExtensionPopup() {
    if (this.popupVisible) {
      this.hideExtensionPopup();
      return;
    }

    // Create popup overlay
    this.popupOverlay = document.createElement('div');
    this.popupOverlay.className = 'pure-notepad-popup-overlay';
    this.popupOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.3);
      z-index: 999998;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(5px);
      -webkit-backdrop-filter: blur(5px);
      opacity: 0;
      transition: opacity 0.3s ease;
    `;

    // Create popup content
    const popupContent = document.createElement('div');
    popupContent.className = 'pure-notepad-popup-content';
    popupContent.innerHTML = `
      <div class="popup-header">
        <div class="popup-traffic-lights">
          <div class="popup-traffic-light close" data-action="close-popup" title="Close"></div>
          <div class="popup-traffic-light minimize" data-action="minimize-popup" title="Minimize"></div>
          <div class="popup-traffic-light maximize" data-action="maximize-popup" title="Maximize"></div>
        </div>
        <div class="popup-title">Pure Notepad</div>
      </div>
      
      <div class="popup-body">
        <div class="popup-icon">
          <svg width="64" height="64" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="3" width="36" height="42" rx="3" fill="#4A90E2" stroke="#2E5B8A" stroke-width="1"/>
            <rect x="9" y="9" width="30" height="3" rx="1.5" fill="#E8F4FD"/>
            <rect x="9" y="15" width="24" height="3" rx="1.5" fill="#E8F4FD"/>
            <rect x="9" y="21" width="27" height="3" rx="1.5" fill="#E8F4FD"/>
            <rect x="9" y="27" width="21" height="3" rx="1.5" fill="#E8F4FD"/>
            <circle cx="4.5" cy="7.5" r="3" fill="#FF6B6B"/>
            <circle cx="4.5" cy="13.5" r="3" fill="#4ECDC4"/>
            <circle cx="4.5" cy="19.5" r="3" fill="#FFE66D"/>
          </svg>
        </div>
        
        <h2>Beautiful, offline-only notepad</h2>
        <p class="popup-description">
          Keep your notes private and accessible anywhere on the web with a floating, draggable interface.
        </p>
        
        <div class="popup-shortcuts">
          <div class="shortcut-item">
            <span class="shortcut-key">⌘+Shift+N</span>
            <span class="shortcut-desc">Toggle notepad</span>
          </div>
          <div class="shortcut-item">
            <span class="shortcut-key">⌘+B</span>
            <span class="shortcut-desc">Bold text</span>
          </div>
          <div class="shortcut-item">
            <span class="shortcut-key">⌘+I</span>
            <span class="shortcut-desc">Italic text</span>
          </div>
          <div class="shortcut-item">
            <span class="shortcut-key">⌘+F</span>
            <span class="shortcut-desc">Search notes</span>
          </div>
          <div class="shortcut-item">
            <span class="shortcut-key">⌘+S</span>
            <span class="shortcut-desc">Save note</span>
          </div>
          <div class="shortcut-item">
            <span class="shortcut-key">⌘+N</span>
            <span class="shortcut-desc">New note</span>
          </div>
        </div>
        
        <div class="popup-actions">
          <button class="popup-btn primary" data-action="open-notepad">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14,2 14,8 20,8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10,9 9,9 8,9"></polyline>
            </svg>
            Open Notepad
          </button>
          <button class="popup-btn secondary" data-action="close-popup">Close</button>
        </div>
        
        <div class="popup-footer">
          <span>🔒 100% Private • No data leaves your browser</span>
        </div>
      </div>
    `;

    this.popupOverlay.appendChild(popupContent);
    document.body.appendChild(this.popupOverlay);

    // Animate in
    requestAnimationFrame(() => {
      this.popupOverlay.style.opacity = '1';
    });

    // Add event listeners
    popupContent.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent closing when clicking inside popup
      
      const action = e.target.closest('[data-action]')?.dataset.action;
      switch(action) {
        case 'close-popup':
          this.hideExtensionPopup();
          break;
        case 'minimize-popup':
          this.hideExtensionPopup();
          break;
        case 'maximize-popup':
          this.hideExtensionPopup();
          this.show();
          break;
        case 'open-notepad':
          this.hideExtensionPopup();
          this.show();
          break;
      }
    });

    this.popupVisible = true;
  }

  hideExtensionPopup() {
    if (!this.popupVisible || !this.popupOverlay) return;
    
    this.popupOverlay.style.opacity = '0';
    setTimeout(() => {
      if (this.popupOverlay && this.popupOverlay.parentNode) {
        document.body.removeChild(this.popupOverlay);
      }
      this.popupOverlay = null;
      this.popupVisible = false;
    }, 300);
  }
}

// Initialize when DOM is ready