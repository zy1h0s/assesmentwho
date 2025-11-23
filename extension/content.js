// Create floating window
function createFloatingWindow() {
  // Check if already exists
  if (document.getElementById('claude-helper-float')) {
    return;
  }

  const floatWindow = document.createElement('div');
  floatWindow.id = 'claude-helper-float';
  floatWindow.className = 'claude-helper-container';

  floatWindow.innerHTML = `
    <div class="claude-helper-header" id="drag-header">
      <span>Claude Helper</span>
      <button id="minimize-btn" title="Minimize">−</button>
    </div>
    <div class="claude-helper-content" id="helper-content">
      <button id="capture-btn" class="helper-btn">📷 Capture Screenshot</button>
      <textarea id="text-input" placeholder="Type your message here..."></textarea>
      <button id="send-btn" class="helper-btn send-btn">Send to Claude</button>
    </div>
  `;

  document.body.appendChild(floatWindow);

  // Make draggable
  makeDraggable(floatWindow);

  // Add event listeners
  setupEventListeners();
}

// Make the window draggable
function makeDraggable(element) {
  const header = element.querySelector('#drag-header');
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

  header.onmousedown = dragMouseDown;

  function dragMouseDown(e) {
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    element.style.top = (element.offsetTop - pos2) + "px";
    element.style.left = (element.offsetLeft - pos1) + "px";
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

// Setup event listeners
function setupEventListeners() {
  const captureBtn = document.getElementById('capture-btn');
  const sendBtn = document.getElementById('send-btn');
  const minimizeBtn = document.getElementById('minimize-btn');

  captureBtn.addEventListener('click', startScreenCapture);
  sendBtn.addEventListener('click', sendTextToClaude);
  minimizeBtn.addEventListener('click', toggleMinimize);
}

// Toggle minimize
function toggleMinimize() {
  const content = document.getElementById('helper-content');
  const btn = document.getElementById('minimize-btn');

  if (content.style.display === 'none') {
    content.style.display = 'flex';
    btn.textContent = '−';
  } else {
    content.style.display = 'none';
    btn.textContent = '+';
  }
}

// Start screen capture
function startScreenCapture() {
  // Create overlay for area selection
  const overlay = document.createElement('div');
  overlay.id = 'capture-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.3);
    cursor: crosshair;
    z-index: 999999;
  `;

  const selectionBox = document.createElement('div');
  selectionBox.id = 'selection-box';
  selectionBox.style.cssText = `
    position: fixed;
    border: 2px dashed #fff;
    background: rgba(255, 255, 255, 0.1);
    display: none;
    z-index: 1000000;
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(selectionBox);

  let startX, startY, isSelecting = false;

  overlay.addEventListener('mousedown', (e) => {
    isSelecting = true;
    startX = e.clientX;
    startY = e.clientY;
    selectionBox.style.left = startX + 'px';
    selectionBox.style.top = startY + 'px';
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';
    selectionBox.style.display = 'block';
  });

  overlay.addEventListener('mousemove', (e) => {
    if (!isSelecting) return;

    const currentX = e.clientX;
    const currentY = e.clientY;

    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);
    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);

    selectionBox.style.width = width + 'px';
    selectionBox.style.height = height + 'px';
    selectionBox.style.left = left + 'px';
    selectionBox.style.top = top + 'px';
  });

  overlay.addEventListener('mouseup', async (e) => {
    if (!isSelecting) return;
    isSelecting = false;

    const currentX = e.clientX;
    const currentY = e.clientY;

    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);
    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);

    // Remove overlay
    cleanup();

    // Capture the area
    if (width > 10 && height > 10) {
      await captureArea({ left, top, width, height });
    } else if (width > 0 || height > 0) {
      showNotification('Selection too small - try again', true);
    }
  });

  // Right click to cancel
  overlay.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    cleanup();
    showNotification('Capture cancelled');
  });

  // ESC to cancel
  const escapeHandler = (e) => {
    if (e.key === 'Escape') {
      cleanup();
      showNotification('Capture cancelled');
    }
  };
  document.addEventListener('keydown', escapeHandler);

  // Cleanup function
  function cleanup() {
    overlay.remove();
    selectionBox.remove();
    document.removeEventListener('keydown', escapeHandler);
  }
}

