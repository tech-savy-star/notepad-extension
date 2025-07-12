// Service worker for handling extension icon clicks and storage
chrome.runtime.onInstalled.addListener(() => {
  // Initialize storage on install
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
      opacity: 95,
      position: { x: 100, y: 100 },
      size: { width: 450, height: 600 },
      autoSave: true,
      wordWrap: true,
      colorTheme: 0
    }
  });
});

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // First, ensure content script is injected
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
    
    // Small delay to ensure content script is ready
    setTimeout(async () => {
      try {
        // Send message to toggle notepad
        await chrome.tabs.sendMessage(tab.id, { action: 'toggleNotepad' });
      } catch (error) {
        console.log('Content script not ready, injecting CSS and retrying...');
        
        // Inject CSS if not already injected
        try {
          await chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ['styles.css']
          });
        } catch (cssError) {
          console.log('CSS already injected or error:', cssError);
        }
        
        // Retry sending message
        setTimeout(async () => {
          try {
            await chrome.tabs.sendMessage(tab.id, { action: 'toggleNotepad' });
          } catch (retryError) {
            console.error('Failed to communicate with content script:', retryError);
            // Fallback: inject everything fresh
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js']
            });
            
            setTimeout(async () => {
              await chrome.tabs.sendMessage(tab.id, { action: 'toggleNotepad' });
            }, 500);
          }
        }, 300);
      }
    }, 100);
    
  } catch (error) {
    console.error('Error injecting content script:', error);
    
    // Fallback: try to inject on all frames
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ['content.js']
      });
      
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id, allFrames: true },
        files: ['styles.css']
      });
      
      setTimeout(async () => {
        await chrome.tabs.sendMessage(tab.id, { action: 'toggleNotepad' });
      }, 200);
      
    } catch (fallbackError) {
      console.error('Fallback injection failed:', fallbackError);
    }
  }
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-notepad') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'toggleNotepad' });
      } catch (error) {
        // Content script not ready, inject it
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        
        setTimeout(async () => {
          await chrome.tabs.sendMessage(tab.id, { action: 'toggleNotepad' });
        }, 100);
      }
    }
  }
});

// Listen for tab updates to ensure content script is available
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
    try {
      // Pre-inject content script when page loads
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });
      
      await chrome.scripting.insertCSS({
        target: { tabId: tabId },
        files: ['styles.css']
      });
    } catch (error) {
      // Ignore errors for pages where we can't inject (like chrome:// pages)
      console.log('Could not inject into tab:', tab.url);
    }
  }
});