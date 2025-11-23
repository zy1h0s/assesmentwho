// Track which tabs have the extension injected
const injectedTabs = new Set();

// Listen for extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // Toggle: if already injected, remove it; otherwise inject it
    if (injectedTabs.has(tab.id)) {
      // Remove by reloading the tab or sending message to remove
      await chrome.tabs.sendMessage(tab.id, { action: 'toggle' });
      injectedTabs.delete(tab.id);
    } else {
      // Inject CSS
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['styles.css']
      });

      // Inject JS
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });

      injectedTabs.add(tab.id);
    }
  } catch (error) {
    console.error('Injection error:', error);
  }
});

// Clean up when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  injectedTabs.delete(tabId);
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureScreen') {
    captureScreen(sender.tab.id, request.area, request.devicePixelRatio)
      .then(dataUrl => {
        console.log('Capture successful, dataUrl length:', dataUrl?.length);
        sendResponse({ dataUrl });
      })
      .catch(error => {
        console.error('Capture error:', error);
        sendResponse({ error: error.message });
      });
    return true;
  }

  if (request.action === 'sendToClaude') {
    sendToClaude(request.data)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (request.action === 'pasteImageToClaude') {
    pasteImageToClaude(request.dataUrl)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
});

// Capture the screen
async function captureScreen(tabId, area, devicePixelRatio = 1) {
  try {
    console.log('Capturing screen for tab:', tabId, 'area:', area);

    // Make sure the tab is active
    await chrome.tabs.update(tabId, { active: true });

    // Wait a moment for tab to be active
    await new Promise(resolve => setTimeout(resolve, 100));

    // Get the window ID
    const tab = await chrome.tabs.get(tabId);

    // Capture the visible tab
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: 'png'
    });

    console.log('Raw capture successful, cropping...');

    // Crop the image to the selected area
    const croppedDataUrl = await cropImage(dataUrl, area, devicePixelRatio);

    console.log('Crop successful');

    return croppedDataUrl;
  } catch (error) {
    console.error('Error in captureScreen:', error);
    throw error;
  }
}

// Crop image to selected area
async function cropImage(dataUrl, area, devicePixelRatio) {
  try {
    console.log('Crop area:', area);

    // Convert data URL to blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();

    // Create ImageBitmap (works in service workers)
    const imageBitmap = await createImageBitmap(blob);

    console.log('Image loaded, size:', imageBitmap.width, 'x', imageBitmap.height);

    const canvas = new OffscreenCanvas(
      Math.floor(area.width * devicePixelRatio),
      Math.floor(area.height * devicePixelRatio)
    );
    const ctx = canvas.getContext('2d');

    // Draw the cropped portion
    ctx.drawImage(
      imageBitmap,
      Math.floor(area.left * devicePixelRatio),
      Math.floor(area.top * devicePixelRatio),
      Math.floor(area.width * devicePixelRatio),
      Math.floor(area.height * devicePixelRatio),
      0,
      0,
      Math.floor(area.width * devicePixelRatio),
      Math.floor(area.height * devicePixelRatio)
    );

    // Convert to blob then to data URL
    const croppedBlob = await canvas.convertToBlob({ type: 'image/png' });

    // Convert blob to data URL
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
      reader.onloadend = () => {
        console.log('Crop complete');
        resolve(reader.result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(croppedBlob);
    });
  } catch (error) {
    console.error('Crop error:', error);
    throw error;
  }
}

// Find or create Claude.ai tab
async function findOrCreateClaudeTab() {
  const tabs = await chrome.tabs.query({});

  // Look for existing Claude.ai tab
  let claudeTab = tabs.find(tab =>
    tab.url && (tab.url.includes('claude.ai') || tab.url.includes('claude.anthropic.com'))
  );

  if (claudeTab) {
    // Switch to existing tab
    await chrome.tabs.update(claudeTab.id, { active: true });
    await chrome.windows.update(claudeTab.windowId, { focused: true });

    // Wait for tab to be ready
    await new Promise(resolve => setTimeout(resolve, 500));

    return claudeTab;
  } else {
    // Create new tab
    claudeTab = await chrome.tabs.create({
      url: 'https://claude.ai/new',
      active: true
    });

    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    return claudeTab;
  }
}

