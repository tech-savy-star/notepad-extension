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
  
  // Check if this is a restricted page FIRST
  if (tab.url && (
    tab.url.startsWith('chrome://') || 
    tab.url.startsWith('chrome-extension://') || 
    tab.url.startsWith('edge://') || 
    tab.url.startsWith('about:') ||
    tab.url.startsWith('moz-extension://') ||
    tab.url.startsWith('chrome-search://') ||
    tab.url.startsWith('devtools://') ||
    !tab.url.startsWith('http')
  )) {
    console.log('Cannot inject on restricted page:', tab.url);
    
    // Show notification for restricted pages
    try {
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon48.svg',
        title: 'Pure Notepad',
        message: 'Cannot open notepad on this page. Please navigate to a regular website (like google.com) and try again.'
      });
    } catch (notificationError) {
      console.log('Notification not available, showing alert');
      // Fallback: open a new tab with instructions
      chrome.tabs.create({
        url: 'data:text/html,<html><head><title>Pure Notepad</title><style>body{font-family:Arial,sans-serif;text-align:center;padding:50px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;}</style></head><body><h1>🚫 Cannot Open Notepad Here</h1><p>Chrome extensions cannot run on system pages for security reasons.</p><p><strong>To use Pure Notepad:</strong></p><ol style="text-align:left;max-width:400px;margin:20px auto;"><li>Navigate to any regular website (like google.com)</li><li>Click the Pure Notepad extension icon</li><li>Start writing!</li></ol><p><em>This tab will close automatically in 5 seconds...</em></p><script>setTimeout(()=>window.close(),5000);</script></body></html>'
      });
    }
    return;
  }

  try {
    console.log('Injecting content script and CSS...');
    
    // Inject content script and CSS
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
    
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ['styles.css']
    });
    
    console.log('Scripts injected successfully');
    
    // Wait for initialization then send toggle message
    setTimeout(async () => {
      try {
        console.log('Sending toggle message...');
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'toggleNotepad' });
        console.log('Message sent successfully:', response);
      } catch (messageError) {
        console.error('Error sending message:', messageError);
        
        // Retry after longer delay
        setTimeout(async () => {
          try {
            await chrome.tabs.sendMessage(tab.id, { action: 'toggleNotepad' });
            console.log('Retry message sent successfully');
          } catch (retryError) {
            console.error('Final retry failed:', retryError);
          }
        }, 1000);
      }
    }, 500);
    
  } catch (error) {
    console.error('Extension injection error:', error);
    
    // Show user-friendly error message
    try {
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon48.svg',
        title: 'Pure Notepad Error',
        message: 'Could not open notepad. Please refresh the page and try again.'
      });
    } catch (notificationError) {
      console.log('Could not show notification');
    }
  }
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-notepad') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      // Check for restricted pages
      if (tab.url && (
        tab.url.startsWith('chrome://') || 
        tab.url.startsWith('chrome-extension://') || 
        tab.url.startsWith('edge://') || 
        tab.url.startsWith('about:') ||
        !tab.url.startsWith('http')
      )) {
        console.log('Cannot use keyboard shortcut on restricted page:', tab.url);
        return;
      }
      
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'toggleNotepad' });
      } catch (error) {
        // Content script not ready, inject it
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });
          
          await chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ['styles.css']
          });
          
          setTimeout(async () => {
            await chrome.tabs.sendMessage(tab.id, { action: 'toggleNotepad' });
          }, 500);
        } catch (injectionError) {
          console.error('Could not inject content script:', injectionError);
        }
      }
    }
  }
});

// Listen for tab updates to pre-inject content script on regular pages
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && 
      tab.url && 
      tab.url.startsWith('http') && 
      !tab.url.startsWith('chrome://')) {
    try {
      // Pre-inject content script when regular pages load
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });
      
      await chrome.scripting.insertCSS({
        target: { tabId: tabId },
        files: ['styles.css']
      });
      
      console.log('Pre-injected content script for:', tab.url);
    } catch (error) {
      // Silently ignore injection errors (some pages may still block it)
      console.log('Could not pre-inject into:', tab.url);
    }
  }
});

// Handle storage changes to sync across tabs
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    // Broadcast storage changes to all tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.url && tab.url.startsWith('http')) {
          chrome.tabs.sendMessage(tab.id, {
            action: 'storageChanged',
            changes: changes
          }).catch(() => {
            // Ignore errors for tabs without content script
          });
        }
      });
    });
  }
});