// Capture the selected area
async function captureArea(area) {
  try {
    // Send message to background script to capture
    chrome.runtime.sendMessage({
      action: 'captureScreen',
      area: area,
      devicePixelRatio: window.devicePixelRatio
    }, async (response) => {
      if (response && response.dataUrl) {
        // Convert data URL to blob
        const blob = await (await fetch(response.dataUrl)).blob();

        // Copy to clipboard
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          showNotification('Screenshot copied to clipboard!');
        } catch (err) {
          console.error('Clipboard error:', err);
        }

        // Paste into Claude
        await pasteImageToClaude(blob);
      }
    });
  } catch (error) {
    console.error('Error capturing area:', error);
    showNotification('Error capturing screenshot', true);
  }
}

// Paste image into Claude's input
async function pasteImageToClaude(blob) {
  try {
    // Find Claude's input area
    const inputArea = findClaudeInput();
    if (!inputArea) {
      showNotification('Could not find Claude input area', true);
      return;
    }

    // Focus the input
    inputArea.focus();
    inputArea.click();

    // Wait a moment for focus
    await new Promise(resolve => setTimeout(resolve, 100));

    // Create a file from blob
    const file = new File([blob], 'screenshot.png', { type: 'image/png' });

    // Method 1: Try DataTransfer with paste event
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);

    const pasteEvent = new ClipboardEvent('paste', {
      clipboardData: dataTransfer,
      bubbles: true,
      cancelable: true,
      composed: true
    });

    // Try dispatching on input area
    inputArea.dispatchEvent(pasteEvent);

    // Method 2: Try dispatching on document
    document.dispatchEvent(pasteEvent);

    // Method 3: Try using input event with file
    const inputEvent = new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertFromPaste'
    });
    inputArea.dispatchEvent(inputEvent);

    // Method 4: Look for file drop zone and simulate drop
    await simulateFileDrop(file, inputArea);

    showNotification('Screenshot pasted to Claude!');
  } catch (error) {
    console.error('Error pasting to Claude:', error);
    showNotification('Check if screenshot was copied to clipboard', false);
  }
}

// Simulate file drop
async function simulateFileDrop(file, targetElement) {
  try {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);

    const dropEvent = new DragEvent('drop', {
      dataTransfer: dataTransfer,
      bubbles: true,
      cancelable: true
    });

    targetElement.dispatchEvent(dropEvent);

    // Also try on parent containers
    const containers = [
      targetElement.parentElement,
      targetElement.closest('[role="textbox"]'),
      targetElement.closest('.ProseMirror'),
      document.querySelector('[data-testid="chat-input"]')?.parentElement
    ].filter(Boolean);

    for (const container of containers) {
      if (container) {
        container.dispatchEvent(dropEvent);
      }
    }
  } catch (error) {
    console.error('Drop simulation error:', error);
  }
}

// Send text to Claude
async function sendTextToClaude() {
  const textInput = document.getElementById('text-input');
  const text = textInput.value.trim();

  if (!text) {
    showNotification('Please enter some text', true);
    return;
  }

  try {
    const inputArea = findClaudeInput();
    if (!inputArea) {
      showNotification('Could not find Claude input area', true);
      return;
    }

    // Focus and click the input
    inputArea.focus();
    inputArea.click();

    // Wait for focus
    await new Promise(resolve => setTimeout(resolve, 100));

    // Clear any existing content
    inputArea.textContent = '';

    // Method 1: Use execCommand (works with contenteditable)
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(inputArea);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);

    document.execCommand('insertText', false, text);

    // Method 2: Directly set innerHTML for ProseMirror
    if (inputArea.classList.contains('ProseMirror')) {
      // ProseMirror specific
      const p = inputArea.querySelector('p') || document.createElement('p');
      p.textContent = text;
      p.classList.remove('is-empty', 'is-editor-empty');

      if (!p.parentElement) {
        inputArea.innerHTML = '';
        inputArea.appendChild(p);
      }
    }

    // Trigger all relevant events
    inputArea.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    inputArea.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    inputArea.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, composed: true }));
    inputArea.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      composed: true,
      inputType: 'insertText',
      data: text
    }));

    showNotification('Text pasted to Claude!');

    // Wait a bit then click send
    setTimeout(() => {
      clickClaudeSend();
      textInput.value = '';
    }, 500);
  } catch (error) {
    console.error('Error sending to Claude:', error);
    showNotification('Error sending to Claude', true);
  }
}