// Send text to Claude
async function sendToClaude(data) {
  try {
    const claudeTab = await findOrCreateClaudeTab();

    // Wait a bit more for tab to be fully active
    await new Promise(resolve => setTimeout(resolve, 500));

    // Execute script in Claude tab to paste and send
    const result = await chrome.scripting.executeScript({
      target: { tabId: claudeTab.id },
      func: pasteAndSendText,
      args: [data.text]
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending to Claude:', error);
    throw error;
  }
}

// Paste image to Claude
async function pasteImageToClaude(dataUrl) {
  try {
    const claudeTab = await findOrCreateClaudeTab();

    // Wait for tab to be active
    await new Promise(resolve => setTimeout(resolve, 500));

    // Execute script in Claude tab to paste image
    const result = await chrome.scripting.executeScript({
      target: { tabId: claudeTab.id },
      func: pasteImage,
      args: [dataUrl]
    });

    return { success: true };
  } catch (error) {
    console.error('Error pasting image to Claude:', error);
    throw error;
  }
}

// Function to inject into Claude tab for text
function pasteAndSendText(text) {
  return new Promise(async (resolve) => {
    try {
      // Find input
      const selectors = [
        '[data-testid="chat-input"]',
        '.ProseMirror[contenteditable="true"]',
        'div[contenteditable="true"][role="textbox"]'
      ];

      let inputArea = null;
      for (const selector of selectors) {
        inputArea = document.querySelector(selector);
        if (inputArea) break;
      }

      if (!inputArea) {
        resolve({ error: 'Could not find input' });
        return;
      }

      // Focus input
      inputArea.focus();
      inputArea.click();

      await new Promise(r => setTimeout(r, 200));

      // Clear existing content
      inputArea.textContent = '';

      // Insert text
      const p = inputArea.querySelector('p') || document.createElement('p');
      p.textContent = text;
      p.classList.remove('is-empty', 'is-editor-empty');

      if (!p.parentElement) {
        inputArea.innerHTML = '';
        inputArea.appendChild(p);
      }

      // Trigger events
      inputArea.dispatchEvent(new Event('input', { bubbles: true }));
      inputArea.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        inputType: 'insertText',
        data: text
      }));

      await new Promise(r => setTimeout(r, 500));

      // Click send button
      const sendSelectors = [
        'button[aria-label="Send message"]',
        'button[aria-label*="Send"]'
      ];

      let sendBtn = null;
      for (const selector of sendSelectors) {
        sendBtn = document.querySelector(selector);
        if (sendBtn && !sendBtn.disabled) break;
      }

      if (!sendBtn) {
        // Try finding by SVG
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
          if (btn.querySelector('svg') && !btn.disabled) {
            sendBtn = btn;
            break;
          }
        }
      }

      if (sendBtn) {
        sendBtn.click();
        resolve({ success: true });
      } else {
        resolve({ success: true, method: 'manual' });
      }
    } catch (error) {
      resolve({ error: error.message });
    }
  });
}

// Function to inject into Claude tab for image
function pasteImage(dataUrl) {
  return new Promise(async (resolve) => {
    try {
      // Convert data URL to blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], 'screenshot.png', { type: 'image/png' });

      // Find input
      const selectors = [
        '[data-testid="chat-input"]',
        '.ProseMirror[contenteditable="true"]',
        'div[contenteditable="true"][role="textbox"]'
      ];

      let inputArea = null;
      for (const selector of selectors) {
        inputArea = document.querySelector(selector);
        if (inputArea) break;
      }

      if (!inputArea) {
        resolve({ error: 'Could not find input' });
        return;
      }

      // Focus input
      inputArea.focus();
      inputArea.click();

      await new Promise(r => setTimeout(r, 200));

      // Create paste event
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true,
        composed: true
      });

      // Dispatch on multiple targets
      inputArea.dispatchEvent(pasteEvent);
      document.dispatchEvent(pasteEvent);

      // Try drop event
      const dropEvent = new DragEvent('drop', {
        dataTransfer: dataTransfer,
        bubbles: true,
        cancelable: true
      });

      inputArea.dispatchEvent(dropEvent);

      const parent = inputArea.parentElement;
      if (parent) {
        parent.dispatchEvent(dropEvent);
      }

      resolve({ success: true });
    } catch (error) {
      resolve({ error: error.message });
    }
  });
}
