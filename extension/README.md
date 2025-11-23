# Claude Screenshot Helper Extension

A Chrome/Edge extension that adds a floating helper tool to Claude.ai for taking screenshots and sending text messages.

## Features

- 🎯 **Draggable Floating Window** - 60% opacity, stays on top
- 📸 **Screenshot Capture** - Select any area of the screen (like Windows Snipping Tool)
- 📋 **Auto-Paste to Claude** - Screenshots are automatically copied and pasted into Claude's input
- ✍️ **Text Input** - Write messages in the floating window
- 🚀 **Auto-Send** - Text is pasted to Claude and automatically sent

## Installation

### Chrome/Edge

1. Open Chrome/Edge and navigate to:
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`

2. Enable **Developer mode** (toggle in top-right corner)

3. Click **Load unpacked**

4. Navigate to and select the `extension` folder

5. The extension should now be loaded!

6. Navigate to https://claude.ai/ to use it

## Usage

### Screenshot Capture

1. On Claude.ai, you'll see a floating window in the top-right
2. Click **📷 Capture Screenshot**
3. Click and drag to select the area you want to capture
4. Release the mouse to take the screenshot
5. The screenshot is automatically copied to clipboard and pasted into Claude!

### Text Messages

1. Type your message in the text area
2. Click **Send to Claude**
3. The text will be pasted into Claude's input and automatically sent

### Window Controls

- **Drag** - Click and drag the header to move the window
- **Minimize** - Click the `−` button to collapse/expand

## How It Works

The extension:
1. Injects a floating UI into Claude.ai pages
2. Captures screenshots using Chrome's `captureVisibleTab` API
3. Crops the captured image to your selected area
4. Automatically finds Claude's input field and paste button
5. Simulates paste and click events to send your content

## Permissions

- `activeTab` - To capture screenshots of the current tab
- `tabs` - To access tab information
- `scripting` - To inject the content script
- `clipboardWrite` - To copy screenshots to clipboard
- `https://claude.ai/*` - To access Claude.ai pages

## Troubleshooting

### Extension not showing on Claude.ai
- Refresh the page after installing the extension
- Make sure you're on https://claude.ai/ (not other domains)

### Screenshot not pasting
- Make sure the Claude.ai page is fully loaded
- Try clicking on Claude's input field first
- Check browser console for errors (F12)

### Send button not working
- Wait a moment after pasting text
- Make sure Claude's input field is not empty
- The send button must not be disabled

## Files

- `manifest.json` - Extension configuration
- `content.js` - Main functionality and UI
- `background.js` - Screenshot capture service
- `styles.css` - Floating window styles

## Development

To modify the extension:

1. Edit the files in the `extension` folder
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. Refresh Claude.ai to see changes

## Notes

- The extension only works on https://claude.ai/*
- Screenshots are cropped to your selected area
- The floating window is draggable and minimizable
- All operations work locally in your browser
