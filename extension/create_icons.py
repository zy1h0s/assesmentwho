#!/usr/bin/env python3
from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size):
    # Create a new image with a gradient background
    img = Image.new('RGB', (size, size), color='#6366f1')
    draw = ImageDraw.Draw(img)

    # Draw a camera icon representation
    # Simple rectangle for camera body
    padding = size // 4
    draw.rectangle(
        [padding, padding, size - padding, size - padding],
        fill='#ffffff',
        outline='#4f46e5',
        width=max(1, size // 32)
    )

    # Draw a circle for lens
    center = size // 2
    radius = size // 6
    draw.ellipse(
        [center - radius, center - radius, center + radius, center + radius],
        fill='#6366f1',
        outline='#4f46e5',
        width=max(1, size // 32)
    )

    # Save the image
    img.save(f'icon{size}.png', 'PNG')
    print(f'Created icon{size}.png')

# Create icons for different sizes
for size in [16, 48, 128]:
    create_icon(size)

print('All icons created successfully!')
