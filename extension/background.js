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
