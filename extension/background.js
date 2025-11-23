// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureScreen') {
    captureScreen(sender.tab.id, request.area, request.devicePixelRatio)
      .then(dataUrl => sendResponse({ dataUrl }))
      .catch(error => {
        console.error('Capture error:', error);
        sendResponse({ error: error.message });
      });
    return true; // Keep channel open for async response
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
    // Capture the visible tab
    const dataUrl = await chrome.tabs.captureVisibleTab(null, {
      format: 'png'
    });

    // Crop the image to the selected area
    const croppedDataUrl = await cropImage(dataUrl, area, devicePixelRatio);

    return croppedDataUrl;
  } catch (error) {
    console.error('Error in captureScreen:', error);
    throw error;
  }
}

// Crop image to selected area
function cropImage(dataUrl, area, devicePixelRatio) {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      try {
        const canvas = new OffscreenCanvas(
          area.width * devicePixelRatio,
          area.height * devicePixelRatio
        );
        const ctx = canvas.getContext('2d');

        // Draw the cropped portion
        ctx.drawImage(
          img,
          area.left * devicePixelRatio,
          area.top * devicePixelRatio,
          area.width * devicePixelRatio,
          area.height * devicePixelRatio,
          0,
          0,
          area.width * devicePixelRatio,
          area.height * devicePixelRatio
        );

        // Convert to blob then to data URL
        canvas.convertToBlob({ type: 'image/png' })
          .then(blob => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          })
          .catch(reject);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = reject;
    img.src = dataUrl;
  });
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
    await new Promise(resolve => setTimeout(resolve, 300));

    return claudeTab;
  } else {
    // Create new tab
    claudeTab = await chrome.tabs.create({
      url: 'https://claude.ai/new',
      active: true
    });

    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 2000));

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

      await new Promise(r => setTimeout(r, 100));

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

      await new Promise(r => setTimeout(r, 300));

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
        // Try Enter key
        const enterEvent = new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          bubbles: true
        });
        inputArea.dispatchEvent(enterEvent);
        resolve({ success: true, method: 'enter' });
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

      await new Promise(r => setTimeout(r, 100));

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