// Find Claude's input element
function findClaudeInput() {
  // Try multiple selectors
  const selectors = [
    '[data-testid="chat-input"]',
    '.ProseMirror[contenteditable="true"]',
    'div[contenteditable="true"][role="textbox"]',
    'p[data-placeholder*="How can I help you today?"]'
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      // If it's a paragraph, get the parent ProseMirror div
      if (element.tagName === 'P') {
        return element.closest('.ProseMirror') || element;
      }
      return element;
    }
  }

  return null;
}

// Click Claude's send button
function clickClaudeSend() {
  try {
    // Try multiple strategies to find and click the send button

    // Strategy 1: Direct selectors
    const selectors = [
      'button[aria-label="Send message"]',
      'button[aria-label*="Send"]',
      'button.Button_claude__tTMUm',
      'form button[type="submit"]',
      'button[type="button"] svg[viewBox="0 0 256 256"]'
    ];

    for (const selector of selectors) {
      const sendBtn = document.querySelector(selector);
      if (sendBtn && !sendBtn.disabled && sendBtn.offsetParent !== null) {
        sendBtn.click();
        showNotification('Message sent!');
        return;
      }
    }

    // Strategy 2: Find button with up arrow SVG icon
    const allButtons = document.querySelectorAll('button[type="button"]');
    for (const btn of allButtons) {
      const svg = btn.querySelector('svg');
      if (svg && !btn.disabled && btn.offsetParent !== null) {
        const path = svg.querySelector('path');
        if (path) {
          const d = path.getAttribute('d');
          // Check if it's the up arrow path from Claude's send button
          if (d && (d.includes('M208.49,120.49') || d.includes('120.49') || d.toLowerCase().includes('l72'))) {
            btn.click();
            showNotification('Message sent!');
            return;
          }
        }
      }
    }

    // Strategy 3: Find button near the input area
    const inputArea = findClaudeInput();
    if (inputArea) {
      const container = inputArea.closest('form') || inputArea.closest('div[class*="chat"]');
      if (container) {
        const nearbyButtons = container.querySelectorAll('button');
        for (const btn of nearbyButtons) {
          if (!btn.disabled && btn.offsetParent !== null && btn.querySelector('svg')) {
            btn.click();
            showNotification('Message sent!');
            return;
          }
        }
      }
    }

    // Strategy 4: Use keyboard shortcut (Enter)
    if (inputArea) {
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      });
      inputArea.dispatchEvent(enterEvent);
      showNotification('Sent using Enter key!');
      return;
    }

    showNotification('Could not find send button - text pasted', false);
  } catch (error) {
    console.error('Error clicking send:', error);
    showNotification('Text pasted - click send manually', false);
  }
}

// Show notification
function showNotification(message, isError = false) {
  const notification = document.createElement('div');
  notification.className = 'claude-helper-notification' + (isError ? ' error' : '');
  notification.textContent = message;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.classList.add('show');
  }, 10);

  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', createFloatingWindow);
} else {
  createFloatingWindow();
}

// Re-inject if page navigation happens
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    setTimeout(createFloatingWindow, 1000);
  }
}).observe(document, { subtree: true, childList: true });
