const fs = require('fs');
const { createCanvas } = require('canvas');

function createIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#6366f1';
  ctx.fillRect(0, 0, size, size);

  // Camera body (white rectangle)
  const padding = size / 4;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(padding, padding, size - 2 * padding, size - 2 * padding);

  // Camera lens (blue circle)
  ctx.fillStyle = '#6366f1';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 6, 0, 2 * Math.PI);
  ctx.fill();

  // Flash indicator
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(size / 2.5, size / 3.5, size / 16, size / 16);

  // Save as PNG
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(`icon${size}.png`, buffer);
  console.log(`Created icon${size}.png`);
}

// Create icons
[16, 48, 128].forEach(size => createIcon(size));
console.log('All icons created!');
