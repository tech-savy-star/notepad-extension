class PureNotepad {
    constructor() {
        this.currentNote = null;
        this.notes = [];
        this.settings = {};
        this.searchMode = false;
        this.saveTimeout = null;
        
        this.init();
    }

    async init() {
        await this.loadData();
        this.setupElements();
        this.setupEventListeners();
        this.applyTheme();
        this.updateNotesList();
        this.loadCurrentNote();
    }

    async loadData() {
        try {
            const data = await chrome.storage.local.get(['notes', 'currentNoteId', 'settings']);
            this.notes = data.notes || [];
            this.currentNoteId = data.currentNoteId || (this.notes[0]?.id);
            this.settings = data.settings || {
                theme: 'auto',
                fontSize: 14,
                opacity: 0.95,
                autoSave: true
            };
            
            // Create welcome note if no notes exist
            if (this.notes.length === 0) {
                this.createWelcomeNote();
            }
            
            this.currentNote = this.notes.find(note => note.id === this.currentNoteId) || this.notes[0];
        } catch (error) {
            console.error('Error loading data:', error);
            this.createWelcomeNote();
        }
    }

    createWelcomeNote() {
        const welcomeNote = {
            id: 'welcome-note',
            title: 'Welcome to Pure Notepad',
            content: `# Welcome to Pure Notepad! 🎉

This is your first note. Here's what you can do:

## ✨ Features
• **Write and edit** with live auto-save
• **Multiple notes** - Create, switch, and organize
• **Search** through all your notes instantly
• **Export** to .txt or .md files
• **Markdown support** for **bold** and *italic* text
• **macOS design** - Beautiful traffic lights and blur effects

## 🎯 Keyboard Shortcuts
• **⌘+B** - Make text bold
• **⌘+I** - Make text italic
• **⌘+F** - Search notes
• **⌘+S** - Save note
• **⌘+N** - Create new note

## 🔒 Privacy First
Everything is stored locally in your browser. No data ever leaves your device!

Start writing your thoughts, ideas, or todo lists. This notepad will always be here when you need it.

Happy writing! ✍️`,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        
        this.notes = [welcomeNote];
        this.currentNoteId = welcomeNote.id;
        this.currentNote = welcomeNote;
        this.saveData();
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

    setupElements() {
        this.container = document.getElementById('pure-notepad');
        this.titleBar = document.querySelector('.pure-notepad-titlebar');
        this.toolbar = document.querySelector('.pure-notepad-toolbar');
        this.content = document.querySelector('.pure-notepad-content');
        this.editor = document.querySelector('.note-editor');
        this.noteTitle = document.querySelector('.note-title');
        this.searchContainer = document.querySelector('.search-container');
        this.searchInput = document.querySelector('.search-input');
        this.noteSelector = document.querySelector('.note-selector');
        this.wordCount = document.querySelector('.word-count');
        this.charCount = document.querySelector('.char-count');
        this.saveStatus = document.querySelector('.save-status');
        this.lastModified = document.querySelector('.last-modified');
        this.settingsModal = document.getElementById('settings-modal');
    }

    setupEventListeners() {
        // Title bar actions
        this.titleBar.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            switch(action) {
                case 'close':
                    window.close();
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

        // Settings modal
        this.setupSettingsListeners();

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

    setupSettingsListeners() {
        const modal = this.settingsModal;
        
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
            this.hideSettings();
        });
        
        // Cancel settings
        modal.querySelector('#cancel-settings').addEventListener('click', () => {
            this.container.style.opacity = this.settings.opacity || 0.95;
            this.editor.style.fontSize = (this.settings.fontSize || 14) + 'px';
            this.hideSettings();
        });
    }

    loadCurrentNote() {
        if (this.currentNote) {
            this.noteTitle.value = this.currentNote.title;
            this.editor.value = this.currentNote.content;
            this.noteSelector.value = this.currentNote.id;
            this.updateWordCount();
            this.updateLastModified();
        }
    }

    minimize() {
        this.container.style.transform = 'scale(0.1)';
        this.container.style.opacity = '0';
        setTimeout(() => {
            this.container.style.display = 'none';
        }, 300);
    }

    toggleMaximize() {
        if (this.container.style.width === '100vw') {
            // Restore
            this.container.style.width = '800px';
            this.container.style.height = '600px';
            this.container.style.position = 'relative';
        } else {
            // Maximize
            this.container.style.width = '100vw';
            this.container.style.height = '100vh';
            this.container.style.position = 'fixed';
            this.container.style.top = '0';
            this.container.style.left = '0';
            this.container.style.borderRadius = '0';
        }
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
            this.updateNotesList(); // Reset to show all notes
        }
    }

    searchNotes(query) {
        if (!query.trim()) {
            this.updateNotesList();
            return;
        }
        
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
        // Load current settings
        const modal = this.settingsModal;
        modal.querySelector('#opacity').value = this.settings.opacity || 0.95;
        modal.querySelector('#opacity-value').textContent = Math.round((this.settings.opacity || 0.95) * 100) + '%';
        modal.querySelector('#font-size').value = this.settings.fontSize || 14;
        modal.querySelector('#font-size-value').textContent = (this.settings.fontSize || 14) + 'px';
        modal.querySelector('#theme').value = this.settings.theme || 'auto';
        modal.querySelector('#auto-save').checked = this.settings.autoSave !== false;
        
        modal.style.display = 'flex';
    }

    hideSettings() {
        this.settingsModal.style.display = 'none';
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
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new PureNotepad();
});