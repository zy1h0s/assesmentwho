# Claude Screenshot Helper Extension

A Chrome/Edge extension that adds a minimal floating window to **any website** for capturing screenshots and sending messages to Claude.ai.

## Features

- 🌐 **Works on Any Website** - Floating window appears everywhere
- 📸 **Screenshot Capture** - Select any area like Windows Snipping Tool
- 🔄 **Auto Tab Switching** - Automatically switches to Claude.ai when sending
- ✍️ **Quick Text Messages** - Type and send messages to Claude from anywhere
- 🎨 **Minimal Design** - Black/white, 60% opacity, no blur
- 🚀 **Auto-Send** - Automatically pastes and sends to Claude

## How It Works

1. Click the extension icon to activate the floating window on the current page
2. You can capture screenshots or write text
3. Click the icon again to deactivate/remove the window
4. When you click Send, the extension:
   - Finds an open Claude.ai tab (or creates a new one)
   - Switches to that tab and brings it to focus
   - Pastes your content into Claude's input
   - Clicks the send button automatically

## Installation

### Chrome/Edge

1. Open your browser's extensions page:
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`

2. Enable **Developer mode** (toggle in top-right corner)

3. Click **Load unpacked**

4. Navigate to and select the `extension` folder

5. The extension is now loaded!

## Usage

### Activating the Extension

1. Navigate to any website
2. **Click the extension icon** in your browser toolbar
3. The floating window will appear on that page
4. Click the icon again to remove it

### Screenshot Capture

1. With the floating window active, click **Capture**
2. Click and drag to select the area you want to capture
3. Release to capture - it will switch to Claude.ai and paste automatically
4. Press ESC or right-click to cancel
5. Check browser console (F12) if capture fails - error messages will show there

### Send Text Messages

1. Type your message in the text area
2. Click **Send**
3. Extension switches to Claude.ai and sends your message
4. If no Claude.ai tab is open, it creates one

### Window Controls

- **Activate/Deactivate** - Click extension icon in toolbar
- **Drag** - Click and drag the header to move
- **Minimize** - Click the `−` button to collapse/expand
- **Cancel Capture** - ESC key or right-click during selection

## Design

Minimal black and white aesthetic:
- 60% opacity black background
- White borders and text
- No blur effects
- Compact 240px width
- Always on top (highest z-index)

## How Tab Switching Works

The extension mimics human behavior:
1. Searches for existing Claude.ai tabs
2. If found, activates that tab and window
3. If not found, creates a new tab at `https://claude.ai/new`
4. Waits for tab to be active and focused
5. Then pastes and sends your content

This ensures the paste events work correctly by having the tab active.

## Permissions

- `<all_urls>` - To show floating window on all websites
- `tabs` - To find and switch to Claude.ai tabs
- `scripting` - To inject paste scripts into Claude.ai
- `clipboardWrite` - To copy screenshots

## Files

- `manifest.json` - Extension configuration (works on all URLs)
- `content.js` - Floating UI and user interaction
- `background.js` - Tab management and Claude.ai integration
- `styles.css` - Minimal black/white styling

## Troubleshooting

### Floating window not appearing
- Make sure you **clicked the extension icon** (it's not auto-injected)
- Check if extension is enabled in extensions page
- Try reloading the extension

### Screenshot capture failing
- **Check the browser console (F12)** - all errors are logged there
- Make sure the tab is active when you capture
- Try clicking the extension icon to deactivate/reactivate
- Look for errors like "Cannot access..." which means permission issues

### Screenshot/text not pasting
- Extension will show notification status
- Check if a Claude.ai tab opened/activated
- Look at the Claude.ai tab - content should be there
- May need to wait a moment for page to fully load
- Check console for error messages

### Send button not working
- The extension tries multiple methods to find/click the send button
- If auto-send fails, you can manually click send in Claude
- Content will still be pasted correctly

## Development

To modify:
1. Edit files in the `extension` folder
2. Go to `chrome://extensions/`
3. Click refresh icon on the extension card
4. Refresh any open web pages

## Notes

- Works on all websites (injected via `<all_urls>`)
- Screenshots are copied to clipboard as backup
- Extension automatically finds or creates Claude.ai tabs
- All operations happen locally in your browser
- Minimal performance impact
