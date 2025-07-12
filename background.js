// Service worker for handling keyboard shortcuts and storage
// Initialize storage on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    notes: [{
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
• **Drag & resize** - Position anywhere on screen
• **macOS design** - Beautiful traffic lights and blur effects

## 🎯 Keyboard Shortcuts
• **⌘+Shift+N** - Toggle notepad visibility
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
    }],
    currentNoteId: 'welcome-note',
    settings: {
      theme: 'auto',
      fontSize: 14,
      fontFamily: 'SF Pro Display',
      opacity: 0.95,
      position: { x: 100, y: 100 },
      size: { width: 450, height: 600 },
      autoSave: true,
      wordWrap: true
    }
  });
});

// Handle extension icon click
chrome.action.onClicked.addListener(() => {
  // Show notepad on current page
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {action: 'toggleNotepad'});
  });
});
