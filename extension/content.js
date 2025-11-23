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
      <span>Claude</span>
      <button id="minimize-btn" title="Minimize">−</button>
    </div>
    <div class="claude-helper-content" id="helper-content">
      <button id="capture-btn" class="helper-btn">Capture</button>
      <textarea id="text-input" placeholder="Message..."></textarea>
      <button id="send-btn" class="helper-btn">Send</button>
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
    z-index: 2147483646;
  `;

  const selectionBox = document.createElement('div');
  selectionBox.id = 'selection-box';
  selectionBox.style.cssText = `
    position: fixed;
    border: 2px dashed #fff;
    background: rgba(255, 255, 255, 0.1);
    display: none;
    z-index: 2147483646;
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
      showNotification('Selection too small', true);
    }
  });

  // Right click to cancel
  overlay.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    cleanup();
    showNotification('Cancelled');
  });

  // ESC to cancel
  const escapeHandler = (e) => {
    if (e.key === 'Escape') {
      cleanup();
      showNotification('Cancelled');
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
    showNotification('Capturing...');

    // Send message to background script to capture
    chrome.runtime.sendMessage({
      action: 'captureScreen',
      area: area,
      devicePixelRatio: window.devicePixelRatio
    }, async (response) => {
      if (response && response.dataUrl) {
        // Copy to clipboard
        try {
          const blob = await (await fetch(response.dataUrl)).blob();
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          showNotification('Copied to clipboard!');
        } catch (err) {
          console.error('Clipboard error:', err);
        }

        // Send to Claude
        showNotification('Sending to Claude...');
        chrome.runtime.sendMessage({
          action: 'pasteImageToClaude',
          dataUrl: response.dataUrl
        }, (result) => {
          if (result && result.success) {
            showNotification('Sent to Claude!');
          } else {
            showNotification('Check Claude tab', false);
          }
        });
      } else {
        showNotification('Capture failed', true);
      }
    });
  } catch (error) {
    console.error('Error capturing area:', error);
    showNotification('Error capturing', true);
  }
}

// Send text to Claude
async function sendTextToClaude() {
  const textInput = document.getElementById('text-input');
  const text = textInput.value.trim();

  if (!text) {
    showNotification('Enter text first', true);
    return;
  }

  try {
    showNotification('Sending to Claude...');

    chrome.runtime.sendMessage({
      action: 'sendToClaude',
      data: { text }
    }, (result) => {
      if (result && result.success) {
        showNotification('Sent to Claude!');
        textInput.value = '';
      } else {
        showNotification('Check Claude tab', false);
      }
    });
  } catch (error) {
    console.error('Error sending to Claude:', error);
    showNotification('Error sending', true);
  }
}

// Show notification
function showNotification(message, isError = false) {
  // Remove existing notifications
  const existing = document.querySelectorAll('.claude-helper-notification');
  existing.forEach(n => n.remove());

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
  }, 2500);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', createFloatingWindow);
} else {
  createFloatingWindow();
}

// Re-inject if page navigation happens (for SPAs)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    setTimeout(createFloatingWindow, 500);
  }
}).observe(document, { subtree: true, childList: true });
