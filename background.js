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
  console.log('Extension icon clicked on tab:', tab.url);
  
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
    // Check if this is a restricted page
    if (tab.url && (
      tab.url.startsWith('chrome://') || 
      tab.url.startsWith('chrome-extension://') || 
      tab.url.startsWith('edge://') || 
      tab.url.startsWith('about:') ||
      tab.url.startsWith('moz-extension://')
    )) {
      console.log('Cannot inject on restricted page:', tab.url);
      // Show notification or alert
      chrome.notifications?.create({
        type: 'basic',
        iconUrl: 'icon48.svg',
        title: 'Pure Notepad',
        message: 'Cannot open notepad on this page. Please try on a regular webpage.'
      });
      return;
    }

    console.log('Injecting content script...');
    
    // Inject content script and CSS
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['styles.css']
      });
      
      console.log('Scripts injected successfully');
      
      // Wait a bit for initialization
      setTimeout(async () => {
        try {
          console.log('Sending toggle message...');
          const response = await chrome.tabs.sendMessage(tab.id, { action: 'toggleNotepad' });
          console.log('Message sent successfully:', response);
        } catch (messageError) {
          console.error('Error sending message:', messageError);
          
          // Try one more time after a longer delay
          setTimeout(async () => {
            try {
              await chrome.tabs.sendMessage(tab.id, { action: 'toggleNotepad' });
              console.log('Retry message sent successfully');
            } catch (retryError) {
              console.error('Retry failed:', retryError);
            }
          }, 500);
        }
      }, 300);
      
    } catch (injectionError) {
      console.error('Script injection failed:', injectionError);
    }
    
  } catch (error) {
    console.error('Extension click handler error:', error);
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